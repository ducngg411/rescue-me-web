import {
    Controller,
    Get,
    Post,
    Body,
    Query,
    UseGuards,
    Request,
    ParseIntPipe,
    DefaultValuePipe,
    BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WalletService } from './wallet.service';
import { IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

class WithdrawDto {
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    amount: number;
}

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
    constructor(private readonly walletService: WalletService) { }

    /**
     * GET /wallet/me
     * Returns the provider's wallet (creates one if it doesn't exist yet).
     */
    @Get('me')
    async getMyWallet(@Request() req) {
        return this.walletService.ensureWallet(req.user.id);
    }

    /**
     * GET /wallet/me/transactions?skip=0&take=15
     * Paginated transaction history for the current provider.
     */
    @Get('me/transactions')
    async getMyTransactions(
        @Request() req,
        @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
        @Query('take', new DefaultValuePipe(15), ParseIntPipe) take: number,
    ) {
        const wallet = await this.walletService.ensureWallet(req.user.id);
        return this.walletService.getTransactions(wallet.id, { skip, take: Math.min(take, 50) });
    }

    /**
     * POST /wallet/withdraw
     * Body: { amount: number }
     * Initiates a withdrawal request (status = PENDING, balance reserved).
     */
    @Post('withdraw')
    async withdraw(@Request() req, @Body() dto: WithdrawDto) {
        const wallet = await this.walletService.ensureWallet(req.user.id);
        const referenceId = `withdraw-${req.user.id}-${Date.now()}`;
        return this.walletService.withdraw(wallet.id, dto.amount, referenceId);
    }
}
