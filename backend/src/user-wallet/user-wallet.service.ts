import {
    Injectable,
    BadRequestException,
    NotFoundException,
    Logger,
    UnauthorizedException,
} from '@nestjs/common';
import {
    WalletTransactionType,
    WalletTransactionStatus,
    UserWalletReferenceType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

const MIN_WITHDRAWAL = 50_000;

@Injectable()
export class UserWalletService {
    private readonly logger = new Logger(UserWalletService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
    ) { }

    // ── Helpers ────────────────────────────────────────────────────────────────

    async ensureWallet(userId: string) {
        return this.prisma.userWallet.upsert({
            where: { userId },
            create: { userId },
            update: {},
        });
    }

    private generateTopupCode(): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const rand = Array.from({ length: 7 }, () =>
            chars[Math.floor(Math.random() * chars.length)]
        ).join('');
        return `RU${rand}`;
    }

    private async ensureTopupCode(walletId: string): Promise<string> {
        const wallet = await this.prisma.userWallet.findUnique({ where: { id: walletId } });
        if (!wallet) throw new NotFoundException(`Wallet ${walletId} not found`);
        if (wallet.topupCode) return wallet.topupCode;

        for (let i = 0; i < 10; i++) {
            const code = this.generateTopupCode();
            try {
                const updated = await this.prisma.userWallet.update({
                    where: { id: walletId },
                    data: { topupCode: code },
                });
                return updated.topupCode!;
            } catch {
                // unique constraint — retry
            }
        }
        throw new Error('Could not generate unique topup code');
    }

    // ── Credit ─────────────────────────────────────────────────────────────────

    async credit(
        walletId: string,
        amount: number,
        referenceType: UserWalletReferenceType,
        referenceId: string,
        opts: { status?: WalletTransactionStatus; description?: string; holdReleaseAt?: Date } = {},
    ) {
        const { status = WalletTransactionStatus.COMPLETED, description } = opts;
        if (amount <= 0) throw new BadRequestException('Credit amount must be positive');

        return this.prisma.$transaction(async (tx) => {
            const wallet = await tx.userWallet.findUnique({ where: { id: walletId } });
            if (!wallet) throw new NotFoundException(`Wallet ${walletId} not found`);

            const balanceField = status === WalletTransactionStatus.COMPLETED ? 'availableBalance' : 'pendingBalance';

            const txRecord = await tx.userWalletTransaction.create({
                data: { walletId, type: WalletTransactionType.CREDIT, amount, status, referenceType, referenceId, description, holdReleaseAt: opts.holdReleaseAt },
            });

            const updatedWallet = await tx.userWallet.update({
                where: { id: walletId },
                data: { [balanceField]: { increment: amount } },
            });

            this.logger.log(`CREDIT user_wallet=${walletId} amount=${amount} ref=${referenceType}:${referenceId}`);
            return { transaction: txRecord, wallet: updatedWallet };
        });
    }

    // ── Debit ──────────────────────────────────────────────────────────────────

    async debit(
        walletId: string,
        amount: number,
        referenceType: UserWalletReferenceType,
        referenceId: string,
        opts: { description?: string } = {},
    ) {
        if (amount <= 0) throw new BadRequestException('Debit amount must be positive');

        return this.prisma.$transaction(async (tx) => {
            const wallet = await tx.userWallet.findUnique({ where: { id: walletId } });
            if (!wallet) throw new NotFoundException(`Wallet ${walletId} not found`);
            if (wallet.availableBalance < amount) {
                throw new BadRequestException(`Insufficient balance: available=${wallet.availableBalance}, requested=${amount}`);
            }

            const txRecord = await tx.userWalletTransaction.create({
                data: { walletId, type: WalletTransactionType.DEBIT, amount, status: WalletTransactionStatus.COMPLETED, referenceType, referenceId, description: opts.description },
            });

            const updatedWallet = await tx.userWallet.update({
                where: { id: walletId },
                data: { availableBalance: { decrement: amount } },
            });

            this.logger.log(`DEBIT user_wallet=${walletId} amount=${amount} ref=${referenceType}:${referenceId}`);
            return { transaction: txRecord, wallet: updatedWallet };
        });
    }

    // ── Queries ────────────────────────────────────────────────────────────────

    async getTransactions(walletId: string, opts: { skip?: number; take?: number } = {}) {
        const { skip = 0, take = 20 } = opts;
        const [items, total] = await this.prisma.$transaction([
            this.prisma.userWalletTransaction.findMany({
                where: { walletId },
                orderBy: { createdAt: 'desc' },
                skip,
                take,
            }),
            this.prisma.userWalletTransaction.count({ where: { walletId } }),
        ]);
        return { items, total, skip, take };
    }

    // ── Withdrawal ─────────────────────────────────────────────────────────────

    async withdraw(walletId: string, amount: number, referenceId: string) {
        if (amount < MIN_WITHDRAWAL) {
            throw new BadRequestException(`Số tiền rút tối thiểu là ${MIN_WITHDRAWAL.toLocaleString('vi-VN')}₫`);
        }

        return this.prisma.$transaction(async (tx) => {
            const wallet = await tx.userWallet.findUnique({ where: { id: walletId } });
            if (!wallet) throw new NotFoundException(`Wallet ${walletId} not found`);
            if (wallet.availableBalance < amount) {
                throw new BadRequestException(`Insufficient balance for withdrawal`);
            }

            const walletTx = await tx.userWalletTransaction.create({
                data: {
                    walletId,
                    type: WalletTransactionType.DEBIT,
                    amount,
                    status: WalletTransactionStatus.PENDING,
                    referenceType: UserWalletReferenceType.WITHDRAW,
                    referenceId,
                    description: `Yêu cầu rút tiền #${referenceId}`,
                },
            });

            const updatedWallet = await tx.userWallet.update({
                where: { id: walletId },
                data: { availableBalance: { decrement: amount } },
            });

            this.logger.log(`WITHDRAW_INITIATED user_wallet=${walletId} amount=${amount}`);
            return { transaction: walletTx, wallet: updatedWallet };
        });
    }

    // ── Top-up (SePay VietQR) ──────────────────────────────────────────────────

    async initTopup(userId: string, amount: number) {
        if (amount <= 0) {
            throw new BadRequestException('Số tiền nạp phải lớn hơn 0');
        }

        const wallet = await this.ensureWallet(userId);
        const transferCode = await this.ensureTopupCode(wallet.id);

        const bankAccount = this.config.get('SEPAY_BANK_ACCOUNT', '07729096901');
        const bankCode = this.config.get('SEPAY_BANK_CODE', 'TPBank');

        const buildQrUrl = (amt: number, code: string) => {
            const desc = encodeURIComponent(code);
            return `https://qr.sepay.vn/img?acc=${bankAccount}&bank=${bankCode}&amount=${amt}&des=${desc}&template=compact`;
        };

        const now = new Date();
        const existing = await this.prisma.userTopupTransaction.findFirst({
            where: { walletId: wallet.id, status: 'PENDING', expireAt: { gt: now } },
            orderBy: { createdAt: 'desc' },
        });

        if (existing) {
            if (existing.amount === amount) {
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
            await this.prisma.userTopupTransaction.update({ where: { id: existing.id }, data: { status: 'CANCELLED' } });
        }

        const expireAt = new Date(now.getTime() + 5 * 60 * 1000);
        const topupTx = await this.prisma.userTopupTransaction.create({
            data: { walletId: wallet.id, amount, transferCode, expireAt },
        });

        this.logger.log(`USER_TOPUP_INIT userId=${userId} amount=${amount} code=${transferCode}`);

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

    async getTopupStatus(txId: string, userId: string) {
        const wallet = await this.ensureWallet(userId);
        const tx = await this.prisma.userTopupTransaction.findFirst({
            where: { id: txId, walletId: wallet.id },
        });
        if (!tx) throw new NotFoundException('Topup transaction not found');

        const now = new Date();
        if (tx.status === 'PENDING' && tx.expireAt && tx.expireAt < now) {
            await this.prisma.userTopupTransaction.update({ where: { id: txId }, data: { status: 'EXPIRED' } });
            return { status: 'EXPIRED' };
        }
        return { status: tx.status, completedAt: tx.completedAt };
    }

    async getPendingTopup(userId: string) {
        const wallet = await this.ensureWallet(userId);
        const now = new Date();
        const tx = await this.prisma.userTopupTransaction.findFirst({
            where: { walletId: wallet.id, status: 'PENDING', expireAt: { gt: now } },
            orderBy: { createdAt: 'desc' },
        });
        if (!tx) return null;

        const bankAccount = this.config.get('SEPAY_BANK_ACCOUNT', '07729096901');
        const bankCode = this.config.get('SEPAY_BANK_CODE', 'TPBank');
        const qrUrl = `https://qr.sepay.vn/img?acc=${bankAccount}&bank=${bankCode}&amount=${tx.amount}&des=${encodeURIComponent(tx.transferCode)}&template=compact`;

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

    async processSePayWebhook(body: any, authHeader: string | undefined) {
        const expectedKey = this.config.get<string>('SEPAY_API_KEY');
        if (expectedKey) {
            const provided = authHeader?.replace('Apikey ', '').trim();
            if (provided !== expectedKey) {
                this.logger.warn('User SePay webhook: invalid API key');
                throw new UnauthorizedException('Invalid API key');
            }
        }

        const { id: sepayId, content, transferType, transferAmount, referenceCode: sepayReferenceCode } = body;

        // Only handle incoming transfers
        if (transferType !== 'in') {
            return { success: false, message: 'Not an incoming transfer' };
        }

        // Deduplicate: check if already processed
        if (sepayId) {
            const existing = await this.prisma.userTopupTransaction.findUnique({ where: { sepayId } });
            if (existing && existing.status === 'COMPLETED') {
                return { success: true, message: 'Already processed', duplicate: true };
            }
        }

        // Find the matching pending topup by transfer code in content
        const now = new Date();
        const pendingTopups = await this.prisma.userTopupTransaction.findMany({
            where: { status: 'PENDING', expireAt: { gt: now } },
            include: { wallet: true },
        });

        const matched = pendingTopups.find(t => content?.includes(t.transferCode));
        if (!matched) {
            this.logger.warn(`USER_WEBHOOK no match for content="${content}"`);
            return { success: false, message: 'No matching topup found' };
        }

        // Verify amount
        if (transferAmount < matched.amount) {
            this.logger.warn(`USER_WEBHOOK amount mismatch: expected=${matched.amount} received=${transferAmount}`);
            return { success: false, message: 'Amount mismatch' };
        }

        // Mark topup complete
        await this.prisma.userTopupTransaction.update({
            where: { id: matched.id },
            data: { status: 'COMPLETED', completedAt: now, sepayId, sepayReferenceCode },
        });

        // Credit user wallet
        await this.credit(
            matched.walletId,
            matched.amount,
            UserWalletReferenceType.TOPUP,
            matched.id,
            {
                status: WalletTransactionStatus.COMPLETED,
                description: `Nạp tiền · ${matched.transferCode}`,
            },
        );

        this.logger.log(`USER_TOPUP_COMPLETED walletId=${matched.walletId} amount=${matched.amount} sepayId=${sepayId}`);
        return { success: true, message: 'Topup credited' };
    }
}
