import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { OpenAIService } from './openai.service';
import { ToolExecutorService } from './tool-executor.service';
import { CustomerProfileDefaultsService } from './customer-profile-defaults.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GuestAuthModule } from '../guest-auth/guest-auth.module';
import { WalletModule } from '../wallet/wallet.module';
import { DisputeModule } from '../dispute/dispute.module';
import { UserWalletModule } from '../user-wallet/user-wallet.module';

@Module({
    imports: [PrismaModule, ConfigModule, GuestAuthModule, WalletModule, DisputeModule, UserWalletModule],
    controllers: [ChatbotController],
    providers: [
        ChatbotService,
        OpenAIService,
        ToolExecutorService,
        CustomerProfileDefaultsService,
    ],
})
export class ChatbotModule {}
