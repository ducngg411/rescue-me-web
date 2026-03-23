import { Module } from '@nestjs/common';
import { DisputeController } from './dispute.controller';
import { DisputeService } from './dispute.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';

@Module({
    imports: [PrismaModule, MailModule],
    controllers: [DisputeController],
    providers: [DisputeService],
    exports: [DisputeService],
})
export class DisputeModule {}
