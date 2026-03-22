import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

export interface GuestPayload {
    sub: string;
    type: string;
    phone: string;
}

@Injectable()
export class GuestJwtStrategy extends PassportStrategy(Strategy, 'jwt-guest') {
    constructor(private prisma: PrismaService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
        });
    }

    async validate(payload: GuestPayload) {
        if (payload.type !== 'GUEST') {
            throw new UnauthorizedException('Invalid guest token');
        }

        const session = await this.prisma.guestSession.findUnique({
            where: { id: payload.sub },
        });

        if (!session || session.expiresAt < new Date() || session.isConverted) {
            throw new UnauthorizedException('Guest session expired or converted');
        }

        return { guestSessionId: session.id, phone: session.phoneNormalized };
    }
}
