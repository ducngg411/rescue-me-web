import {
    Controller,
    Post,
    Get,
    Delete,
    Param,
    Body,
    UseGuards,
    Request,
    Res,
    HttpCode,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GuestJwtGuard } from '../guest-auth/guards/guest-jwt.guard';
import { ChatbotService } from './chatbot.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatbotRateLimitGuard } from './guards/chatbot-rate-limit.guard';

/**
 * Resolves caller identity from JWT request object.
 * Works for both regular users (JwtAuthGuard) and guests (GuestJwtGuard).
 */
function resolveCallerIdentity(req: any) {
    if (req.user?.guestSessionId) {
        return {
            guestSessionId: req.user.guestSessionId,
            userRole: 'GUEST' as const,
        };
    }
    return {
        userId: req.user.id || req.user.sub,
        userRole: (req.user.role || 'USER') as 'USER' | 'PROVIDER',
    };
}

@Controller('chatbot')
export class ChatbotController {
    constructor(private chatbotService: ChatbotService) {}

    // ────────────── Authenticated User / Provider endpoints ──────────────

    @Post('conversations')
    @UseGuards(JwtAuthGuard)
    async createConversation(
        @Request() req,
        @Body() dto: CreateConversationDto,
    ) {
        return this.chatbotService.createConversation(
            resolveCallerIdentity(req),
            dto.title,
        );
    }

    @Get('conversations')
    @UseGuards(JwtAuthGuard)
    async listConversations(@Request() req) {
        return this.chatbotService.listConversations(resolveCallerIdentity(req));
    }

    @Get('conversations/:id')
    @UseGuards(JwtAuthGuard)
    async getConversation(@Request() req, @Param('id') id: string) {
        return this.chatbotService.getConversation(resolveCallerIdentity(req), id);
    }

    @Delete('conversations/:id')
    @UseGuards(JwtAuthGuard)
    @HttpCode(200)
    async deleteConversation(@Request() req, @Param('id') id: string) {
        return this.chatbotService.deleteConversation(resolveCallerIdentity(req), id);
    }

    @Post('conversations/:id/messages')
    @UseGuards(JwtAuthGuard, ChatbotRateLimitGuard)
    async sendMessage(
        @Request() req,
        @Param('id') id: string,
        @Body() dto: SendMessageDto,
        @Res() res: Response,
    ) {
        const caller = resolveCallerIdentity(req);
        const subject = await this.chatbotService.sendMessage(
            caller,
            id,
            dto.content,
            dto.imageUrls,
        );

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        const subscription = subject.subscribe({
            next: (event) => {
                res.write(`data: ${JSON.stringify(event)}\n\n`);
            },
            complete: () => {
                res.write('data: [DONE]\n\n');
                res.end();
            },
            error: (err) => {
                res.write(
                    `data: ${JSON.stringify({ type: 'error', content: err.message })}\n\n`,
                );
                res.write('data: [DONE]\n\n');
                res.end();
            },
        });

        req.on('close', () => {
            subscription.unsubscribe();
        });
    }

    // ────────────── Guest endpoints ──────────────

    @Post('guest/conversations')
    @UseGuards(GuestJwtGuard)
    async createGuestConversation(
        @Request() req,
        @Body() dto: CreateConversationDto,
    ) {
        return this.chatbotService.createConversation(
            resolveCallerIdentity(req),
            dto.title,
        );
    }

    @Get('guest/conversations')
    @UseGuards(GuestJwtGuard)
    async listGuestConversations(@Request() req) {
        return this.chatbotService.listConversations(resolveCallerIdentity(req));
    }

    @Get('guest/conversations/:id')
    @UseGuards(GuestJwtGuard)
    async getGuestConversation(@Request() req, @Param('id') id: string) {
        return this.chatbotService.getConversation(resolveCallerIdentity(req), id);
    }

    @Delete('guest/conversations/:id')
    @UseGuards(GuestJwtGuard)
    @HttpCode(200)
    async deleteGuestConversation(@Request() req, @Param('id') id: string) {
        return this.chatbotService.deleteConversation(resolveCallerIdentity(req), id);
    }

    @Post('guest/conversations/:id/messages')
    @UseGuards(GuestJwtGuard, ChatbotRateLimitGuard)
    async sendGuestMessage(
        @Request() req,
        @Param('id') id: string,
        @Body() dto: SendMessageDto,
        @Res() res: Response,
    ) {
        const caller = resolveCallerIdentity(req);
        const subject = await this.chatbotService.sendMessage(
            caller,
            id,
            dto.content,
            dto.imageUrls,
        );

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        const subscription = subject.subscribe({
            next: (event) => {
                res.write(`data: ${JSON.stringify(event)}\n\n`);
            },
            complete: () => {
                res.write('data: [DONE]\n\n');
                res.end();
            },
            error: (err) => {
                res.write(
                    `data: ${JSON.stringify({ type: 'error', content: err.message })}\n\n`,
                );
                res.write('data: [DONE]\n\n');
                res.end();
            },
        });

        req.on('close', () => {
            subscription.unsubscribe();
        });
    }
}
