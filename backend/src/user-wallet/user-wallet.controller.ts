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
import { UserWalletService } from './user-wallet.service';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

class WithdrawDto {
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    amount: number;

    @IsOptional()
    @IsString()
    withdrawalAccountId?: string;
}

class TopupInitDto {
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    amount: number;
}

@Controller('user-wallet')
export class UserWalletController {
    constructor(private readonly userWalletService: UserWalletService) { }

    /**
     * GET /user-wallet/me
     * Returns (or creates) the user's wallet.
     */
    @Get('me')
    @UseGuards(JwtAuthGuard)
    async getMyWallet(@Request() req) {
        return this.userWalletService.ensureWallet(req.user.id);
    }

    /**
     * GET /user-wallet/me/transactions?skip=0&take=15
     */
    @Get('me/transactions')
    @UseGuards(JwtAuthGuard)
    async getMyTransactions(
        @Request() req,
        @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
        @Query('take', new DefaultValuePipe(15), ParseIntPipe) take: number,
    ) {
        const wallet = await this.userWalletService.ensureWallet(req.user.id);
        return this.userWalletService.getTransactions(wallet.id, { skip, take: Math.min(take, 50) });
    }

    /**
     * POST /user-wallet/withdraw
     */
    @Post('withdraw')
    @UseGuards(JwtAuthGuard)
    async withdraw(@Request() req, @Body() dto: WithdrawDto) {
        const wallet = await this.userWalletService.ensureWallet(req.user.id);
        const referenceId = `user-withdraw-${req.user.id}-${Date.now()}`;
        return this.userWalletService.withdraw(wallet.id, dto.amount, referenceId, dto.withdrawalAccountId);
    }

    /**
     * GET /user-wallet/topup/pending
     * Must be declared BEFORE /user-wallet/topup/:txId/status.
     */
    @Get('topup/pending')
    @UseGuards(JwtAuthGuard)
    async getPendingTopup(@Request() req) {
        return this.userWalletService.getPendingTopup(req.user.id);
    }

    /**
     * POST /user-wallet/topup/init
     */
    @Post('topup/init')
    @UseGuards(JwtAuthGuard)
    async initTopup(@Request() req, @Body() dto: TopupInitDto) {
        return this.userWalletService.initTopup(req.user.id, dto.amount);
    }

    /**
     * POST /user-wallet/topup/webhook
     * SePay calls this when a bank transfer matches.
     */
    @Post('topup/webhook')
    @HttpCode(HttpStatus.OK)
    async sePayWebhook(
        @Body() body: any,
        @Headers('authorization') authHeader: string,
    ) {
        return this.userWalletService.processSePayWebhook(body, authHeader);
    }

    /**
     * GET /user-wallet/topup/:txId/status
     */
    @Get('topup/:txId/status')
    @UseGuards(JwtAuthGuard)
    async getTopupStatus(@Request() req, @Param('txId') txId: string) {
        return this.userWalletService.getTopupStatus(txId, req.user.id);
    }
}
