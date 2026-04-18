import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { UserRole, BankCode } from '@prisma/client';
import { WithdrawalAccountsService } from './withdrawal-accounts.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  user: { findUnique: jest.fn() },
  providerWithdrawalAccount: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  customerWithdrawalAccount: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const mockAccountDto = {
  accountNumber: '1234567890',
  bankCode: BankCode.VCB,
  bankName: 'Vietcombank',
  branchName: null,
  accountHolderName: 'NGUYEN VAN A',
};

const mockProviderAccount = {
  id: 'pa-001',
  providerId: 'provider-456',
  ...mockAccountDto,
  createdAt: new Date(),
};

const mockCustomerAccount = {
  id: 'ca-001',
  userId: 'user-123',
  ...mockAccountDto,
  createdAt: new Date(),
};

describe('WithdrawalAccountsService', () => {
  let service: WithdrawalAccountsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WithdrawalAccountsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<WithdrawalAccountsService>(WithdrawalAccountsService);
    jest.clearAllMocks();
  });

  // ── Provider accounts ──────────────────────────────────────────────────────

  describe('listProviderAccounts', () => {
    it('returns all withdrawal accounts for a provider', async () => {
      mockPrisma.providerWithdrawalAccount.findMany.mockResolvedValue([mockProviderAccount]);

      const result = await service.listProviderAccounts('provider-456');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('pa-001');
    });
  });

  describe('createProviderAccount', () => {
    it('creates a bank account for a PROVIDER', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: UserRole.PROVIDER });
      mockPrisma.providerWithdrawalAccount.create.mockResolvedValue(mockProviderAccount);

      const result = await service.createProviderAccount('provider-456', mockAccountDto);

      expect(result.accountNumber).toBe('1234567890');
    });

    it('throws NotFoundException when provider does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createProviderAccount('bad-id', mockAccountDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user is not a PROVIDER', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: UserRole.USER });

      await expect(
        service.createProviderAccount('user-123', mockAccountDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateProviderAccount', () => {
    it('updates an existing provider account', async () => {
      mockPrisma.providerWithdrawalAccount.findFirst.mockResolvedValue(mockProviderAccount);
      mockPrisma.providerWithdrawalAccount.update.mockResolvedValue({
        ...mockProviderAccount,
        bankName: 'Vietinbank',
      });

      const result = await service.updateProviderAccount('provider-456', 'pa-001', {
        ...mockAccountDto,
        bankName: 'Vietinbank',
      });

      expect(result.bankName).toBe('Vietinbank');
    });

    it('throws NotFoundException when account not found', async () => {
      mockPrisma.providerWithdrawalAccount.findFirst.mockResolvedValue(null);

      await expect(
        service.updateProviderAccount('provider-456', 'bad-id', mockAccountDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteProviderAccount', () => {
    it('deletes an existing provider account', async () => {
      mockPrisma.providerWithdrawalAccount.findFirst.mockResolvedValue({ id: 'pa-001' });
      mockPrisma.providerWithdrawalAccount.delete.mockResolvedValue({});

      const result = await service.deleteProviderAccount('provider-456', 'pa-001');

      expect(result.success).toBe(true);
    });

    it('throws NotFoundException when account not found', async () => {
      mockPrisma.providerWithdrawalAccount.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteProviderAccount('provider-456', 'bad-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Customer accounts ──────────────────────────────────────────────────────

  describe('listCustomerAccounts', () => {
    it('returns all withdrawal accounts for a customer', async () => {
      mockPrisma.customerWithdrawalAccount.findMany.mockResolvedValue([mockCustomerAccount]);

      const result = await service.listCustomerAccounts('user-123');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('ca-001');
    });
  });

  describe('createCustomerAccount', () => {
    it('creates a bank account for a USER', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: UserRole.USER });
      mockPrisma.customerWithdrawalAccount.create.mockResolvedValue(mockCustomerAccount);

      const result = await service.createCustomerAccount('user-123', mockAccountDto);

      expect(result.accountHolderName).toBe('NGUYEN VAN A');
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createCustomerAccount('bad-id', mockAccountDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateCustomerAccount', () => {
    it('updates an existing customer account', async () => {
      mockPrisma.customerWithdrawalAccount.findFirst.mockResolvedValue(mockCustomerAccount);
      mockPrisma.customerWithdrawalAccount.update.mockResolvedValue({
        ...mockCustomerAccount,
        accountNumber: '9999999999',
      });

      const result = await service.updateCustomerAccount('user-123', 'ca-001', mockAccountDto);

      expect(result).toBeDefined();
    });

    it('throws NotFoundException when account not found', async () => {
      mockPrisma.customerWithdrawalAccount.findFirst.mockResolvedValue(null);

      await expect(
        service.updateCustomerAccount('user-123', 'bad-id', mockAccountDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteCustomerAccount', () => {
    it('deletes an existing customer account', async () => {
      mockPrisma.customerWithdrawalAccount.findFirst.mockResolvedValue({ id: 'ca-001' });
      mockPrisma.customerWithdrawalAccount.delete.mockResolvedValue({});

      const result = await service.deleteCustomerAccount('user-123', 'ca-001');

      expect(result.success).toBe(true);
    });

    it('throws NotFoundException when account not found', async () => {
      mockPrisma.customerWithdrawalAccount.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteCustomerAccount('user-123', 'bad-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
