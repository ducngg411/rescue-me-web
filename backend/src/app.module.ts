import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    VietMapModule,
    AuthModule,
    UserModule,
    ProviderModule,
    UploadsModule,
    AdminModule,
    RescueRequestModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
