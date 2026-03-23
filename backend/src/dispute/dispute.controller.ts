import {
    Controller,
    Get,
    Post,
    Param,
    Body,
    UseGuards,
    Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DisputeService, OpenDisputeDto, SendMessageDto } from './dispute.service';
import { IsNumber, IsString, IsOptional, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { DisputeMessageType, DisputeVisibility } from '@prisma/client';

class OpenDisputeBodyDto implements OpenDisputeDto {
    @IsString()
    orderId: string;

    @IsString()
    paymentId: string;

    @Type(() => Number)
    @IsNumber()
    @Min(1)
    targetAmount: number;

    @IsString()
    reason: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    expectedOutcome?: string;

    @IsOptional()
    @IsString({ each: true })
    attachmentUrls?: string[];
}

class SendMessageBodyDto implements SendMessageDto {
    @IsOptional()
    @IsString()
    body: string;

    @IsOptional()
    @IsEnum(DisputeMessageType)
    messageType?: DisputeMessageType;

    @IsOptional()
    @IsEnum(DisputeVisibility)
    visibility?: DisputeVisibility;

    @IsOptional()
    @IsString({ each: true })
    attachmentUrls?: string[];
}

@Controller('disputes')
@UseGuards(JwtAuthGuard)
export class DisputeController {
    constructor(private readonly disputeService: DisputeService) {}

    /**
     * POST /disputes
     * User or Provider opens a new dispute for an order/payment.
     */
    @Post()
    async openDispute(@Request() req, @Body() dto: OpenDisputeBodyDto) {
        const role = req.user.role === 'PROVIDER' ? 'PROVIDER' : 'CUSTOMER';
        return this.disputeService.openDispute(req.user.id, role, dto);
    }

    /**
     * GET /disputes/my
     * Customer's own disputes list.
     */
    @Get('my')
    async getMyDisputes(@Request() req) {
        return this.disputeService.getMyDisputes(req.user.id, 'CUSTOMER');
    }

    /**
     * GET /disputes/provider
     * Provider's related disputes list.
     */
    @Get('provider')
    async getProviderDisputes(@Request() req) {
        return this.disputeService.getMyDisputes(req.user.id, 'PROVIDER');
    }

    /**
     * GET /disputes/:id
     * Detail view. Permission-checked inside service.
     */
    @Get(':id')
    async getDisputeDetail(@Request() req, @Param('id') id: string) {
        const role =
            req.user.role === 'ADMIN'
                ? 'ADMIN'
                : req.user.role === 'PROVIDER'
                  ? 'PROVIDER'
                  : 'CUSTOMER';
        return this.disputeService.getDisputeDetail(id, req.user.id, role);
    }

    /**
     * POST /disputes/:id/messages
     * Send a message (and optionally attach evidence URLs) in a dispute.
     * Auto-transitions WAITING_* state when the expected party replies.
     */
    @Post(':id/messages')
    async sendMessage(
        @Request() req,
        @Param('id') id: string,
        @Body() dto: SendMessageBodyDto,
    ) {
        const role =
            req.user.role === 'ADMIN'
                ? 'ADMIN'
                : req.user.role === 'PROVIDER'
                  ? 'PROVIDER'
                  : 'CUSTOMER';
        return this.disputeService.sendMessage(id, req.user.id, role, dto);
    }
}
