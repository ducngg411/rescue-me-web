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
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateReviewDto } from './dto/create-review.dto';


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

    /**
     * Incident Map: Lấy danh sách điểm sự cố COMPLETED/CANCELLED để hiển thị trên bản đồ.
     * Dùng chung cho User và Provider (cả 2 đều dùng JwtAuthGuard).
     * NOTE: Phải đặt TRƯỚC route ':id' để không bị conflict.
     * GET /rescue-requests/incident-map
     */
    @Get('incident-map')
    async getIncidentMapData() {
        return this.rescueRequestService.getIncidentMapData();
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

    @Patch(':id/start-navigation')
    async startNavigation(@Request() req, @Param('id') requestId: string) {
        return this.rescueRequestService.startNavigation(requestId, req.user.id);
    }

    /** Provider báo đã đến nơi (chờ user xác nhận) */
    @Patch(':id/mark-arrived')
    async markArrived(@Request() req, @Param('id') requestId: string) {
        return this.rescueRequestService.markArrived(requestId, req.user.id);
    }

    /** User xác nhận provider đã đến → WORKING */
    @Patch(':id/confirm-arrival')
    async confirmArrival(@Request() req, @Param('id') requestId: string) {
        return this.rescueRequestService.confirmArrival(requestId, req.user.id);
    }

    /** User từ chối (provider chưa đến) → IN_PROGRESS */
    @Patch(':id/deny-arrival')
    async denyArrival(@Request() req, @Param('id') requestId: string) {
        return this.rescueRequestService.denyArrival(requestId, req.user.id);
    }

    @Patch(':id/complete-service')
    async completeService(@Request() req, @Param('id') requestId: string) {
        return this.rescueRequestService.completeService(requestId, req.user.id);
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

    // ==================== PAYMENT ENDPOINTS ====================

    /** Provider tạo yêu cầu thanh toán */
    @Post(':id/payment')
    async createPayment(
        @Request() req,
        @Param('id') requestId: string,
        @Body() dto: CreatePaymentDto,
    ) {
        return this.rescueRequestService.createPayment(requestId, req.user.id, dto);
    }

    /** Lấy thông tin payment (provider + user) */
    @Get(':id/payment')
    async getPayment(@Request() req, @Param('id') requestId: string) {
        return this.rescueRequestService.getPayment(requestId, req.user.id);
    }

    /** User xác nhận đã thanh toán tiền mặt */
    @Patch(':id/payment/confirm-sent')
    async confirmPaymentSent(@Request() req, @Param('id') requestId: string) {
        return this.rescueRequestService.confirmPaymentSent(requestId, req.user.id);
    }

    /** Provider xác nhận đã nhận được tiền */
    @Patch(':id/payment/confirm-received')
    async confirmPaymentReceived(@Request() req, @Param('id') requestId: string) {
        return this.rescueRequestService.confirmPaymentReceived(requestId, req.user.id);
    }

    /** User báo sự cố thanh toán */
    @Post(':id/payment/dispute')
    async disputePayment(
        @Request() req,
        @Param('id') requestId: string,
        @Body() body: { reason: string },
    ) {
        return this.rescueRequestService.disputePayment(requestId, req.user.id, body.reason);
    }

    // ==================== REVIEW ENDPOINT ====================

    /**
     * User gửi đánh giá cho provider sau khi hoàn thành dịch vụ
     * POST /rescue-requests/:id/review
     */
    @Post(':id/review')
    async submitReview(
        @Request() req,
        @Param('id') requestId: string,
        @Body() dto: CreateReviewDto,
    ) {
        return this.rescueRequestService.submitReview(requestId, req.user.id, dto);
    }

    // ==================== QR PAYMENT ENDPOINTS ====================

    /** Provider generates / retrieves QR code for job payment */
    @Post(':id/payment/qr/init')
    async initQrPayment(@Request() req, @Param('id') requestId: string) {
        return this.rescueRequestService.initQrPayment(requestId, req.user.id);
    }

    /** Provider polls QR payment status */
    @Get(':id/payment/qr/status')
    async getQrPaymentStatus(@Param('id') requestId: string) {
        return this.rescueRequestService.getQrPaymentStatus(requestId);
    }

    /** Provider switches payment method to CASH mid-flow */
    @Patch(':id/payment/switch-to-cash')
    async switchPaymentToCash(@Request() req, @Param('id') requestId: string) {
        return this.rescueRequestService.switchPaymentToCash(requestId, req.user.id);
    }

    /** Provider switches payment method to QR mid-flow */
    @Patch(':id/payment/switch-to-qr')
    async switchPaymentToQr(@Request() req, @Param('id') requestId: string) {
        return this.rescueRequestService.switchPaymentToQr(requestId, req.user.id);
    }

    /** User xác nhận thanh toán bằng ví (WALLET) → tự động trừ tiền + hoàn thành đơn */
    @Patch(':id/payment/wallet-confirm')
    async confirmWalletPayment(@Request() req, @Param('id') requestId: string) {
        return this.rescueRequestService.confirmWalletPayment(requestId, req.user.id);
    }
}
