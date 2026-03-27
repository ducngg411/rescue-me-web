import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { OpenAIService } from './openai.service';
import { ToolExecutorService } from './tool-executor.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GuestAuthModule } from '../guest-auth/guest-auth.module';

@Module({
    imports: [PrismaModule, ConfigModule, GuestAuthModule],
    controllers: [ChatbotController],
    providers: [ChatbotService, OpenAIService, ToolExecutorService],
})
export class ChatbotModule {}
