import {
    Controller,
    Post,
    Get,
    Patch,
    Param,
    Body,
    UseGuards,
    Request,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GuestJwtGuard } from '../guest-auth/guards/guest-jwt.guard';
import { GuestRescueService } from './guest-rescue.service';
import { CreateRescueRequestDto } from '../rescue-request/dto/create-rescue-request.dto';
import { RespondQuoteDto } from '../rescue-request/dto/respond-quote.dto';
import { UploadsService } from '../uploads/uploads.service';

@ApiTags('GuestRescue')
@Controller('guest')
@UseGuards(GuestJwtGuard)
export class GuestRescueController {
    constructor(
        private guestRescueService: GuestRescueService,
        private uploadsService: UploadsService,
    ) {}

    // ==================== UPLOAD ENDPOINTS ====================

    @Post('uploads/presign')
    @HttpCode(HttpStatus.OK)
    async presignUpload(
        @Request() req,
        @Body() body: { fileName: string; fileSize: number; contentType: string },
    ) {
        return this.uploadsService.presignGuestUpload(req.user.guestSessionId, body);
    }

    @Post('uploads/confirm')
    @HttpCode(HttpStatus.OK)
    async confirmUpload() {
        return { success: true };
    }

    // ==================== RESCUE REQUEST ENDPOINTS ====================

    @Post('rescue-requests')
    @HttpCode(HttpStatus.CREATED)
    async createRescueRequest(@Request() req, @Body() dto: CreateRescueRequestDto) {
        return this.guestRescueService.createRescueRequest(req.user.guestSessionId, dto);
    }

    @Get('rescue-requests/:id/status')
    async getRequestStatus(@Request() req, @Param('id') id: string) {
        return this.guestRescueService.getRequestStatus(id, req.user.guestSessionId);
    }

    @Patch('rescue-requests/:id/cancel')
    async cancelRequest(@Request() req, @Param('id') id: string) {
        return this.guestRescueService.cancelRequest(id, req.user.guestSessionId);
    }

    @Get('rescue-requests/:id/quotes')
    async getQuotes(@Request() req, @Param('id') id: string) {
        return this.guestRescueService.getQuotes(id, req.user.guestSessionId);
    }

    @Patch('rescue-requests/:id/quotes/:quoteId/respond')
    async respondToQuote(
        @Request() req,
        @Param('id') id: string,
        @Param('quoteId') quoteId: string,
        @Body() dto: RespondQuoteDto,
    ) {
        return this.guestRescueService.respondToQuote(
            id,
            quoteId,
            req.user.guestSessionId,
            dto.action as 'ACCEPT' | 'REJECT',
        );
    }

    @Get('rescue-requests/:id/payment')
    async getPayment(@Request() req, @Param('id') id: string) {
        return this.guestRescueService.getPayment(id, req.user.guestSessionId);
    }

    @Patch('rescue-requests/:id/payment/confirm-sent')
    async confirmPaymentSent(@Request() req, @Param('id') id: string) {
        return this.guestRescueService.confirmPaymentSent(id, req.user.guestSessionId);
    }

    @Get('rescue-requests/:id/payment/qr/status')
    async getQrPaymentStatus(@Request() req, @Param('id') id: string) {
        return this.guestRescueService.getQrPaymentStatus(id, req.user.guestSessionId);
    }

    @Patch('rescue-requests/:id/confirm-arrival')
    async confirmArrival(@Request() req, @Param('id') id: string) {
        return this.guestRescueService.confirmArrival(id, req.user.guestSessionId);
    }

    @Patch('rescue-requests/:id/deny-arrival')
    async denyArrival(@Request() req, @Param('id') id: string) {
        return this.guestRescueService.denyArrival(id, req.user.guestSessionId);
    }
}
