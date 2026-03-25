import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { WithdrawalAccountsService } from './withdrawal-accounts.service';
import { CreateWithdrawalAccountDto } from './dto/create-withdrawal-account.dto';
import { UpdateWithdrawalAccountDto } from './dto/update-withdrawal-account.dto';

@Controller('me/provider/withdrawal-accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PROVIDER')
export class ProviderWithdrawalAccountsController {
  constructor(private readonly withdrawalAccountsService: WithdrawalAccountsService) { }

  @Get()
  async listProviderAccounts(@Request() req: any) {
    const accounts = await this.withdrawalAccountsService.listProviderAccounts(req.user.id);
    return { success: true, data: accounts };
  }

  @Post()
  async createProviderAccount(@Request() req: any, @Body() dto: CreateWithdrawalAccountDto) {
    const created = await this.withdrawalAccountsService.createProviderAccount(req.user.id, dto);
    return { success: true, data: created };
  }

  @Patch(':id')
  async updateProviderAccount(
    @Request() req: any,
    @Param('id') accountId: string,
    @Body() dto: UpdateWithdrawalAccountDto,
  ) {
    const updated = await this.withdrawalAccountsService.updateProviderAccount(req.user.id, accountId, dto);
    return { success: true, data: updated };
  }

  @Delete(':id')
  async deleteProviderAccount(@Request() req: any, @Param('id') accountId: string) {
    await this.withdrawalAccountsService.deleteProviderAccount(req.user.id, accountId);
    return { success: true, message: 'Deleted' };
  }
}

