import { Module } from '@nestjs/common';
import { DisputeController } from './dispute.controller';
import { DisputeService } from './dispute.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
    imports: [PrismaModule, MailModule, WalletModule],
    controllers: [DisputeController],
    providers: [DisputeService],
    exports: [DisputeService],
})
export class DisputeModule {}
