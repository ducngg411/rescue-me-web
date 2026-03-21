import { Module } from '@nestjs/common';
import { ProviderController } from './provider.controller';
import { ProviderService } from './provider.service';
import { PrismaModule } from '../prisma/prisma.module';
import { VietMapModule } from '../vietmap/vietmap.module';
import { MailModule } from '../mail/mail.module';

@Module({
    imports: [PrismaModule, VietMapModule, MailModule],
    controllers: [ProviderController],
    providers: [ProviderService],
    exports: [ProviderService],
})
export class ProviderModule { }
