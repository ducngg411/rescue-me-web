import {
    Injectable,
    BadRequestException,
    NotFoundException,
    Logger,
} from '@nestjs/common';
import { PaymentMethod, WalletReferenceType, WalletTransactionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from './wallet.service';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface CommissionConfig {
    /**
     * Platform commission rate expressed as a decimal, e.g. 0.10 = 10 %.
     * Defaults to COMMISSION_RATE env variable, or 0.10 if unset.
     */
    commissionRate?: number;
}

// Rate to use when $COMMISSION_RATE env is not set
const DEFAULT_COMMISSION_RATE = 0.1; // 10 %

// ─────────────────────────────────────────────────────────────────────────────
// Return shapes
// ─────────────────────────────────────────────────────────────────────────────

export interface CashJobCompletionResult {
    jobId: string;
    providerId: string;
    jobAmount: number;
    commissionRate: number;
    commissionAmount: number;
    /** true  → debit succeeded, balance reduced                          */
    /** false → balance was too low, flag set, no debit performed          */
    deducted: boolean;
    belowMinimumBalance: boolean;
    walletSnapshot: {
        id: string;
        availableBalance: number;
        pendingBalance: number;
    };
}

export interface EscrowReleaseResult {
    jobId: string;
    providerId: string;
    jobAmount: number;
    commissionRate: number;
    commissionAmount: number;
    netAmount: number; // jobAmount - commissionAmount → lands in pendingBalance
    /** The PENDING WalletTransaction that was created. */
    pendingTransactionId: string;
    walletSnapshot: {
        id: string;
        availableBalance: number;
        pendingBalance: number;
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class CommissionService {
    private readonly logger = new Logger(CommissionService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly walletService: WalletService,
    ) { }

    // ── Helpers ────────────────────────────────────────────────────────────────

    /** Resolve the effective commission rate (env override → config → default). */
    private resolveRate(config?: CommissionConfig): number {
        if (config?.commissionRate !== undefined) {
            const r = config.commissionRate;
            if (r < 0 || r > 1) throw new BadRequestException('commissionRate must be between 0 and 1');
            return r;
        }
        const envRate = parseFloat(process.env.COMMISSION_RATE ?? '');
        return isNaN(envRate) ? DEFAULT_COMMISSION_RATE : envRate;
    }

    /** Round to nearest VND integer (VND has no decimals). */
    private roundVnd(amount: number): number {
        return Math.round(amount);
    }

    // ── Core ───────────────────────────────────────────────────────────────────

    /**
     * Handle commission deduction when a CASH job is fully paid.
     *
     * Flow:
     *  1. Load Payment record for the job (rescueRequest).
     *  2. Assert paymentMethod === CASH and payment is in a completed-enough state.
     *  3. Calculate commission = totalAmount × commissionRate.
     *  4. Ensure the provider has a wallet (auto-create if absent).
     *  5. Attempt to debit commission.
     *     → If balance OK  → DEBIT transaction created, balance reduced.
     *     → If balance low → set belowMinimumBalance flag (no exception thrown).
     *
     * @param jobId     - RescueRequest ID (= "job ID" in business language)
     * @param config    - Optional runtime overrides (e.g. custom rate for testing)
     */
    async handleCashJobCompletion(
        jobId: string,
        config?: CommissionConfig,
    ): Promise<CashJobCompletionResult> {
        this.logger.log(`💰 [Commission] handleCashJobCompletion jobId=${jobId}`);

        // 1. Load Payment
        const payment = await this.prisma.payment.findUnique({
            where: { requestId: jobId },
        });

        if (!payment) {
            throw new NotFoundException(
                `Payment for job ${jobId} not found. Commission cannot be calculated.`,
            );
        }

        // 2. Guard: only CASH jobs
        if (payment.paymentMethod !== PaymentMethod.CASH) {
            throw new BadRequestException(
                `Job ${jobId} uses ${payment.paymentMethod} — only CASH jobs go through this commission path.`,
            );
        }

        // 3. Calculate commission
        const rate = this.resolveRate(config);
        const commissionAmount = this.roundVnd(payment.totalAmount * rate);

        this.logger.log(
            `📊 [Commission] jobId=${jobId} total=${payment.totalAmount} ` +
            `rate=${rate * 100}% commission=${commissionAmount} VND`,
        );

        // 4. Ensure provider wallet exists
        const wallet = await this.walletService.ensureWallet(payment.providerId);

        // 5. Always deduct commission – wallet is allowed to go negative.
        //    Use debitCommission() which skips the balance guard.
        const { wallet: finalWallet } = await this.walletService.debitCommission(
            wallet.id,
            commissionAmount,
            jobId,
            {
                description: `Phí hoa hồng nền tảng ${rate * 100}% - Job #${jobId}`,
            },
        );

        const belowZero = finalWallet.availableBalance < 0;

        if (belowZero) {
            this.logger.warn(
                `⚠️ [Commission] Provider ${payment.providerId} wallet is now NEGATIVE ` +
                `(${finalWallet.availableBalance} VND). Job acceptance blocked until topped up.`,
            );
        }

        return {
            jobId,
            providerId: payment.providerId,
            jobAmount: payment.totalAmount,
            commissionRate: rate,
            commissionAmount,
            deducted: true,
            belowMinimumBalance: belowZero,
            walletSnapshot: {
                id: finalWallet.id,
                availableBalance: finalWallet.availableBalance,
                pendingBalance: finalWallet.pendingBalance,
            },
        };
    }


    // ── Escrow / Bank Transfer ─────────────────────────────────────────────────

    /**
     * Handle escrow release when a QR / bank-transfer job is confirmed.
     *
     * Flow:
     *  1. Load Payment — assert paymentMethod === QR.
     *  2. Calculate commission = totalAmount × rate.
     *  3. Net amount = totalAmount − commission.
     *  4. Ensure provider wallet exists.
     *  5. Create a PENDING CREDIT for netAmount → increases pendingBalance.
     *     Money stays in pendingBalance until settlePendingTransaction() is called
     *     (e.g. after a holding period or manual admin release).
     *
     * @param jobId   - RescueRequest ID
     * @param config  - Optional commission rate override
     */
    async handleEscrowRelease(
        jobId: string,
        config?: CommissionConfig,
    ): Promise<EscrowReleaseResult> {
        this.logger.log(`🔒 [Escrow] handleEscrowRelease jobId=${jobId}`);

        // 1. Load Payment
        const payment = await this.prisma.payment.findUnique({
            where: { requestId: jobId },
        });

        if (!payment) {
            throw new NotFoundException(
                `Payment for job ${jobId} not found.`,
            );
        }

        // 2. Guard: only QR / bank-transfer jobs
        if (payment.paymentMethod !== PaymentMethod.QR) {
            throw new BadRequestException(
                `Job ${jobId} uses ${payment.paymentMethod} — only QR jobs go through the escrow path.`,
            );
        }

        // 3. Calculate commission & net amount
        const rate = this.resolveRate(config);
        const commissionAmount = this.roundVnd(payment.totalAmount * rate);
        const netAmount = payment.totalAmount - commissionAmount;

        this.logger.log(
            `📊 [Escrow] jobId=${jobId} total=${payment.totalAmount} ` +
            `commission=${commissionAmount} net=${netAmount} VND`,
        );

        if (netAmount < 0) {
            throw new BadRequestException(
                `Net amount is negative (total=${payment.totalAmount}, commission=${commissionAmount}). ` +
                `Check commission rate configuration.`,
            );
        }

        // 4. Ensure provider wallet exists
        const wallet = await this.walletService.ensureWallet(payment.providerId);

        // 5. Create a PENDING CREDIT — money sits in pendingBalance for 24h
        // holdReleaseAt ensures ONLY WalletService.autoReleaseHolding releases this,
        // preventing double-release by EscrowScheduler (which queries by createdAt).
        const holdReleaseAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const { transaction, wallet: updatedWallet } = await this.walletService.credit(
            wallet.id,
            netAmount,
            WalletReferenceType.JOB,
            jobId,
            {
                status: WalletTransactionStatus.PENDING,
                description: `Thu nhập job QR #${jobId} (chờ giải ngân) — hoa hồng ${rate * 100}% đã khấu trừ`,
                holdReleaseAt,
            },
        );

        this.logger.log(
            ` [Escrow] PENDING credit created: txId=${transaction.id} ` +
            `amount=${netAmount} VND → pendingBalance=${updatedWallet.pendingBalance} VND`,
        );

        return {
            jobId,
            providerId: payment.providerId,
            jobAmount: payment.totalAmount,
            commissionRate: rate,
            commissionAmount,
            netAmount,
            pendingTransactionId: transaction.id,
            walletSnapshot: {
                id: updatedWallet.id,
                availableBalance: updatedWallet.availableBalance,
                pendingBalance: updatedWallet.pendingBalance,
            },
        };
    }
}
