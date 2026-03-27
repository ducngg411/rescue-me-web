import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RescueRequestController } from './rescue-request.controller';
import { RescueRequestService } from './rescue-request.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';
import { UserWalletModule } from '../user-wallet/user-wallet.module';
import { MailModule } from '../mail/mail.module';
import { DisputeModule } from '../dispute/dispute.module';
import { VietMapModule } from '../vietmap/vietmap.module';

@Module({
    imports: [PrismaModule, ScheduleModule.forRoot(), WalletModule, UserWalletModule, MailModule, DisputeModule, VietMapModule],
    controllers: [RescueRequestController],
    providers: [RescueRequestService],
    exports: [RescueRequestService],
})
export class RescueRequestModule { }
