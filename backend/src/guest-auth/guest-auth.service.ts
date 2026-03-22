import {
    Injectable,
    Logger,
    UnauthorizedException,
    BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from '../firebase/firebase.service';
import { VerifyPhoneDto } from './dto/guest-auth.dto';

@Injectable()
export class GuestAuthService {
    private readonly logger = new Logger(GuestAuthService.name);

    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
        private firebaseService: FirebaseService,
    ) {}

    async verifyPhone(dto: VerifyPhoneDto, ipAddress?: string) {
        let phoneNumber: string;
        try {
            const result = await this.firebaseService.verifyPhoneToken(dto.firebaseIdToken);
            phoneNumber = result.phoneNumber;
        } catch (err) {
            this.logger.warn(`Firebase phone verification failed: ${err.message}`);
            throw new UnauthorizedException('Xác minh số điện thoại thất bại');
        }

        const phoneNormalized = this.normalizePhone(phoneNumber);

        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const session = await this.prisma.guestSession.create({
            data: {
                phoneNormalized,
                phoneVerifiedAt: new Date(),
                expiresAt,
                deviceId: dto.deviceId ?? null,
                lastIp: ipAddress ?? null,
            },
        });

        const token = this.issueGuestToken(session.id, phoneNormalized);

        this.logger.log(`Guest session created: ${session.id} for phone ${phoneNormalized}`);

        return {
            accessToken: token,
            expiresAt: session.expiresAt,
            guestSessionId: session.id,
            phone: phoneNormalized,
        };
    }

    async refreshToken(guestSessionId: string) {
        const session = await this.prisma.guestSession.findUnique({
            where: { id: guestSessionId },
        });

        if (!session || session.isConverted) {
            throw new UnauthorizedException('Phiên khách không hợp lệ');
        }

        if (session.expiresAt < new Date()) {
            throw new UnauthorizedException('Phiên khách đã hết hạn');
        }

        const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await this.prisma.guestSession.update({
            where: { id: guestSessionId },
            data: { expiresAt: newExpiresAt },
        });

        const token = this.issueGuestToken(session.id, session.phoneNormalized);
        return { accessToken: token, expiresAt: newExpiresAt };
    }

    async logout(guestSessionId: string) {
        await this.prisma.guestSession.update({
            where: { id: guestSessionId },
            data: { expiresAt: new Date() },
        });
        return { message: 'Đã đăng xuất khỏi phiên khách' };
    }

    async convertToUser(guestSessionId: string, userAccessToken: string) {
        const payload = this.jwtService.decode(userAccessToken) as any;
        if (!payload?.sub || payload?.type === 'GUEST') {
            throw new BadRequestException('Token người dùng không hợp lệ');
        }

        const userId = payload.sub;

        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new BadRequestException('Người dùng không tồn tại');
        }

        const session = await this.prisma.guestSession.findUnique({
            where: { id: guestSessionId },
        });

        if (!session || session.isConverted) {
            throw new BadRequestException('Phiên khách đã được chuyển đổi hoặc không tồn tại');
        }

        await this.prisma.$transaction([
            this.prisma.rescueRequest.updateMany({
                where: { guestSessionId },
                data: { userId, requesterType: 'USER', guestSessionId: null },
            }),
            this.prisma.payment.updateMany({
                where: { guestSessionId },
                data: { userId, guestSessionId: null },
            }),
            this.prisma.guestSession.update({
                where: { id: guestSessionId },
                data: { isConverted: true, convertedUserId: userId },
            }),
        ]);

        this.logger.log(`Guest session ${guestSessionId} converted to user ${userId}`);
        return { message: 'Tài khoản đã được liên kết thành công', userId };
    }

    private issueGuestToken(guestSessionId: string, phone: string): string {
        return this.jwtService.sign(
            { sub: guestSessionId, type: 'GUEST', phone },
            { expiresIn: '24h' },
        );
    }

    private normalizePhone(phone: string): string {
        let normalized = phone.replace(/\s+/g, '');
        if (normalized.startsWith('+84')) {
            normalized = '0' + normalized.slice(3);
        }
        return normalized;
    }
}
