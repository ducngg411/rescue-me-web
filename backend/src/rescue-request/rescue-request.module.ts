import { Module } from '@nestjs/common';
import { RescueRequestController } from './rescue-request.controller';
import { RescueRequestService } from './rescue-request.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [RescueRequestController],
    providers: [RescueRequestService],
    exports: [RescueRequestService],
})
export class RescueRequestModule { }
