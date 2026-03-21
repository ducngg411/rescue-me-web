import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);

    constructor(private mailerService: MailerService) {}

    async sendWelcomeEmail(email: string, name: string) {
        try {
            await this.mailerService.sendMail({
                to: email,
                subject: 'Chào mừng đến với RescueMe! 🎉',
                template: 'welcome',
                context: {
                    name: name || 'bạn',
                    appUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
                    year: new Date().getFullYear(),
                },
            });
            this.logger.log(`Welcome email sent to ${email}`);
        } catch (error) {
            this.logger.error(`Failed to send welcome email to ${email}`, error);
        }
    }

    async sendPasswordResetEmail(email: string, name: string, token: string) {
        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/reset-password?token=${token}`;
        try {
            await this.mailerService.sendMail({
                to: email,
                subject: 'Đặt lại mật khẩu RescueMe',
                template: 'reset-password',
                context: {
                    name: name || 'bạn',
                    resetUrl,
                    expiresIn: '15 phút',
                    year: new Date().getFullYear(),
                },
            });
            this.logger.log(`Password reset email sent to ${email}`);
        } catch (error) {
            this.logger.error(`Failed to send password reset email to ${email}`, error);
            throw error;
        }
    }
}
