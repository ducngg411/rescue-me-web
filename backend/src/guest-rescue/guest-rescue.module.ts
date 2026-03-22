import { Module } from '@nestjs/common';
import { GuestRescueController } from './guest-rescue.controller';
import { GuestRescueService } from './guest-rescue.service';
import { GuestAuthModule } from '../guest-auth/guest-auth.module';
import { RescueRequestModule } from '../rescue-request/rescue-request.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
    imports: [PrismaModule, GuestAuthModule, RescueRequestModule, UploadsModule],
    controllers: [GuestRescueController],
    providers: [GuestRescueService],
})
export class GuestRescueModule {}
