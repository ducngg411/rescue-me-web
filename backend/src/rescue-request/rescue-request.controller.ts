import {
    Controller,
    Post,
    Get,
    Patch,
    Param,
    Body,
    UseGuards,
    Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RescueRequestService } from './rescue-request.service';
import { CreateRescueRequestDto } from './dto/create-rescue-request.dto';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { RespondQuoteDto } from './dto/respond-quote.dto';

@Controller('rescue-requests')
@UseGuards(JwtAuthGuard)
export class RescueRequestController {
    constructor(private rescueRequestService: RescueRequestService) { }

    @Post()
    async createRescueRequest(
        @Request() req,
        @Body() createRescueRequestDto: CreateRescueRequestDto,
    ) {
        return this.rescueRequestService.createRescueRequest(
            req.user.id,
            createRescueRequestDto,
        );
    }

    /**
     * Provider xem danh sách quotes đã gửi
     * GET /rescue-requests/provider/quotes
     * NOTE: This must be before GET :id to avoid route conflict
     */
    @Get('provider/quotes')
    async getProviderQuotes(@Request() req) {
        return this.rescueRequestService.getProviderQuotes(req.user.id);
    }

    @Get()
    async getUserRescueRequests(@Request() req) {
        return this.rescueRequestService.getUserRescueRequests(req.user.id);
    }

    @Get(':id')
    async getRescueRequestById(@Request() req, @Param('id') id: string) {
        return this.rescueRequestService.getRescueRequestById(id, req.user.id);
    }

    /**
     * Provider xem chi tiết request để gửi báo giá
     * GET /rescue-requests/:id/provider-view
     */
    @Get(':id/provider-view')
    async getRequestForProvider(@Request() req, @Param('id') id: string) {
        return this.rescueRequestService.getRequestForProvider(id, req.user.id);
    }

    @Get(':id/status')
    async getRequestStatus(@Request() req, @Param('id') id: string) {
        return this.rescueRequestService.getRequestStatus(id, req.user.id);
    }

    @Patch(':id/cancel')
    async cancelRescueRequest(@Request() req, @Param('id') id: string) {
        return this.rescueRequestService.cancelRescueRequest(id, req.user.id);
    }

    @Post(':id/retry')
    async retryRescueRequest(@Request() req, @Param('id') id: string) {
        return this.rescueRequestService.retryRescueRequest(id, req.user.id);
    }

    // Manual trigger expire check (for testing/debugging)
    @Post('admin/expire-check')
    async manualExpireCheck() {
        return this.rescueRequestService.checkAndExpireRequests();
    }

    /**
     * Provider decline request - không muốn nhận request này nữa
     * POST /rescue-requests/:id/decline
     */
    @Post(':id/decline')
    async declineRequest(@Request() req, @Param('id') requestId: string) {
        return this.rescueRequestService.declineRequest(requestId, req.user.id);
    }

    // ==================== QUOTE ENDPOINTS ====================

    /**
     * P2: Provider gửi báo giá cho rescue request
     * POST /rescue-requests/:id/quotes
     */
    @Post(':id/quotes')
    async createQuote(
        @Request() req,
        @Param('id') requestId: string,
        @Body() createQuoteDto: CreateQuoteDto,
    ) {
        return this.rescueRequestService.createQuote(
            requestId,
            req.user.id,
            createQuoteDto,
        );
    }

    /**
     * U3: User xem danh sách báo giá cho rescue request
     * GET /rescue-requests/:id/quotes
     */
    @Get(':id/quotes')
    async getQuotesByRequest(@Request() req, @Param('id') requestId: string) {
        return this.rescueRequestService.getQuotesByRequest(
            requestId,
            req.user.id,
        );
    }

    /**
     * U3: User accept/reject báo giá
     * PATCH /rescue-requests/:id/quotes/:quoteId/respond
     */
    @Patch(':id/quotes/:quoteId/respond')
    async respondQuote(
        @Request() req,
        @Param('id') requestId: string,
        @Param('quoteId') quoteId: string,
        @Body() respondQuoteDto: RespondQuoteDto,
    ) {
        return this.rescueRequestService.respondQuote(
            requestId,
            quoteId,
            req.user.id,
            respondQuoteDto.action,
            respondQuoteDto.rejectionReason,
        );
    }
}
