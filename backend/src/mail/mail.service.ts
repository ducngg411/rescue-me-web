import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

const APP_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const formatVND = (amount: number) =>
    amount.toLocaleString('vi-VN') + 'đ';

const formatDate = (date: Date) =>
    date.toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });

const paymentMethodLabel: Record<string, string> = {
    CASH: 'Tiền mặt',
    QR: 'Chuyển khoản QR',
    WALLET: 'Ví RescueMe',
};

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);

    constructor(private mailerService: MailerService) {}

    // ═══════════════════════════════════════════════════════════════════════════
    // ORIGINAL METHODS
    // ═══════════════════════════════════════════════════════════════════════════

    async sendWelcomeEmail(email: string, name: string) {
        try {
            await this.mailerService.sendMail({
                to: email,
                subject: 'Chào mừng đến với RescueMe! 🎉',
                template: 'welcome',
                context: { name: name || 'bạn', appUrl: APP_URL, year: new Date().getFullYear() },
            });
            this.logger.log(`Welcome email sent to ${email}`);
        } catch (error) {
            this.logger.error(`Failed to send welcome email to ${email}`, error);
        }
    }

    async sendPasswordResetEmail(email: string, name: string, token: string) {
        const resetUrl = `${APP_URL}/auth/reset-password?token=${token}`;
        try {
            await this.mailerService.sendMail({
                to: email,
                subject: 'Đặt lại mật khẩu RescueMe',
                template: 'reset-password',
                context: { name: name || 'bạn', resetUrl, expiresIn: '15 phút', year: new Date().getFullYear() },
            });
            this.logger.log(`Password reset email sent to ${email}`);
        } catch (error) {
            this.logger.error(`Failed to send password reset email to ${email}`, error);
            throw error;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // GROUP 1 — PROVIDER VERIFICATION
    // ═══════════════════════════════════════════════════════════════════════════

    /** Gửi khi provider nộp hồ sơ thành công (status → PENDING) */
    async sendVerificationSubmitted(email: string, name: string, submittedAt: Date) {
        try {
            await this.mailerService.sendMail({
                to: email,
                subject: '[RescueMe] Hồ sơ xác minh đã được tiếp nhận ✅',
                template: 'verification-submitted',
                context: {
                    name: name || 'bạn',
                    submittedAt: formatDate(submittedAt),
                    appUrl: APP_URL,
                    year: new Date().getFullYear(),
                },
            });
            this.logger.log(`Verification submitted email sent to ${email}`);
        } catch (error) {
            this.logger.error(`Failed to send verification submitted email to ${email}`, error);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // GROUP 2 — ADMIN ACTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /** Gửi khi admin duyệt provider */
    async sendProviderApproved(email: string, name: string) {
        try {
            await this.mailerService.sendMail({
                to: email,
                subject: '[RescueMe] Tài khoản nhà cứu hộ đã được phê duyệt! 🎉',
                template: 'provider-approved',
                context: { name: name || 'bạn', appUrl: APP_URL, year: new Date().getFullYear() },
            });
            this.logger.log(`Provider approved email sent to ${email}`);
        } catch (error) {
            this.logger.error(`Failed to send provider approved email to ${email}`, error);
        }
    }

    /** Gửi khi admin từ chối provider */
    async sendProviderRejected(
        email: string,
        name: string,
        reasonCode: string,
        reasonDetail: string,
    ) {
        try {
            await this.mailerService.sendMail({
                to: email,
                subject: '[RescueMe] Kết quả xét duyệt hồ sơ nhà cứu hộ',
                template: 'provider-rejected',
                context: {
                    name: name || 'bạn',
                    reasonCode,
                    reasonDetail,
                    appUrl: APP_URL,
                    year: new Date().getFullYear(),
                },
            });
            this.logger.log(`Provider rejected email sent to ${email}`);
        } catch (error) {
            this.logger.error(`Failed to send provider rejected email to ${email}`, error);
        }
    }

    /** Gửi khi admin tạm ngưng provider */
    async sendProviderSuspended(email: string, name: string, reason?: string) {
        try {
            await this.mailerService.sendMail({
                to: email,
                subject: '[RescueMe] Tài khoản nhà cứu hộ bị tạm ngưng',
                template: 'provider-suspended',
                context: {
                    name: name || 'bạn',
                    reason: reason || null,
                    appUrl: APP_URL,
                    year: new Date().getFullYear(),
                },
            });
            this.logger.log(`Provider suspended email sent to ${email}`);
        } catch (error) {
            this.logger.error(`Failed to send provider suspended email to ${email}`, error);
        }
    }

    /** Gửi khi admin mở lại tài khoản provider */
    async sendProviderUnsuspended(email: string, name: string) {
        try {
            await this.mailerService.sendMail({
                to: email,
                subject: '[RescueMe] Tài khoản nhà cứu hộ đã được mở lại 🔓',
                template: 'provider-unsuspended',
                context: { name: name || 'bạn', appUrl: APP_URL, year: new Date().getFullYear() },
            });
            this.logger.log(`Provider unsuspended email sent to ${email}`);
        } catch (error) {
            this.logger.error(`Failed to send provider unsuspended email to ${email}`, error);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // GROUP 3 — PAYMENT EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Biên nhận thanh toán — dùng chung cho user và provider
     * isProvider=true → tiêu đề "Thu nhập", isProvider=false → tiêu đề "Thanh toán"
     */
    async sendPaymentReceipt(params: {
        email: string;
        name: string;
        isProvider: boolean;
        requestId: string;
        amount: number;
        paymentMethod: string;
        completedAt: Date;
    }) {
        const { email, name, isProvider, requestId, amount, paymentMethod, completedAt } = params;
        try {
            await this.mailerService.sendMail({
                to: email,
                subject: isProvider
                    ? `[RescueMe] Biên nhận thu nhập job #${requestId.slice(0, 8).toUpperCase()}`
                    : `[RescueMe] Biên nhận thanh toán dịch vụ cứu hộ 🧾`,
                template: 'payment-receipt',
                context: {
                    name: name || 'bạn',
                    isProvider,
                    requestId: requestId.slice(0, 8).toUpperCase(),
                    amount: formatVND(amount),
                    paymentMethodLabel: paymentMethodLabel[paymentMethod] ?? paymentMethod,
                    completedAt: formatDate(completedAt),
                    appUrl: APP_URL,
                    year: new Date().getFullYear(),
                },
            });
            this.logger.log(`Payment receipt sent to ${email} (isProvider=${isProvider})`);
        } catch (error) {
            this.logger.error(`Failed to send payment receipt to ${email}`, error);
        }
    }

    /**
     * Tranh chấp thanh toán — gửi cho provider bị khiếu nại và admin
     * isAdmin=true → link admin disputes, isAdmin=false → link request detail
     */
    async sendPaymentDispute(params: {
        email: string;
        name: string;
        isAdmin: boolean;
        requestId: string;
        reason: string;
        disputedBy: string;
    }) {
        const { email, name, isAdmin, requestId, reason, disputedBy } = params;
        try {
            await this.mailerService.sendMail({
                to: email,
                subject: `[RescueMe] ⚖️ Tranh chấp thanh toán — Yêu cầu #${requestId.slice(0, 8).toUpperCase()}`,
                template: 'payment-dispute',
                context: {
                    name: name || 'bạn',
                    isAdmin,
                    requestId: requestId.slice(0, 8).toUpperCase(),
                    reason,
                    disputedBy,
                    appUrl: APP_URL,
                    year: new Date().getFullYear(),
                },
            });
            this.logger.log(`Payment dispute email sent to ${email} (isAdmin=${isAdmin})`);
        } catch (error) {
            this.logger.error(`Failed to send payment dispute email to ${email}`, error);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // GROUP 4 — WALLET TOPUP
    // ═══════════════════════════════════════════════════════════════════════════

    /** Biên nhận nạp tiền ví — dùng chung provider & user */
    async sendTopupReceipt(params: {
        email: string;
        name: string;
        amount: number;
        transferCode: string;
        completedAt: Date;
        walletUrl?: string; // optional override for provider vs user wallet URL
    }) {
        const { email, name, amount, transferCode, completedAt, walletUrl } = params;
        try {
            await this.mailerService.sendMail({
                to: email,
                subject: `[RescueMe] 💰 Nạp tiền thành công — ${formatVND(amount)}`,
                template: 'topup-receipt',
                context: {
                    name: name || 'bạn',
                    amount: formatVND(amount),
                    transferCode,
                    completedAt: formatDate(completedAt),
                    appUrl: walletUrl ?? APP_URL,
                    year: new Date().getFullYear(),
                },
            });
            this.logger.log(`Topup receipt sent to ${email} amount=${amount} code=${transferCode}`);
        } catch (error) {
            this.logger.error(`Failed to send topup receipt to ${email}`, error);
        }
    }
}
