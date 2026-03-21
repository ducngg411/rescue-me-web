import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletService } from './wallet.service';
import { CommissionService } from './commission.service';
import { EscrowScheduler } from './escrow.scheduler';
import { WalletController } from './wallet.controller';
import { MailModule } from '../mail/mail.module';

@Module({
    imports: [PrismaModule, ScheduleModule.forRoot(), ConfigModule, MailModule],
    controllers: [WalletController],
    providers: [WalletService, CommissionService, EscrowScheduler],
    exports: [WalletService, CommissionService, EscrowScheduler],
})
export class WalletModule { }

