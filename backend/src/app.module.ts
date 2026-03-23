import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ProviderModule } from './provider/provider.module';
import { UploadsModule } from './uploads/uploads.module';
import { AdminModule } from './admin/admin.module';
import { RescueRequestModule } from './rescue-request/rescue-request.module';
import { VietMapModule } from './vietmap/vietmap.module';
import { WalletModule } from './wallet/wallet.module';
import { UserWalletModule } from './user-wallet/user-wallet.module';
import { FirebaseModule } from './firebase/firebase.module';
import { GuestAuthModule } from './guest-auth/guest-auth.module';
import { GuestRescueModule } from './guest-rescue/guest-rescue.module';
import { DisputeModule } from './dispute/dispute.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Default is cwd-relative; running from another folder (IDE/monorepo) skips backend/.env.
      envFilePath: [
        join(__dirname, '..', '..', '.env'),
        join(process.cwd(), '.env'),
      ],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    VietMapModule,
    FirebaseModule,
    AuthModule,
    UserModule,
    ProviderModule,
    UploadsModule,
    AdminModule,
    RescueRequestModule,
    WalletModule,
    UserWalletModule,
    GuestAuthModule,
    GuestRescueModule,
    DisputeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
