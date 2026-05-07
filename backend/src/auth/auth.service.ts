import {
    Injectable,
    Logger,
    ConflictException,
    UnauthorizedException,
    BadRequestException,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { OAuth2Client } from 'google-auth-library';
import {
    RegisterEmailDto,
    LoginEmailDto,
    CompleteProfileDto,
    SelectRoleDto,
    ChangePasswordDto,
    ForgotPasswordEmailDto,
    ForgotPasswordPhoneDto,
    ResetPasswordDto,
} from './dto/auth.dto';
import { AuthProvider, ResetType, User } from '@prisma/client';
import { MailService } from '../mail/mail.service';
import { FirebaseService } from '../firebase/firebase.service';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);
    private googleClient: OAuth2Client;

    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
        private mailService: MailService,
        private firebaseService: FirebaseService,
    ) {
        this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    }

    // ==================== EMAIL REGISTRATION ====================
    async registerWithEmail(dto: RegisterEmailDto) {
        const existingUser = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (existingUser) {
            throw new ConflictException('Email đã được sử dụng');
        }

        const hashedPassword = await bcrypt.hash(dto.password, 10);

        const user = await this.prisma.user.create({
            data: {
                email: dto.email,
                name: dto.name,
                hashedPassword,
                authProvider: AuthProvider.EMAIL,
                profileCompleted: false,
            },
        });

        // Gửi welcome email ngay sau khi đăng ký (fire-and-forget)
        this.mailService.sendWelcomeEmail(user.email, user.name || user.email).catch(() => {});

        const tokens = await this.createSession(user);

        return {
            user: this.sanitizeUser(user), // Filter out private fields (hashedPassword, googleId)
            tokens,
            requiresProfileCompletion: true,
        };
    }

    // ==================== EMAIL LOGIN ====================
    async loginWithEmail(dto: LoginEmailDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (!user) {
            throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
        }

        if (user.authProvider !== AuthProvider.EMAIL) {
            throw new BadRequestException(
                'Tài khoản này được tạo bằng Google. Vui lòng đăng nhập bằng Google',
            );
        }

        if (user.bannedAt) {
            throw new ForbiddenException(
                `ACCOUNT_BANNED::${user.banReason || 'Vi phạm điều khoản sử dụng'}`,
            );
        }

        const isPasswordValid = await bcrypt.compare(
            dto.password,
            user.hashedPassword || '',
        );

        if (!isPasswordValid) {
            throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
        }

        await this.prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() },
        });

        const tokens = await this.createSession(user);

        return {
            user: this.sanitizeUser(user),
            tokens,
            requiresProfileCompletion: !user.profileCompleted,
        };
    }

    // ==================== GOOGLE AUTH ====================
    async loginWithGoogle(idToken: string) {
        try {
            const ticket = await this.googleClient.verifyIdToken({
                idToken,
                audience: process.env.GOOGLE_CLIENT_ID,
            });

            const payload = ticket.getPayload();
            if (!payload || !payload.email) {
                throw new UnauthorizedException('Google token không hợp lệ');
            }

            const { email, name, picture, sub: googleId } = payload;

            let user = await this.prisma.user.findUnique({
                where: { email },
            });

            let isNewUser = false;

            if (!user) {
                user = await this.prisma.user.create({
                    data: {
                        email,
                        name,
                        avatar: picture,
                        googleId,
                        authProvider: AuthProvider.GOOGLE,
                        profileCompleted: false,
                    },
                });
                isNewUser = true;
                // Gửi welcome email cho Google user mới
                this.mailService.sendWelcomeEmail(email, name || email).catch(() => {});
            } else {
                if (user.bannedAt) {
                    throw new ForbiddenException(
                        `ACCOUNT_BANNED::${user.banReason || 'Vi phạm điều khoản sử dụng'}`,
                    );
                }
                await this.prisma.user.update({
                    where: { id: user.id },
                    data: { lastLogin: new Date() },
                });
            }

            const tokens = await this.createSession(user);

            return {
                user: this.sanitizeUser(user),
                tokens,
                requiresProfileCompletion: !user.profileCompleted,
                isNewUser,
            };
        } catch (error) {
            throw new UnauthorizedException('Xác thực Google thất bại');
        }
    }

    // ==================== PROFILE COMPLETION ====================
    async completeProfile(userId: string, dto: CompleteProfileDto) {
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: {
                name: dto.name,
                profileCompleted: true,
            },
        });

        return this.sanitizeUser(user);
    }

    // ==================== FORGOT PASSWORD — EMAIL ====================
    async forgotPasswordByEmail(dto: ForgotPasswordEmailDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (!user) {
            throw new NotFoundException('Email này chưa được đăng ký trong hệ thống.');
        }

        if (user.authProvider !== AuthProvider.EMAIL) {
            throw new BadRequestException(
                'Tài khoản này được tạo bằng Google. Vui lòng đăng nhập bằng Google.',
            );
        }

        // Xóa các token cũ chưa dùng của user
        await this.prisma.passwordResetToken.deleteMany({
            where: { userId: user.id, type: ResetType.EMAIL, used: false },
        });

        const token = uuidv4();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

        await this.prisma.passwordResetToken.create({
            data: {
                userId: user.id,
                token,
                type: ResetType.EMAIL,
                expiresAt,
            },
        });

        try {
            await this.mailService.sendPasswordResetEmail(
                user.email,
                user.name || user.email,
                token,
            );
        } catch (err) {
            // SMTP/template errors must not become 500: same generic response as "email not found"
            this.logger.error(
                `Password reset email failed for ${user.email}`,
                err instanceof Error ? err.stack : err,
            );
        }

        return { message: 'Email đặt lại mật khẩu đã được gửi.' };
    }

    // ==================== FORGOT PASSWORD — PHONE (Firebase) ====================
    async forgotPasswordByPhone(dto: ForgotPasswordPhoneDto) {
        // Verify Firebase token và lấy phoneNumber
        let phoneNumber: string;
        try {
            const result = await this.firebaseService.verifyPhoneToken(dto.firebaseIdToken);
            phoneNumber = result.phoneNumber;
        } catch (error) {
            throw new UnauthorizedException('Firebase token không hợp lệ hoặc đã hết hạn');
        }

        // Chuẩn hóa số điện thoại: Firebase trả về +84xxxxxxxxx, convert về 0xxxxxxxxx
        const normalizedPhone = phoneNumber.startsWith('+84')
            ? '0' + phoneNumber.slice(3)
            : phoneNumber;

        const user = await this.prisma.user.findFirst({
            where: { phoneNumber: normalizedPhone },
        });

        if (!user) {
            throw new NotFoundException('Không tìm thấy tài khoản với số điện thoại này');
        }

        // Xóa các token cũ chưa dùng của user
        await this.prisma.passwordResetToken.deleteMany({
            where: { userId: user.id, type: ResetType.PHONE, used: false },
        });

        const resetToken = uuidv4();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

        await this.prisma.passwordResetToken.create({
            data: {
                userId: user.id,
                token: resetToken,
                type: ResetType.PHONE,
                expiresAt,
            },
        });

        return {
            message: 'Xác thực điện thoại thành công',
            resetToken,
        };
    }

    // ==================== RESET PASSWORD ====================
    async resetPassword(dto: ResetPasswordDto) {
        const resetToken = await this.prisma.passwordResetToken.findUnique({
            where: { token: dto.token },
            include: { user: true },
        });

        if (!resetToken) {
            throw new BadRequestException('Token không hợp lệ hoặc đã được sử dụng');
        }

        if (resetToken.used) {
            throw new BadRequestException('Token đã được sử dụng');
        }

        if (resetToken.expiresAt < new Date()) {
            await this.prisma.passwordResetToken.delete({ where: { id: resetToken.id } });
            throw new BadRequestException('Token đã hết hạn. Vui lòng yêu cầu đặt lại mật khẩu mới');
        }

        const user = resetToken.user;

        if (user.authProvider !== AuthProvider.EMAIL) {
            throw new BadRequestException('Tài khoản Google không thể đặt lại mật khẩu bằng cách này');
        }

        const newHashedPassword = await bcrypt.hash(dto.newPassword, 10);

        // Cập nhật password và đánh dấu token đã dùng (transaction)
        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: user.id },
                data: { hashedPassword: newHashedPassword },
            }),
            this.prisma.passwordResetToken.update({
                where: { id: resetToken.id },
                data: { used: true },
            }),
            // Xóa toàn bộ session cũ để buộc đăng nhập lại
            this.prisma.session.deleteMany({
                where: { userId: user.id },
            }),
        ]);

        return { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.' };
    }

    // ==================== SESSION & TOKEN MANAGEMENT ====================

    /** Parse JWT TTL string (e.g. "7d", "2h", "3600") sang milliseconds */
    private parseTtlMs(ttl: string | undefined, fallbackMs: number): number {
        if (!ttl) return fallbackMs;
        const num = parseInt(ttl, 10);
        if (isNaN(num)) return fallbackMs;
        if (/d$/i.test(ttl)) return num * 86_400_000;
        if (/h$/i.test(ttl)) return num * 3_600_000;
        if (/m$/i.test(ttl)) return num * 60_000;
        return num * 1_000; // seconds (plain number)
    }

    private async createSession(user: User) {
        const accessToken = this.jwtService.sign(
            { sub: user.id, email: user.email, role: user.role },
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
        );

        const refreshToken = this.jwtService.sign(
            { sub: user.id, type: 'refresh' },
            { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' },
        );

        // expiresAt bám theo refresh TTL — session sống được bao lâu thì refresh token còn dùng được
        const refreshTtlMs = this.parseTtlMs(
            process.env.JWT_REFRESH_EXPIRES_IN,
            30 * 24 * 60 * 60 * 1000, // 30d fallback
        );

        // Chỉ dọn session đã hết hạn, giữ nguyên session của các thiết bị khác
        await this.prisma.$transaction([
            this.prisma.session.deleteMany({
                where: { userId: user.id, expiresAt: { lt: new Date() } },
            }),
            this.prisma.session.create({
                data: {
                    userId: user.id,
                    token: accessToken,
                    refreshToken,
                    expiresAt: new Date(Date.now() + refreshTtlMs),
                },
            }),
        ]);

        return { accessToken, refreshToken };
    }

    async validateUser(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new UnauthorizedException('User không tồn tại');
        }

        if (user.bannedAt) {
            throw new ForbiddenException(
                `ACCOUNT_BANNED::${user.banReason || 'Vi phạm điều khoản sử dụng'}`,
            );
        }

        return this.sanitizeUser(user);
    }

    async logout(userId: string, token: string) {
        await this.prisma.session.deleteMany({
            where: {
                userId,
                token,
            },
        });

        return { message: 'Đăng xuất thành công' };
    }

    async refreshTokens(refreshToken: string) {
        // 1. Xác minh chữ ký JWT
        let payload: { sub: string; type: string };
        try {
            payload = this.jwtService.verify(refreshToken);
        } catch {
            throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
        }

        if (payload.type !== 'refresh') {
            throw new UnauthorizedException('Token không phải refresh token');
        }

        // 2. Tìm session khớp với refreshToken và chưa hết hạn (chống token reuse)
        const session = await this.prisma.session.findFirst({
            where: {
                userId: payload.sub,
                refreshToken,
                expiresAt: { gt: new Date() },
            },
        });

        if (!session) {
            throw new UnauthorizedException('Phiên đăng nhập không tồn tại hoặc đã bị thu hồi');
        }

        // 3. Kiểm tra user vẫn hợp lệ (không bị ban)
        const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
        if (!user) {
            throw new UnauthorizedException('User không tồn tại');
        }
        if (user.bannedAt) {
            throw new ForbiddenException(
                `ACCOUNT_BANNED::${user.banReason || 'Vi phạm điều khoản sử dụng'}`,
            );
        }

        // 4. Phát hành token mới (rotation)
        const newAccessToken = this.jwtService.sign(
            { sub: user.id, email: user.email, role: user.role },
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
        );
        const newRefreshToken = this.jwtService.sign(
            { sub: user.id, type: 'refresh' },
            { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' },
        );

        // 5. Cập nhật session (xóa cũ, tạo mới để giữ unique constraint trên token)
        const refreshTtlMs = this.parseTtlMs(
            process.env.JWT_REFRESH_EXPIRES_IN,
            30 * 24 * 60 * 60 * 1000, // 30d fallback
        );
        await this.prisma.$transaction([
            this.prisma.session.delete({ where: { id: session.id } }),
            this.prisma.session.create({
                data: {
                    userId: user.id,
                    token: newAccessToken,
                    refreshToken: newRefreshToken,
                    expiresAt: new Date(Date.now() + refreshTtlMs),
                },
            }),
        ]);

        return {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
        };
    }

    // ==================== ROLE SELECTION ====================
    async selectRole(userId: string, dto: SelectRoleDto) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new UnauthorizedException('User không tồn tại');
        }

        if (user.profileCompleted) {
            throw new BadRequestException('Không thể thay đổi role sau khi hoàn thành profile');
        }

        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: { role: dto.role },
        });

        return {
            user: this.sanitizeUser(updatedUser),
            message: 'Cập nhật role thành công',
        };
    }

    // ==================== CHANGE PASSWORD ====================
    async changePassword(userId: string, dto: ChangePasswordDto) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });

        if (!user) {
            throw new UnauthorizedException('User không tồn tại');
        }

        if (user.authProvider !== AuthProvider.EMAIL) {
            throw new BadRequestException('Tài khoản đăng nhập bằng Google không thể đổi mật khẩu');
        }

        const isOldPasswordValid = await bcrypt.compare(dto.oldPassword, user.hashedPassword || '');
        if (!isOldPasswordValid) {
            throw new UnauthorizedException('Mật khẩu cũ không chính xác');
        }

        const newHashedPassword = await bcrypt.hash(dto.newPassword, 10);
        await this.prisma.user.update({
            where: { id: userId },
            data: { hashedPassword: newHashedPassword },
        });

        return { message: 'Đổi mật khẩu thành công' };
    }

    // ==================== HELPER METHODS ====================
    private sanitizeUser(user: User) {
        const { hashedPassword, ...sanitized } = user;
        return sanitized;
    }
}
