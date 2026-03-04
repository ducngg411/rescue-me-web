import {
    Injectable,
    BadRequestException,
    NotFoundException,
    Logger,
} from '@nestjs/common';
import {
    WalletReferenceType,
    WalletTransactionStatus,
    WalletTransactionType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// ─────────────────────────────────────────────────────────────────────────────
// Option types
// ─────────────────────────────────────────────────────────────────────────────

export interface CreditOptions {
    /**
     * When COMPLETED (default) the amount lands directly in availableBalance.
     * When PENDING it sits in pendingBalance until settled via settleTransaction().
     */
    status?: WalletTransactionStatus;
    description?: string;
}

export interface DebitOptions {
    description?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class WalletService {
    private readonly logger = new Logger(WalletService.name);

    constructor(private readonly prisma: PrismaService) { }

    // ── Helpers ────────────────────────────────────────────────────────────────

    /**
     * Ensure a wallet row exists for the given provider.
     * Returns the wallet (creates one lazily if missing).
     */
    async ensureWallet(providerId: string) {
        return this.prisma.providerWallet.upsert({
            where: { providerId },
            create: { providerId },
            update: {},
        });
    }

    /**
     * Return the wallet by its primary key, throwing if not found.
     */
    async getWalletById(walletId: string) {
        const wallet = await this.prisma.providerWallet.findUnique({
            where: { id: walletId },
        });
        if (!wallet) {
            throw new NotFoundException(`Wallet ${walletId} not found`);
        }
        return wallet;
    }

    /**
     * Return the wallet for a provider, throwing if not found.
     */
    async getWalletByProvider(providerId: string) {
        const wallet = await this.prisma.providerWallet.findUnique({
            where: { providerId },
        });
        if (!wallet) {
            throw new NotFoundException(`Wallet for provider ${providerId} not found`);
        }
        return wallet;
    }

    // ── Credit ─────────────────────────────────────────────────────────────────

    /**
     * Credit `amount` (VND) to the wallet referenced by `walletId`.
     *
     * - status = COMPLETED → added to availableBalance immediately
     * - status = PENDING   → added to pendingBalance (held)
     *
     * The record insertion and balance update happen inside a single DB transaction.
     */
    async credit(
        walletId: string,
        amount: number,
        referenceType: WalletReferenceType,
        referenceId: string,
        options: CreditOptions = {},
    ) {
        const { status = WalletTransactionStatus.COMPLETED, description } = options;

        if (amount <= 0) {
            throw new BadRequestException('Credit amount must be positive');
        }

        return this.prisma.$transaction(async (tx) => {
            // 1. Lock wallet row with a re-read inside the transaction
            const wallet = await tx.providerWallet.findUnique({
                where: { id: walletId },
            });
            if (!wallet) {
                throw new NotFoundException(`Wallet ${walletId} not found`);
            }

            // 2. Determine which balance column to increment
            const balanceField =
                status === WalletTransactionStatus.COMPLETED
                    ? 'availableBalance'
                    : 'pendingBalance';

            // 3. Create the transaction record
            const txRecord = await tx.walletTransaction.create({
                data: {
                    walletId,
                    type: WalletTransactionType.CREDIT,
                    amount,
                    status,
                    referenceType,
                    referenceId,
                    description,
                },
            });

            // 4. Update the balance atomically
            const updatedWallet = await tx.providerWallet.update({
                where: { id: walletId },
                data: {
                    [balanceField]: { increment: amount },
                },
            });

            this.logger.log(
                `CREDIT wallet=${walletId} amount=${amount} status=${status} ` +
                `ref=${referenceType}:${referenceId} txId=${txRecord.id}`,
            );

            return { transaction: txRecord, wallet: updatedWallet };
        });
    }

    // ── Debit ──────────────────────────────────────────────────────────────────

    /**
     * Debit `amount` (VND) from the wallet's availableBalance.
     *
     * Throws BadRequestException if balance is insufficient.
     * Both the transaction record and balance decrement are atomic.
     */
    async debit(
        walletId: string,
        amount: number,
        referenceType: WalletReferenceType,
        referenceId: string,
        options: DebitOptions = {},
    ) {
        const { description } = options;

        if (amount <= 0) {
            throw new BadRequestException('Debit amount must be positive');
        }

        return this.prisma.$transaction(async (tx) => {
            // 1. Lock & read wallet inside the transaction
            const wallet = await tx.providerWallet.findUnique({
                where: { id: walletId },
            });
            if (!wallet) {
                throw new NotFoundException(`Wallet ${walletId} not found`);
            }

            // 2. Guard: sufficient available balance?
            if (wallet.availableBalance < amount) {
                throw new BadRequestException(
                    `Insufficient balance: available=${wallet.availableBalance}, requested=${amount}`,
                );
            }

            // 3. Create the transaction record
            const txRecord = await tx.walletTransaction.create({
                data: {
                    walletId,
                    type: WalletTransactionType.DEBIT,
                    amount,
                    status: WalletTransactionStatus.COMPLETED,
                    referenceType,
                    referenceId,
                    description,
                },
            });

            // 4. Deduct from availableBalance atomically
            const updatedWallet = await tx.providerWallet.update({
                where: { id: walletId },
                data: {
                    availableBalance: { decrement: amount },
                },
            });

            this.logger.log(
                `DEBIT wallet=${walletId} amount=${amount} ` +
                `ref=${referenceType}:${referenceId} txId=${txRecord.id}`,
            );

            return { transaction: txRecord, wallet: updatedWallet };
        });
    }

    // ── Debit (commission – allows negative balance) ────────────────────────────

    /**
     * Debit `amount` from availableBalance for **platform commission** purposes.
     *
     * Unlike `debit()`, this method does NOT guard against insufficient balance.
     * availableBalance is allowed to go negative. When it does, the provider
     * will be blocked from receiving new jobs until they top up.
     */
    async debitCommission(
        walletId: string,
        amount: number,
        referenceId: string,
        options: DebitOptions = {},
    ) {
        const { description } = options;

        if (amount <= 0) {
            throw new BadRequestException('Commission debit amount must be positive');
        }

        return this.prisma.$transaction(async (tx) => {
            const wallet = await tx.providerWallet.findUnique({
                where: { id: walletId },
            });
            if (!wallet) {
                throw new NotFoundException(`Wallet ${walletId} not found`);
            }

            // Create the DEBIT / COMMISSION transaction record
            const txRecord = await tx.walletTransaction.create({
                data: {
                    walletId,
                    type: WalletTransactionType.DEBIT,
                    amount,
                    status: WalletTransactionStatus.COMPLETED,
                    referenceType: WalletReferenceType.COMMISSION,
                    referenceId,
                    description,
                },
            });

            // Decrement regardless of current balance (may go negative)
            const updatedWallet = await tx.providerWallet.update({
                where: { id: walletId },
                data: {
                    availableBalance: { decrement: amount },
                },
            });

            this.logger.log(
                `💸 COMMISSION_DEBIT wallet=${walletId} amount=${amount} ` +
                `ref=COMMISSION:${referenceId} txId=${txRecord.id} ` +
                `newBalance=${updatedWallet.availableBalance}`,
            );

            if (updatedWallet.availableBalance < 0) {
                this.logger.warn(
                    `⚠️  wallet=${walletId} balance went NEGATIVE (${updatedWallet.availableBalance} VND). ` +
                    `Provider will be blocked from accepting new jobs until topped up.`,
                );
            }

            return { transaction: txRecord, wallet: updatedWallet };
        });
    }

    // ── Settle pending transaction ─────────────────────────────────────────────


    /**
     * Move an amount from pendingBalance → availableBalance and mark the
     * wallet transaction as COMPLETED.
     *
     * Call this when an escrow / hold is resolved (e.g. job payment confirmed).
     */
    async settlePendingTransaction(transactionId: string) {
        return this.prisma.$transaction(async (tx) => {
            // 1. Find the pending tx
            const walletTx = await tx.walletTransaction.findUnique({
                where: { id: transactionId },
            });
            if (!walletTx) {
                throw new NotFoundException(`WalletTransaction ${transactionId} not found`);
            }
            if (walletTx.status !== WalletTransactionStatus.PENDING) {
                throw new BadRequestException(
                    `Transaction ${transactionId} is not in PENDING status (current: ${walletTx.status})`,
                );
            }

            const wallet = await tx.providerWallet.findUnique({
                where: { id: walletTx.walletId },
            });
            if (!wallet) {
                throw new NotFoundException(`Wallet ${walletTx.walletId} not found`);
            }

            if (wallet.pendingBalance < walletTx.amount) {
                throw new BadRequestException(
                    `Pending balance inconsistency: pendingBalance=${wallet.pendingBalance}, txAmount=${walletTx.amount}`,
                );
            }

            // 2. Mark the transaction as COMPLETED
            const updatedTx = await tx.walletTransaction.update({
                where: { id: transactionId },
                data: { status: WalletTransactionStatus.COMPLETED },
            });

            // 3. Move balance: pending → available
            const updatedWallet = await tx.providerWallet.update({
                where: { id: walletTx.walletId },
                data: {
                    pendingBalance: { decrement: walletTx.amount },
                    availableBalance: { increment: walletTx.amount },
                },
            });

            this.logger.log(
                `SETTLE txId=${transactionId} wallet=${walletTx.walletId} amount=${walletTx.amount}`,
            );

            return { transaction: updatedTx, wallet: updatedWallet };
        });
    }

    // ── Queries ────────────────────────────────────────────────────────────────

    /**
     * Paginated transaction history for a wallet.
     */
    async getTransactions(
        walletId: string,
        opts: { skip?: number; take?: number } = {},
    ) {
        const { skip = 0, take = 20 } = opts;
        const [items, total] = await this.prisma.$transaction([
            this.prisma.walletTransaction.findMany({
                where: { walletId },
                orderBy: { createdAt: 'desc' },
                skip,
                take,
            }),
            this.prisma.walletTransaction.count({ where: { walletId } }),
        ]);
        return { items, total, skip, take };
    }

    // ── Withdrawal ─────────────────────────────────────────────────────────────

    /**
     * Step 1 — Provider requests a withdrawal.
     *
     * - Validates availableBalance >= amount.
     * - Creates a DEBIT WalletTransaction with status PENDING.
     * - Deducts amount from availableBalance immediately (funds are reserved).
     *
     * Returns the pending transaction ID that must be passed to
     * confirmWithdrawal() or failWithdrawal() once the bank transfer resolves.
     */
    async withdraw(
        walletId: string,
        amount: number,
        referenceId: string,   // e.g. a WithdrawRequest.id from your system
        description?: string,
    ) {
        if (amount <= 0) {
            throw new BadRequestException('Withdrawal amount must be positive');
        }

        return this.prisma.$transaction(async (tx) => {
            // 1. Lock & read wallet
            const wallet = await tx.providerWallet.findUnique({
                where: { id: walletId },
            });
            if (!wallet) {
                throw new NotFoundException(`Wallet ${walletId} not found`);
            }

            // 2. Guard: sufficient available balance?
            if (wallet.availableBalance < amount) {
                throw new BadRequestException(
                    `Insufficient balance for withdrawal: ` +
                    `available=${wallet.availableBalance}, requested=${amount}`,
                );
            }

            // 3. Create PENDING DEBIT transaction (bank transfer not yet done)
            const walletTx = await tx.walletTransaction.create({
                data: {
                    walletId,
                    type: WalletTransactionType.DEBIT,
                    amount,
                    status: WalletTransactionStatus.PENDING,
                    referenceType: WalletReferenceType.WITHDRAW,
                    referenceId,
                    description: description ?? `Yêu cầu rút tiền #${referenceId}`,
                },
            });

            // 4. Deduct from availableBalance (funds reserved, not yet sent)
            const updatedWallet = await tx.providerWallet.update({
                where: { id: walletId },
                data: { availableBalance: { decrement: amount } },
            });

            this.logger.log(
                `🏦 WITHDRAW_INITIATED wallet=${walletId} amount=${amount} ` +
                `txId=${walletTx.id} remaining=${updatedWallet.availableBalance}`,
            );

            return { transaction: walletTx, wallet: updatedWallet };
        });
    }

    /**
     * Step 2a — Bank transfer succeeded.
     *
     * Marks the PENDING DEBIT transaction as COMPLETED.
     * The balance was already deducted in withdraw(), so no further balance
     * changes are needed.
     */
    async confirmWithdrawal(transactionId: string) {
        return this.prisma.$transaction(async (tx) => {
            const walletTx = await tx.walletTransaction.findUnique({
                where: { id: transactionId },
            });

            if (!walletTx) {
                throw new NotFoundException(`WalletTransaction ${transactionId} not found`);
            }
            if (walletTx.type !== WalletTransactionType.DEBIT) {
                throw new BadRequestException(
                    `Transaction ${transactionId} is not a DEBIT — cannot confirm withdrawal`,
                );
            }
            if (walletTx.status !== WalletTransactionStatus.PENDING) {
                throw new BadRequestException(
                    `Transaction ${transactionId} is not PENDING (status=${walletTx.status})`,
                );
            }

            const updatedTx = await tx.walletTransaction.update({
                where: { id: transactionId },
                data: { status: WalletTransactionStatus.COMPLETED },
            });

            this.logger.log(
                `✅ WITHDRAW_CONFIRMED txId=${transactionId} amount=${walletTx.amount}`,
            );

            return { transaction: updatedTx };
        });
    }

    /**
     * Step 2b — Bank transfer failed.
     *
     * - Marks the PENDING DEBIT transaction as FAILED.
     * - Refunds the amount back to availableBalance.
     *
     * Both operations are atomic to prevent balance corruption on partial failure.
     */
    async failWithdrawal(transactionId: string, reason?: string) {
        return this.prisma.$transaction(async (tx) => {
            const walletTx = await tx.walletTransaction.findUnique({
                where: { id: transactionId },
            });

            if (!walletTx) {
                throw new NotFoundException(`WalletTransaction ${transactionId} not found`);
            }
            if (walletTx.type !== WalletTransactionType.DEBIT) {
                throw new BadRequestException(
                    `Transaction ${transactionId} is not a DEBIT — cannot fail withdrawal`,
                );
            }
            if (walletTx.status !== WalletTransactionStatus.PENDING) {
                throw new BadRequestException(
                    `Transaction ${transactionId} is not PENDING (status=${walletTx.status}). ` +
                    `Cannot fail an already-resolved transaction.`,
                );
            }

            // 1. Mark FAILED + optionally store reason in description
            const updatedTx = await tx.walletTransaction.update({
                where: { id: transactionId },
                data: {
                    status: WalletTransactionStatus.FAILED,
                    description: reason
                        ? `[THẤT BẠI] ${reason}`
                        : walletTx.description,
                },
            });

            // 2. Refund the reserved amount back to availableBalance
            const updatedWallet = await tx.providerWallet.update({
                where: { id: walletTx.walletId },
                data: { availableBalance: { increment: walletTx.amount } },
            });

            this.logger.warn(
                `❌ WITHDRAW_FAILED txId=${transactionId} amount=${walletTx.amount} ` +
                `refunded → availableBalance=${updatedWallet.availableBalance} ` +
                `reason="${reason ?? 'unspecified'}"`,
            );

            return { transaction: updatedTx, wallet: updatedWallet };
        });
    }
}
