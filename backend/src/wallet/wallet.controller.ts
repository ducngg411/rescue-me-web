import {
    Controller,
    Get,
    Post,
    Param,
    Body,
    Query,
    UseGuards,
    Request,
    Headers,
    ParseIntPipe,
    DefaultValuePipe,
    BadRequestException,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { WalletService } from './wallet.service';
import { IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

class WithdrawDto {
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    amount: number;
}

class TopupInitDto {
    @Type(() => Number)
    @IsNumber()
    @Min(1) // TODO: restore @Min(100_000) after SePay testing
    amount: number;
}

@Controller('wallet')
export class WalletController {
    constructor(private readonly walletService: WalletService) { }

    /**
     * GET /wallet/me
     * Returns the provider's wallet (creates one if it doesn't exist yet).
     */
    @Get('me')
    @UseGuards(JwtAuthGuard)
    async getMyWallet(@Request() req) {
        return this.walletService.ensureWallet(req.user.id);
    }

    /**
     * GET /wallet/me/stats
     * Returns weekly earnings and job count for the authenticated provider.
     */
    @Get('me/stats')
    @UseGuards(JwtAuthGuard)
    async getMyStats(@Request() req) {
        return this.walletService.getWeeklyStats(req.user.id);
    }

    /**
     * GET /wallet/me/transactions?skip=0&take=15
     * Paginated transaction history for the current provider.
     */
    @Get('me/transactions')
    @UseGuards(JwtAuthGuard)
    async getMyTransactions(
        @Request() req,
        @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
        @Query('take', new DefaultValuePipe(15), ParseIntPipe) take: number,
    ) {
        const wallet = await this.walletService.ensureWallet(req.user.id);
        return this.walletService.getTransactions(wallet.id, { skip, take: Math.min(take, 50) });
    }

    /**
     * GET /wallet/me/transactions/:txId/details
     * Returns a single transaction with full linked job + media data.
     */
    @Get('me/transactions/:txId/details')
    @UseGuards(JwtAuthGuard)
    async getTxDetails(@Request() req, @Param('txId') txId: string) {
        const wallet = await this.walletService.ensureWallet(req.user.id);
        return this.walletService.getTxDetail(wallet.id, txId);
    }

    /**
     * POST /wallet/withdraw
     * Body: { amount: number }
     * Initiates a withdrawal request (status = PENDING, balance reserved).
     */
    @Post('withdraw')
    @UseGuards(JwtAuthGuard)
    async withdraw(@Request() req, @Body() dto: WithdrawDto) {
        const wallet = await this.walletService.ensureWallet(req.user.id);
        const referenceId = `withdraw-${req.user.id}-${Date.now()}`;
        return this.walletService.withdraw(wallet.id, dto.amount, referenceId);
    }

    // ─── Top-up (SePay) ───────────────────────────────────────────────────────

    /**
     * POST /wallet/topup/init
     * Provider calls this to get a QR code and pending topup transaction ID.
     * Body: { amount: number } — minimum 100,000 VND
     */
    @Post('topup/init')
    @UseGuards(JwtAuthGuard)
    async initTopup(@Request() req, @Body() dto: TopupInitDto) {
        return this.walletService.initTopup(req.user.id, dto.amount);
    }

    /**
     * POST /wallet/topup/webhook
     * SePay calls this when a bank transfer matches.
     * No JWT auth — SePay authenticates via "Authorization: Apikey <key>" header.
     */
    @Post('topup/webhook')
    @HttpCode(HttpStatus.OK)
    async sePayWebhook(
        @Body() body: any,
        @Headers('authorization') authHeader: string,
    ) {
        return this.walletService.processSePayWebhook(body, authHeader);
    }

    /**
     * GET /wallet/topup/pending
     * Returns the active PENDING topup tx for the provider (if any) so the
     * frontend can show a "resume payment" banner.
     * IMPORTANT: must be declared BEFORE topup/:txId/status to avoid param shadowing.
     */
    @Get('topup/pending')
    @UseGuards(JwtAuthGuard)
    async getPendingTopup(@Request() req) {
        return this.walletService.getPendingTopup(req.user.id);
    }

    /**
     * GET /wallet/topup/:txId/status
     * Provider polls this to check if their top-up was received.
     */
    @Get('topup/:txId/status')
    @UseGuards(JwtAuthGuard)
    async getTopupStatus(@Request() req, @Param('txId') txId: string) {
        return this.walletService.getTopupStatus(txId, req.user.id);
    }

    /**
     * POST /wallet/admin/release-pending
     * Admin-only: manually trigger autoReleaseHolding() without waiting for the cron.
     */
    @Post('admin/release-pending')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    async adminReleasePending() {
        await this.walletService.autoReleaseHolding();
        return { success: true, message: 'Auto-release triggered' };
    }
}
