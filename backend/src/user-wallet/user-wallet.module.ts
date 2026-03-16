import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { UserWalletService } from './user-wallet.service';
import { UserWalletController } from './user-wallet.controller';

@Module({
    imports: [PrismaModule, ConfigModule],
    controllers: [UserWalletController],
    providers: [UserWalletService],
    exports: [UserWalletService],
})
export class UserWalletModule { }
