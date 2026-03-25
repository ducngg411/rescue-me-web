import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWithdrawalAccountDto } from './dto/create-withdrawal-account.dto';
import { BankCode, UserRole } from '@prisma/client';

type ProviderOrCustomer = 'provider' | 'customer';

@Injectable()
export class WithdrawalAccountsService {
  constructor(private readonly prisma: PrismaService) { }

  // ── Provider ──────────────────────────────────────────────────────────────

  async listProviderAccounts(providerId: string) {
    return this.prisma.providerWithdrawalAccount.findMany({
      where: { providerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createProviderAccount(providerId: string, dto: CreateWithdrawalAccountDto) {
    const user = await this.prisma.user.findUnique({ where: { id: providerId }, select: { role: true } });
    if (!user) throw new NotFoundException('Provider not found');
    if (user.role !== UserRole.PROVIDER) throw new ForbiddenException('Only providers can create withdrawal accounts');

    return this.prisma.providerWithdrawalAccount.create({
      data: {
        providerId,
        accountNumber: dto.accountNumber,
        bankCode: dto.bankCode,
        bankName: dto.bankName,
        branchName: dto.branchName,
        accountHolderName: dto.accountHolderName,
      },
    });
  }

  async updateProviderAccount(providerId: string, accountId: string, dto: CreateWithdrawalAccountDto) {
    const existing = await this.prisma.providerWithdrawalAccount.findFirst({
      where: { id: accountId, providerId },
    });

    if (!existing) throw new NotFoundException('Withdrawal account not found');

    return this.prisma.providerWithdrawalAccount.update({
      where: { id: accountId },
      data: {
        accountNumber: dto.accountNumber,
        bankCode: dto.bankCode,
        bankName: dto.bankName,
        branchName: dto.branchName,
        accountHolderName: dto.accountHolderName,
      },
    });
  }

  async deleteProviderAccount(providerId: string, accountId: string) {
    const existing = await this.prisma.providerWithdrawalAccount.findFirst({
      where: { id: accountId, providerId },
      select: { id: true },
    });

    if (!existing) throw new NotFoundException('Withdrawal account not found');

    await this.prisma.providerWithdrawalAccount.delete({ where: { id: accountId } });
    return { success: true };
  }

  // ── Customer ──────────────────────────────────────────────────────────────

  async listCustomerAccounts(customerId: string) {
    return this.prisma.customerWithdrawalAccount.findMany({
      where: { userId: customerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCustomerAccount(customerId: string, dto: CreateWithdrawalAccountDto) {
    const user = await this.prisma.user.findUnique({ where: { id: customerId }, select: { role: true } });
    if (!user) throw new NotFoundException('Customer not found');
    if (user.role !== UserRole.USER) throw new ForbiddenException('Only users can create withdrawal accounts');

    return this.prisma.customerWithdrawalAccount.create({
      data: {
        userId: customerId,
        accountNumber: dto.accountNumber,
        bankCode: dto.bankCode,
        bankName: dto.bankName,
        branchName: dto.branchName,
        accountHolderName: dto.accountHolderName,
      },
    });
  }

  async updateCustomerAccount(customerId: string, accountId: string, dto: CreateWithdrawalAccountDto) {
    const existing = await this.prisma.customerWithdrawalAccount.findFirst({
      where: { id: accountId, userId: customerId },
    });

    if (!existing) throw new NotFoundException('Withdrawal account not found');

    return this.prisma.customerWithdrawalAccount.update({
      where: { id: accountId },
      data: {
        accountNumber: dto.accountNumber,
        bankCode: dto.bankCode,
        bankName: dto.bankName,
        branchName: dto.branchName,
        accountHolderName: dto.accountHolderName,
      },
    });
  }

  async deleteCustomerAccount(customerId: string, accountId: string) {
    const existing = await this.prisma.customerWithdrawalAccount.findFirst({
      where: { id: accountId, userId: customerId },
      select: { id: true },
    });

    if (!existing) throw new NotFoundException('Withdrawal account not found');

    await this.prisma.customerWithdrawalAccount.delete({ where: { id: accountId } });
    return { success: true };
  }

  // ── Helpers for wallet withdrawals ───────────────────────────────────────

  async getProviderWithdrawalAccountOrThrow(providerId: string, accountId: string) {
    const acc = await this.prisma.providerWithdrawalAccount.findFirst({
      where: { id: accountId, providerId },
    });
    if (!acc) throw new BadRequestException('Withdrawal account not found');
    return acc;
  }

  async getCustomerWithdrawalAccountOrThrow(customerId: string, accountId: string) {
    const acc = await this.prisma.customerWithdrawalAccount.findFirst({
      where: { id: accountId, userId: customerId },
    });
    if (!acc) throw new BadRequestException('Withdrawal account not found');
    return acc;
  }
}

