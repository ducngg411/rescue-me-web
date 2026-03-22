import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GuestAuthController } from './guest-auth.controller';
import { GuestAuthService } from './guest-auth.service';
import { GuestJwtStrategy } from './strategies/guest-jwt.strategy';
import { PrismaModule } from '../prisma/prisma.module';
import { FirebaseModule } from '../firebase/firebase.module';

@Module({
    imports: [
        PrismaModule,
        PassportModule,
        FirebaseModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                secret: configService.get('JWT_SECRET') || 'your-secret-key',
                signOptions: { expiresIn: '24h' },
            }),
            inject: [ConfigService],
        }),
    ],
    controllers: [GuestAuthController],
    providers: [GuestAuthService, GuestJwtStrategy],
    exports: [GuestAuthService, GuestJwtStrategy],
})
export class GuestAuthModule {}
