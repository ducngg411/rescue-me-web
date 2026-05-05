import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private authService: AuthService,
        private prisma: PrismaService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET,
            passReqToCallback: true,
        } as any);
    }

    async validate(req: any, payload: any) {
        const rawToken = ExtractJwt.fromAuthHeaderAsBearerToken()(req);

        if (!rawToken) {
            throw new UnauthorizedException('Không có token');
        }

        // Kiểm tra session còn tồn tại trong DB (logout / rotation sẽ xóa row này)
        // Không cần check expiresAt — JWT exp + ignoreExpiration:false đã xử lý access token TTL
        const session = await this.prisma.session.findFirst({
            where: {
                token: rawToken,
                userId: payload.sub,
            },
        });

        if (!session) {
            throw new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc đã kết thúc');
        }

        const user = await this.authService.validateUser(payload.sub);
        if (!user) {
            throw new UnauthorizedException();
        }

        return user;
    }
}
