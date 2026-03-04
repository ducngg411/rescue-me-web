import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RescueRequestController } from './rescue-request.controller';
import { RescueRequestService } from './rescue-request.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
    imports: [PrismaModule, ScheduleModule.forRoot(), WalletModule],
    controllers: [RescueRequestController],
    providers: [RescueRequestService],
    exports: [RescueRequestService],
})
export class RescueRequestModule { }
