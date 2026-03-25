import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WithdrawalAccountsService } from './withdrawal-accounts.service';
import { ProviderWithdrawalAccountsController } from './provider-withdrawal-accounts.controller';
import { CustomerWithdrawalAccountsController } from './customer-withdrawal-accounts.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ProviderWithdrawalAccountsController, CustomerWithdrawalAccountsController],
  providers: [WithdrawalAccountsService],
  exports: [WithdrawalAccountsService],
})
export class WithdrawalAccountsModule { }

