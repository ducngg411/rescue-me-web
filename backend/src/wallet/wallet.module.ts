import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletService } from './wallet.service';
import { CommissionService } from './commission.service';
import { EscrowScheduler } from './escrow.scheduler';
import { WalletController } from './wallet.controller';

@Module({
    imports: [PrismaModule, ScheduleModule.forRoot()],
    controllers: [WalletController],
    providers: [WalletService, CommissionService, EscrowScheduler],
    exports: [WalletService, CommissionService, EscrowScheduler],
})
export class WalletModule { }

