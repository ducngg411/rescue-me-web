import { Module } from '@nestjs/common';
import { ProviderController } from './provider.controller';
import { ProviderService } from './provider.service';
import { PrismaModule } from '../prisma/prisma.module';
import { VietMapModule } from '../vietmap/vietmap.module';

@Module({
    imports: [PrismaModule, VietMapModule],
    controllers: [ProviderController],
    providers: [ProviderService],
    exports: [ProviderService],
})
export class ProviderModule { }
