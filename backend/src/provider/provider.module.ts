import { Module } from '@nestjs/common';
import { ProviderController } from './provider.controller';
import { ProviderService } from './provider.service';
import { NearbyShopsController } from './nearby-shops.controller';
import { NearbyShopsService } from './nearby-shops.service';
import { PrismaModule } from '../prisma/prisma.module';
import { VietMapModule } from '../vietmap/vietmap.module';
import { MailModule } from '../mail/mail.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
    imports: [PrismaModule, VietMapModule, MailModule, WalletModule],
    controllers: [ProviderController, NearbyShopsController],
    providers: [ProviderService, NearbyShopsService],
    exports: [ProviderService],
})
export class ProviderModule { }
