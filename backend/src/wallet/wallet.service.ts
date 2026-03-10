import {
    Injectable,
    BadRequestException,
    NotFoundException,
    Logger,
    UnauthorizedException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
    WalletReferenceType,
    WalletTransactionStatus,
    WalletTransactionType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

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
    /** For PENDING credits (holding): when to auto-release to available (e.g. now + 24h) */
    holdReleaseAt?: Date;
}

export interface DebitOptions {
    description?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

const MIN_TOPUP = 1; // TODO: restore to 100_000 after SePay testing

@Injectable()
export class WalletService {
    private readonly logger = new Logger(WalletService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
    ) { }

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

    /**
     * Today's earnings stats based on completed rescue requests.
     * Uses rescueRequest as source of truth (same as getHistoryStats) so that
     * both CASH and QR jobs are counted consistently regardless of payment flow.
     */
    async getWeeklyStats(providerId: string) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const todayRequests = await this.prisma.rescueRequest.findMany({
            where: {
                assignedProviderId: providerId,
                status: { in: ['COMPLETED', 'PAID'] as any },
                createdAt: { gte: startOfDay },
            },
            include: {
                payment: { select: { totalAmount: true } },
                quotes: { where: { status: 'ACCEPTED' }, select: { price: true } },
            },
        });

        const getRevenue = (req: any): number => {
            if (req.payment?.totalAmount != null) return req.payment.totalAmount;
            if (req.quotes?.length > 0) return req.quotes[0].price;
            return 0;
        };

        const todayRevenue = todayRequests.reduce((s, req) => s + getRevenue(req), 0);
        // Apply platform commission rate to get provider's net earnings
        const commissionRate = parseFloat(process.env.COMMISSION_RATE ?? '0.1');
        const todayEarnings = Math.round(todayRevenue * (1 - commissionRate));
        return { todayEarnings, todayJobCount: todayRequests.length };
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
                    holdReleaseAt: options.holdReleaseAt,
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

    /**
     * GET /wallet/me/transactions/:txId/details
     * Returns a single transaction enriched with linked job + media data.
     */
    async getTxDetail(walletId: string, txId: string) {
        const tx = await this.prisma.walletTransaction.findFirst({
            where: { id: txId, walletId },
        });
        if (!tx) throw new NotFoundException('Transaction not found');

        let jobDetail: any = null;

        // For JOB or COMMISSION, referenceId is the rescue-request id
        if (
            (tx.referenceType === 'JOB' || tx.referenceType === 'JOB_PAYMENT' || tx.referenceType === 'COMMISSION') &&
            tx.referenceId
        ) {
            const request = await this.prisma.rescueRequest.findUnique({
                where: { id: tx.referenceId },
                include: {
                    user: { select: { id: true, fullName: true, name: true, phoneNumber: true, avatar: true } },
                    media: { orderBy: { createdAt: 'asc' } },
                    payment: true,
                    review: true,
                    quotes: {
                        where: { status: 'ACCEPTED' },
                        take: 1,
                    },
                },
            });
            if (request) {
                jobDetail = {
                    id: request.id,
                    incidentType: request.incidentType,
                    vehicleType: request.vehicleType,
                    description: request.description,
                    pickupLocation: request.pickupLocation,
                    contactPhone: request.contactPhone,
                    status: request.status,
                    videoUrls: request.videoUrls,
                    createdAt: request.createdAt,
                    completedAt: request.completedAt,
                    user: request.user,
                    media: request.media.map(m => ({
                        id: m.id,
                        mediaType: m.mediaType,
                        publicUrl: m.publicUrl,
                        fileName: m.fileName,
                        createdAt: m.createdAt,
                    })),
                    payment: request.payment ? {
                        totalAmount: request.payment.totalAmount,
                        baseFee: request.payment.baseFee,
                        paymentMethod: request.payment.paymentMethod,
                        status: request.payment.status,
                        surchargeNote: request.payment.surchargeNote,
                        createdAt: request.payment.createdAt,
                        userConfirmedAt: (request.payment as any).userConfirmedAt,
                        providerConfirmedAt: (request.payment as any).providerConfirmedAt,
                    } : null,
                    review: request.review ? {
                        rating: request.review.rating,
                        comment: request.review.comment,
                        tags: request.review.tags,
                        createdAt: request.review.createdAt,
                    } : null,
                    acceptedQuote: request.quotes[0] ?? null,
                };
            }
        }

        return { transaction: tx, jobDetail };
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
                ` WITHDRAW_INITIATED wallet=${walletId} amount=${amount} ` +
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
                ` WITHDRAW_CONFIRMED txId=${transactionId} amount=${walletTx.amount}`,
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

    // ── Top-up (SePay VietQR) ──────────────────────────────────────────────────

    /**
     * Generate a unique transfer code for the provider (idempotent).
     * Format: RM + 7 uppercase alphanumeric chars, e.g. RM-A3B7C2D
     */
    private generateTopupCode(): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const rand = Array.from({ length: 7 }, () =>
            chars[Math.floor(Math.random() * chars.length)]
        ).join('');
        return `RM${rand}`;
    }

    /**
     * Ensure the provider's wallet has a topupCode, generate one if missing.
     */
    private async ensureTopupCode(walletId: string): Promise<string> {
        const wallet = await this.prisma.providerWallet.findUnique({
            where: { id: walletId },
        });
        if (!wallet) throw new NotFoundException(`Wallet ${walletId} not found`);

        if (wallet.topupCode) return wallet.topupCode;

        // Try generating a unique code (retry if collision)
        for (let i = 0; i < 10; i++) {
            const code = this.generateTopupCode();
            try {
                const updated = await this.prisma.providerWallet.update({
                    where: { id: walletId },
                    data: { topupCode: code },
                });
                return updated.topupCode!;
            } catch {
                // unique constraint violation – retry
            }
        }
        throw new Error('Could not generate unique topup code');
    }

    /**
     * Provider calls this when they tap "Nạp tiền".
     * Idempotent: returns existing PENDING non-expired tx if one exists.
     * Creates a new one with expireAt = now + 5min otherwise.
     */
    async initTopup(providerId: string, amount: number) {
        if (amount < MIN_TOPUP) {
            throw new BadRequestException(
                `Số tiền nạp tối thiểu là ${MIN_TOPUP.toLocaleString('vi-VN')}₫`,
            );
        }

        const wallet = await this.ensureWallet(providerId);
        const transferCode = await this.ensureTopupCode(wallet.id);

        const bankAccount = this.config.get('SEPAY_BANK_ACCOUNT', '07729096901');
        const bankCode = this.config.get('SEPAY_BANK_CODE', 'TPBank');

        const buildQrUrl = (amt: number, code: string) => {
            const desc = encodeURIComponent(code);
            return `https://qr.sepay.vn/img?acc=${bankAccount}&bank=${bankCode}&amount=${amt}&des=${desc}&template=compact`;
        };

        const now = new Date();

        // 1. Check if there is already a PENDING, non-expired tx for this wallet
        const existing = await this.prisma.topupTransaction.findFirst({
            where: {
                walletId: wallet.id,
                status: 'PENDING',
                expireAt: { gt: now },
            },
            orderBy: { createdAt: 'desc' },
        });

        if (existing) {
            if (existing.amount === amount) {
                // Same amount → reuse existing QR
                this.logger.log(
                    `TOPUP_INIT reuse existing txId=${existing.id} for providerId=${providerId}`,
                );
                return {
                    topupTxId: existing.id,
                    transferCode: existing.transferCode,
                    amount: existing.amount,
                    expireAt: existing.expireAt,
                    bankAccount,
                    bankCode,
                    qrUrl: buildQrUrl(existing.amount, existing.transferCode),
                    isReuse: true,
                };
            }
            // Different amount → cancel old tx, create fresh one
            this.logger.log(
                `TOPUP_INIT amount changed (${existing.amount}→${amount}), cancelling old txId=${existing.id}`,
            );
            await this.prisma.topupTransaction.update({
                where: { id: existing.id },
                data: { status: 'CANCELLED' },
            });
        }

        // 2. Create new PENDING tx with 5-minute expiry
        const expireAt = new Date(now.getTime() + 5 * 60 * 1000);
        const topupTx = await this.prisma.topupTransaction.create({
            data: {
                walletId: wallet.id,
                amount,
                transferCode,
                expireAt,
            },
        });

        this.logger.log(
            `TOPUP_INIT providerId=${providerId} wallet=${wallet.id} ` +
            `amount=${amount} code=${transferCode} txId=${topupTx.id} expireAt=${expireAt.toISOString()}`,
        );

        return {
            topupTxId: topupTx.id,
            transferCode,
            amount,
            expireAt,
            bankAccount,
            bankCode,
            qrUrl: buildQrUrl(amount, transferCode),
            isReuse: false,
        };
    }

    /**
     * SePay calls this webhook when a bank transfer is detected.
     * Matches the transfer code in content → credits the wallet.
     */
    async processSePayWebhook(body: any, authHeader: string | undefined) {
        // 1. Verify API key from Authorization header
        const expectedKey = this.config.get<string>('SEPAY_API_KEY');
        if (expectedKey) {
            const provided = authHeader?.replace('Apikey ', '').trim();
            if (provided !== expectedKey) {
                this.logger.warn('SePay webhook: invalid API key');
                throw new UnauthorizedException('Invalid API key');
            }
        }

        const {
            id: sepayId,
            content,
            transferType,
            transferAmount,
            referenceCode: sepayReferenceCode,
        } = body;

        this.logger.log(
            `SEPAY_WEBHOOK sepayId=${sepayId} type=${transferType} ` +
            `amount=${transferAmount} content="${content}"`,
        );

        // 2. Only handle incoming transfers
        if (transferType !== 'in') {
            return { success: true, message: 'Skipped outgoing transfer' };
        }

        // 3. Dedup: check both topup and job payment tables
        const existingTopup = await this.prisma.topupTransaction.findUnique({
            where: { sepayId: Number(sepayId) },
        });
        const existingJobPay = await this.prisma.jobPaymentTransaction.findUnique({
            where: { sepayId: Number(sepayId) },
        });
        if (existingTopup || existingJobPay) {
            this.logger.warn(`SEPAY_WEBHOOK duplicate sepayId=${sepayId}, skip`);
            return { success: true, message: 'Already processed' };
        }

        // 4. Find matching transfer code in content
        //    Job payment codes: RMJ + 7 chars (10 total)
        //    Topup codes:       RM  + 7 chars (9 total)
        const jobMatch = String(content || '').match(/RMJ[A-Z0-9]{7}/i);
        const topupMatch = !jobMatch && String(content || '').match(/RM[A-Z0-9]{7}/i);
        const match = jobMatch || topupMatch;
        if (!match) {
            this.logger.warn(`SEPAY_WEBHOOK no transfer code in content: "${content}"`);
            return { success: true, message: 'No matching transfer code' };
        }
        const transferCode = match[0].toUpperCase();

        // 5. Route by prefix
        if (jobMatch) {
            return this.processJobPaymentWebhook(transferCode, Number(sepayId), Number(transferAmount));
        }
        // 5. Find the wallet by topupCode
        const wallet = await this.prisma.providerWallet.findUnique({
            where: { topupCode: transferCode },
        });
        if (!wallet) {
            this.logger.warn(`SEPAY_WEBHOOK no wallet for code=${transferCode}`);
            return { success: true, message: 'No wallet found for transfer code' };
        }

        // 6. Find the most-recent, non-expired PENDING topup transaction for this wallet.
        //    Match by amount first; fall back to any PENDING if amount differs.
        //    IMPORTANT: use 'desc' so we update the newest tx (what the frontend is polling),
        //    not an old stale PENDING tx left over from before expiry was added.
        const now = new Date();
        const pendingTx =
            // Best match: right amount, not yet expired
            await this.prisma.topupTransaction.findFirst({
                where: {
                    walletId: wallet.id,
                    status: 'PENDING',
                    amount: Number(transferAmount),
                    OR: [{ expireAt: null }, { expireAt: { gt: now } }],
                },
                orderBy: { createdAt: 'desc' },
            }) ??
            // Fallback: any amount, not yet expired
            await this.prisma.topupTransaction.findFirst({
                where: {
                    walletId: wallet.id,
                    status: 'PENDING',
                    OR: [{ expireAt: null }, { expireAt: { gt: now } }],
                },
                orderBy: { createdAt: 'desc' },
            });

        // 7. Atomic: credit wallet + mark topup tx COMPLETED
        await this.prisma.$transaction(async (tx) => {
            // Credit availableBalance
            await tx.providerWallet.update({
                where: { id: wallet.id },
                data: { availableBalance: { increment: Number(transferAmount) } },
            });

            // Create WalletTransaction record (CREDIT / TOPUP)
            await tx.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    type: WalletTransactionType.CREDIT,
                    amount: Number(transferAmount),
                    status: WalletTransactionStatus.COMPLETED,
                    referenceType: WalletReferenceType.TOPUP,
                    referenceId: String(sepayId),
                    description: `Nạp tiền qua SePay · ${transferCode}`,
                },
            });

            // Update or create TopupTransaction
            if (pendingTx) {
                await tx.topupTransaction.update({
                    where: { id: pendingTx.id },
                    data: {
                        status: 'COMPLETED',
                        sepayId: Number(sepayId),
                        sepayReferenceCode,
                        completedAt: new Date(),
                    },
                });
            } else {
                // Webhook arrived without a matching pending tx (e.g. direct transfer)
                await tx.topupTransaction.create({
                    data: {
                        walletId: wallet.id,
                        amount: Number(transferAmount),
                        status: 'COMPLETED',
                        transferCode,
                        sepayId: Number(sepayId),
                        sepayReferenceCode,
                        completedAt: new Date(),
                    },
                });
            }
        });

        this.logger.log(
            ` TOPUP_COMPLETED wallet=${wallet.id} amount=${transferAmount} ` +
            `code=${transferCode} sepayId=${sepayId}`,
        );

        return { success: true };
    }

    /**
     * Provider polls this to check if their top-up was received.
     * Auto-expires PENDING transactions that have passed their expireAt.
     */
    async getTopupStatus(topupTxId: string, providerId: string) {
        const wallet = await this.prisma.providerWallet.findUnique({
            where: { providerId },
        });
        if (!wallet) throw new NotFoundException('Wallet not found');

        const tx = await this.prisma.topupTransaction.findFirst({
            where: { id: topupTxId, walletId: wallet.id },
        });
        if (!tx) throw new NotFoundException('Topup transaction not found');

        // Auto-expire if past expireAt and still PENDING
        if (tx.status === 'PENDING' && tx.expireAt && tx.expireAt < new Date()) {
            await this.prisma.topupTransaction.update({
                where: { id: tx.id },
                data: { status: 'EXPIRED' },
            });
            return {
                id: tx.id,
                status: 'EXPIRED',
                amount: tx.amount,
                expireAt: tx.expireAt,
                completedAt: null,
            };
        }

        return {
            id: tx.id,
            status: tx.status,
            amount: tx.amount,
            expireAt: tx.expireAt,
            completedAt: tx.completedAt,
        };
    }

    /**
     * Returns the active (PENDING, non-expired) topup tx for a provider, if any.
     * Used by the frontend to show a "resume payment" banner.
     */
    async getPendingTopup(providerId: string) {
        const wallet = await this.prisma.providerWallet.findUnique({
            where: { providerId },
        });
        if (!wallet) return null;

        const now = new Date();
        const tx = await this.prisma.topupTransaction.findFirst({
            where: {
                walletId: wallet.id,
                status: 'PENDING',
                expireAt: { gt: now },
            },
            orderBy: { createdAt: 'desc' },
        });
        if (!tx) return null;

        const bankAccount = this.config.get('SEPAY_BANK_ACCOUNT', '07729096901');
        const bankCode = this.config.get('SEPAY_BANK_CODE', 'TPBank');
        const desc = encodeURIComponent(tx.transferCode);
        const qrUrl = `https://qr.sepay.vn/img?acc=${bankAccount}&bank=${bankCode}&amount=${tx.amount}&des=${desc}&template=compact`;

        return {
            topupTxId: tx.id,
            transferCode: tx.transferCode,
            amount: tx.amount,
            expireAt: tx.expireAt,
            bankAccount,
            bankCode,
            qrUrl,
        };
    }

    // ── Job Payment Webhook Handler ───────────────────────────────────────────

    /**
     * Handles incoming SePay webhook for job payments (RMJ... code).
     * Credits provider pendingBalance (net after commission) with a 24h hold.
     */
    async processJobPaymentWebhook(transferCode: string, sepayId: number, transferAmount: number) {
        const now = new Date();
        const jobTx = await (this.prisma as any).jobPaymentTransaction.findFirst({
            where: { transferCode, status: 'PENDING', expireAt: { gt: now } },
        });
        if (!jobTx) {
            this.logger.warn(`JOB_PAYMENT_WEBHOOK no pending tx for code=${transferCode}`);
            return { success: true, message: 'No pending job payment found' };
        }
        if (jobTx.amount !== transferAmount) {
            this.logger.warn(`JOB_PAYMENT_WEBHOOK amount mismatch: expected=${jobTx.amount} got=${transferAmount}`);
            return { success: true, message: 'Amount mismatch' };
        }

        const payment = await this.prisma.payment.findUnique({ where: { requestId: jobTx.requestId } });
        if (!payment) return { success: true, message: 'Payment record not found' };

        const wallet = await this.ensureWallet(payment.providerId);
        const commissionRate = parseFloat(process.env.COMMISSION_RATE ?? '0.1');
        const netAmount = Math.round(transferAmount * (1 - commissionRate));
        const holdReleaseAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24h

        await (this.prisma as any).$transaction(async (tx: any) => {
            await tx.jobPaymentTransaction.update({
                where: { id: jobTx.id },
                data: { status: 'COMPLETED', sepayId, completedAt: new Date() },
            });
            await tx.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    type: WalletTransactionType.CREDIT,
                    amount: netAmount,
                    status: WalletTransactionStatus.PENDING,
                    referenceType: WalletReferenceType.JOB_PAYMENT as any,
                    referenceId: jobTx.requestId,
                    description: `Thu nhập job QR • chờ giải ngân 24h • HH ${commissionRate * 100}%`,
                    holdReleaseAt,
                } as any,
            });
            await tx.providerWallet.update({
                where: { id: wallet.id },
                data: { pendingBalance: { increment: netAmount } },
            });
            await tx.payment.update({
                where: { id: payment.id },
                data: {
                    status: 'COMPLETED' as any,
                    userConfirmedAt: new Date(),
                    providerConfirmedAt: new Date(),
                },
            });
            await tx.rescueRequest.update({
                where: { id: jobTx.requestId },
                data: { status: 'COMPLETED' },
            });
        });

        this.logger.log(
            ` JOB_PAYMENT_COMPLETED requestId=${jobTx.requestId} amount=${transferAmount} ` +
            `net=${netAmount} holdReleaseAt=${holdReleaseAt.toISOString()}`,
        );
        return { success: true };
    }

    // ── Auto-release Holding Balance ──────────────────────────────────────────

    /** Every hour: release PENDING credits past holdReleaseAt to available. */
    @Cron(CronExpression.EVERY_HOUR)
    async autoReleaseHolding() {
        const now = new Date();
        const pending = await this.prisma.walletTransaction.findMany({
            where: {
                type: WalletTransactionType.CREDIT,
                status: WalletTransactionStatus.PENDING,
                holdReleaseAt: { lte: now } as any,
            },
            take: 100,
        });
        if (pending.length === 0) return;
        this.logger.log(`⏰ [AutoRelease] Releasing ${pending.length} holding transactions`);

        const affectedWalletIds = new Set<string>();

        for (const t of pending) {
            try {
                await this.prisma.$transaction(async (tx) => {
                    // Re-read inside DB transaction to guard against concurrent runs
                    const walletTx = await tx.walletTransaction.findUnique({
                        where: { id: t.id },
                    });
                    if (!walletTx) throw new Error(`Transaction ${t.id} not found`);

                    // Skip if already settled by a concurrent run or manual action
                    if (walletTx.status !== WalletTransactionStatus.PENDING) {
                        this.logger.warn(`⚠️ [AutoRelease] txId=${t.id} already settled (status=${walletTx.status}), skipping`);
                        return;
                    }

                    // Mark transaction COMPLETED
                    await tx.walletTransaction.update({
                        where: { id: t.id },
                        data: { status: WalletTransactionStatus.COMPLETED },
                    });

                    // Move balance: pending → available
                    // NOTE: We intentionally skip the pendingBalance >= amount guard here.
                    // If pendingBalance is corrupted (e.g. negative from a prior double-release),
                    // the guard would block recovery. We reconcile pendingBalance in bulk below.
                    await tx.providerWallet.update({
                        where: { id: walletTx.walletId },
                        data: {
                            pendingBalance: { decrement: walletTx.amount },
                            availableBalance: { increment: walletTx.amount },
                        },
                    });
                });

                affectedWalletIds.add(t.walletId);
                this.logger.log(`✅ [AutoRelease] txId=${t.id} amount=${t.amount}`);
            } catch (e: any) {
                this.logger.error(`❌ [AutoRelease] txId=${t.id}: ${e.message}`);
            }
        }

        // Reconcile pendingBalance for every wallet that had settlements.
        // This corrects any corruption (e.g. negative balance from a prior double-release)
        // by setting pendingBalance = SUM of remaining PENDING CREDIT transactions.
        for (const walletId of affectedWalletIds) {
            try {
                await this.reconcilePendingBalance(walletId);
            } catch (e: any) {
                this.logger.error(`❌ [AutoRelease] Reconcile wallet=${walletId}: ${e.message}`);
            }
        }
    }

    /** Recalculate and correct pendingBalance from the actual PENDING CREDIT transactions. */
    private async reconcilePendingBalance(walletId: string): Promise<void> {
        await this.prisma.$transaction(async (tx) => {
            const result = await tx.walletTransaction.aggregate({
                where: {
                    walletId,
                    type: WalletTransactionType.CREDIT,
                    status: WalletTransactionStatus.PENDING,
                },
                _sum: { amount: true },
            });
            const correctPending = result._sum.amount ?? 0;
            await tx.providerWallet.update({
                where: { id: walletId },
                data: { pendingBalance: correctPending },
            });
            this.logger.log(`🔧 [AutoRelease] Reconciled wallet=${walletId} pendingBalance=${correctPending}`);
        });
    }
}
