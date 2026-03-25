import { Body, Controller, Delete, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { WithdrawalAccountsService } from './withdrawal-accounts.service';
import { CreateWithdrawalAccountDto } from './dto/create-withdrawal-account.dto';
import { UpdateWithdrawalAccountDto } from './dto/update-withdrawal-account.dto';

@Controller('me/withdrawal-accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('USER')
export class CustomerWithdrawalAccountsController {
  constructor(private readonly withdrawalAccountsService: WithdrawalAccountsService) { }

  @Get()
  async listCustomerAccounts(@Request() req: any) {
    const accounts = await this.withdrawalAccountsService.listCustomerAccounts(req.user.id);
    return { success: true, data: accounts };
  }

  @Post()
  async createCustomerAccount(@Request() req: any, @Body() dto: CreateWithdrawalAccountDto) {
    const created = await this.withdrawalAccountsService.createCustomerAccount(req.user.id, dto);
    return { success: true, data: created };
  }

  @Patch(':id')
  async updateCustomerAccount(
    @Request() req: any,
    @Param('id') accountId: string,
    @Body() dto: UpdateWithdrawalAccountDto,
  ) {
    const updated = await this.withdrawalAccountsService.updateCustomerAccount(req.user.id, accountId, dto);
    return { success: true, data: updated };
  }

  @Delete(':id')
  async deleteCustomerAccount(@Request() req: any, @Param('id') accountId: string) {
    await this.withdrawalAccountsService.deleteCustomerAccount(req.user.id, accountId);
    return { success: true, message: 'Deleted' };
  }
}

