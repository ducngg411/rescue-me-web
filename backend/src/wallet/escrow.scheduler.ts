import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { WalletTransactionStatus, WalletTransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// How old a PENDING CREDIT must be before it is auto-released
const ESCROW_HOLD_HOURS = 24;

export interface EscrowReleaseReport {
    processedAt: Date;
    released: number;       // number of transactions settled
    totalAmountVnd: number; // sum of amounts moved to availableBalance
    errors: number;         // transactions that failed (logged but not re-thrown)
}

@Injectable()
export class EscrowScheduler {
    private readonly logger = new Logger(EscrowScheduler.name);

    constructor(private readonly prisma: PrismaService) { }

    // ── Cron ───────────────────────────────────────────────────────────────────
    // Runs every hour at minute 0  (e.g. 00:00, 01:00, 02:00 …)
    // Change the expression if you want a different cadence.
    @Cron('0 * * * *')
    async autoReleaseEscrow(): Promise<EscrowReleaseReport> {
        this.logger.log('⏰ [EscrowScheduler] Starting 24h escrow auto-release run…');

        const report = await this.releaseEligibleEscrows();

        if (report.released > 0) {
            this.logger.log(
                ` [EscrowScheduler] Released ${report.released} escrow(s), ` +
                `total ${report.totalAmountVnd} VND moved to availableBalance.`,
            );
        } else {
            this.logger.debug('[EscrowScheduler] No eligible escrow transactions found.');
        }

        if (report.errors > 0) {
            this.logger.error(
                `❌ [EscrowScheduler] ${report.errors} transaction(s) failed during release — see above logs.`,
            );
        }

        return report;
    }

    // ── Core logic (also callable directly for testing / admin triggers) ───────

    /**
     * Find all PENDING CREDIT transactions older than ESCROW_HOLD_HOURS and
     * settle them one by one inside individual DB transactions so a single
     * failure does not block the rest.
     */
    async releaseEligibleEscrows(): Promise<EscrowReleaseReport> {
        const processedAt = new Date();
        const cutoff = new Date(processedAt.getTime() - ESCROW_HOLD_HOURS * 60 * 60 * 1000);

        // Fetch all eligible transactions up-front (single read)
        const eligible = await this.prisma.walletTransaction.findMany({
            where: {
                type: WalletTransactionType.CREDIT,
                status: WalletTransactionStatus.PENDING,
                createdAt: { lte: cutoff },
            },
            orderBy: { createdAt: 'asc' },
        });

        this.logger.log(
            `🔍 [EscrowScheduler] Found ${eligible.length} eligible pending credit(s) ` +
            `(cutoff: ${cutoff.toISOString()})`,
        );

        let released = 0;
        let totalAmountVnd = 0;
        let errors = 0;

        for (const tx of eligible) {
            try {
                await this.settleOne(tx.id, tx.walletId, tx.amount);
                released++;
                totalAmountVnd += tx.amount;
            } catch (err) {
                errors++;
                this.logger.error(
                    `❌ [EscrowScheduler] Failed to settle txId=${tx.id}: ${(err as Error).message}`,
                    (err as Error).stack,
                );
            }
        }

        return { processedAt, released, totalAmountVnd, errors };
    }

    // ── Atomic single-transaction settlement ───────────────────────────────────

    /**
     * Settle one pending escrow transaction inside a DB transaction:
     *   1. Re-read the WalletTransaction with a lock (prevents double-release).
     *   2. Mark it COMPLETED.
     *   3. Move amount: pendingBalance → availableBalance on the wallet.
     */
    private async settleOne(
        txId: string,
        walletId: string,
        expectedAmount: number,
    ): Promise<void> {
        await this.prisma.$transaction(async (db) => {
            // 1. Re-read inside tx to guard against concurrent runs
            const walletTx = await db.walletTransaction.findUnique({
                where: { id: txId },
            });

            if (!walletTx) {
                throw new Error(`WalletTransaction ${txId} disappeared — skipping.`);
            }

            // Guard: skip if already settled by a concurrent run or manual action
            if (walletTx.status !== WalletTransactionStatus.PENDING) {
                this.logger.warn(
                    `[EscrowScheduler] txId=${txId} is no longer PENDING ` +
                    `(status=${walletTx.status}) — skipping.`,
                );
                return;
            }

            const wallet = await db.providerWallet.findUnique({
                where: { id: walletId },
            });

            if (!wallet) {
                throw new Error(`Wallet ${walletId} not found for txId=${txId}.`);
            }

            if (wallet.pendingBalance < expectedAmount) {
                throw new Error(
                    `Wallet ${walletId} pendingBalance (${wallet.pendingBalance}) ` +
                    `is less than tx amount (${expectedAmount}) for txId=${txId}. ` +
                    `Possible data inconsistency — aborting this settlement.`,
                );
            }

            // 2. Mark transaction COMPLETED
            await db.walletTransaction.update({
                where: { id: txId },
                data: { status: WalletTransactionStatus.COMPLETED },
            });

            // 3. Atomic balance transfer: pending → available
            await db.providerWallet.update({
                where: { id: walletId },
                data: {
                    pendingBalance: { decrement: expectedAmount },
                    availableBalance: { increment: expectedAmount },
                },
            });

            this.logger.log(
                `💸 [EscrowScheduler] Settled txId=${txId} amount=${expectedAmount} VND ` +
                `wallet=${walletId}`,
            );
        });
    }
}
