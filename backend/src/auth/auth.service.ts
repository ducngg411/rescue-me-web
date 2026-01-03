import {
    Injectable,
    ConflictException,
    UnauthorizedException,
    BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { RegisterEmailDto, LoginEmailDto, CompleteProfileDto } from './dto/auth.dto';
import { AuthProvider, User } from '@prisma/client';

@Injectable()
export class AuthService {
    private googleClient: OAuth2Client;

    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
    ) {
        this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    }

    // ==================== EMAIL REGISTRATION ====================
    async registerWithEmail(dto: RegisterEmailDto) {
        // Kiểm tra email đã tồn tại
        const existingUser = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (existingUser) {
            throw new ConflictException('Email đã được sử dụng');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(dto.password, 10);

        // Tạo user mới
        const user = await this.prisma.user.create({
            data: {
                email: dto.email,
                name: dto.name,
                hashedPassword,
                authProvider: AuthProvider.EMAIL,
                profileCompleted: false,
            },
        });

        // Tạo session và tokens
        const tokens = await this.createSession(user);

        return {
            user: this.sanitizeUser(user),
            tokens,
            requiresProfileCompletion: true,
        };
    }

    // ==================== EMAIL LOGIN ====================
    async loginWithEmail(dto: LoginEmailDto) {
        // Tìm user
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (!user) {
            throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
        }

        // Kiểm tra authProvider
        if (user.authProvider !== AuthProvider.EMAIL) {
            throw new BadRequestException(
                'Tài khoản này được tạo bằng Google. Vui lòng đăng nhập bằng Google',
            );
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(
            dto.password,
            user.hashedPassword || '',
        );

        if (!isPasswordValid) {
            throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
        }

        // Update last login
        await this.prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() },
        });

        // Tạo session và tokens
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
            // Verify Google ID Token
            const ticket = await this.googleClient.verifyIdToken({
                idToken,
                audience: process.env.GOOGLE_CLIENT_ID,
            });

            const payload = ticket.getPayload();
            if (!payload || !payload.email) {
                throw new UnauthorizedException('Google token không hợp lệ');
            }

            const { email, name, picture, sub: googleId } = payload;

            // Tìm hoặc tạo user
            let user = await this.prisma.user.findUnique({
                where: { email },
            });

            let isNewUser = false;

            if (!user) {
                // Tạo user mới
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
            } else {
                // Update last login
                await this.prisma.user.update({
                    where: { id: user.id },
                    data: { lastLogin: new Date() },
                });
            }

            // Tạo session và tokens
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
                phone: dto.phone,
                address: dto.address,
                emergencyContact: dto.emergencyContact,
                profileCompleted: true,
            },
        });

        return this.sanitizeUser(user);
    }

    // ==================== SESSION & TOKEN MANAGEMENT ====================
    private async createSession(user: User) {
        const accessToken = this.jwtService.sign(
            { sub: user.id, email: user.email, role: user.role },
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
        );

        const refreshToken = this.jwtService.sign(
            { sub: user.id, type: 'refresh' },
            { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' },
        );

        // Lưu session vào database
        await this.prisma.session.create({
            data: {
                userId: user.id,
                token: accessToken,
                refreshToken,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            },
        });

        return {
            accessToken,
            refreshToken,
        };
    }

    async validateUser(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new UnauthorizedException('User không tồn tại');
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

    // ==================== HELPER METHODS ====================
    private sanitizeUser(user: User) {
        const { hashedPassword, ...sanitized } = user;
        return sanitized;
    }
}
