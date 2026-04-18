import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UserWalletService } from './user-wallet.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';

jest.mock('../common/business-codes', () => ({
  allocateUniqueUserWalletTxnCode: jest.fn().mockResolvedValue('UWX-001'),
  allocateUniqueUserTopupTransferCode: jest.fn().mockResolvedValue('RU-ABCD123'),
  allocateUniqueUserTopupTxnCode: jest.fn().mockResolvedValue('TNU-001'),
}));

const mockPrisma = {
  userWallet: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
  userWalletTransaction: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  userTopupTransaction: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  topupTransaction: {
    findUnique: jest.fn(),
  },
  jobPaymentTransaction: {
    findUnique: jest.fn(),
  },
  customerWithdrawalAccount: {
    findFirst: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn().mockImplementation((fn) =>
    Array.isArray(fn) ? Promise.all(fn) : fn(mockPrisma),
  ),
};

const mockConfigService = {
  get: jest.fn((key: string, def?: string) => {
    const map: Record<string, string> = {
      SEPAY_API_KEY: 'user-api-key',
      SEPAY_BANK_ACCOUNT: '07729096901',
      SEPAY_BANK_CODE: 'TPBank',
    };
    return map[key] ?? def;
  }),
};

const mockMailService = {
  sendTopupReceipt: jest.fn().mockResolvedValue(undefined),
  sendWithdrawalRequested: jest.fn().mockResolvedValue(undefined),
};

const mockWallet = {
  id: 'user-wallet-abc',
  userId: 'user-123',
  availableBalance: 300000,
  pendingBalance: 0,
};

describe('UserWalletService', () => {
  let service: UserWalletService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserWalletService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<UserWalletService>(UserWalletService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((fn) =>
      Array.isArray(fn) ? Promise.all(fn) : fn(mockPrisma),
    );
    mockPrisma.userWallet.upsert.mockResolvedValue(mockWallet);
  });

  // ── ensureWallet ───────────────────────────────────────────────────────────

  describe('ensureWallet', () => {
    it('creates user wallet lazily', async () => {
      mockPrisma.userWallet.upsert.mockResolvedValue(mockWallet);

      const result = await service.ensureWallet('user-123');

      expect(result.userId).toBe('user-123');
      expect(mockPrisma.userWallet.upsert).toHaveBeenCalled();
    });
  });

  // ── getTransactions ────────────────────────────────────────────────────────

  describe('getTransactions', () => {
    it('returns paginated transactions', async () => {
      mockPrisma.$transaction.mockResolvedValue([[{ id: 'txn-1' }], 1]);

      const result = await service.getTransactions('user-wallet-abc', { skip: 0, take: 10 });

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
    });
  });

  // ── initTopup ──────────────────────────────────────────────────────────────

  describe('initTopup', () => {
    it('creates a new PENDING user topup transaction', async () => {
      mockPrisma.userTopupTransaction.findFirst.mockResolvedValue(null);
      mockPrisma.userTopupTransaction.create.mockResolvedValue({
        id: 'user-topup-1',
        amount: 200000,
        transferCode: 'RU-ABCD123',
        txnCode: 'TNU-001',
        expireAt: new Date(Date.now() + 300_000),
      });

      const result = await service.initTopup('user-123', 200000);

      expect(result.transferCode).toBe('RU-ABCD123');
      expect(result.isReuse).toBe(false);
    });

    it('throws BadRequestException when amount is zero', async () => {
      await expect(service.initTopup('user-123', 0)).rejects.toThrow(BadRequestException);
    });
  });

  // ── getTopupStatus ─────────────────────────────────────────────────────────

  describe('getTopupStatus', () => {
    it('returns COMPLETED status for finished topup', async () => {
      mockPrisma.userTopupTransaction.findFirst.mockResolvedValue({
        id: 'topup-u-1',
        status: 'COMPLETED',
        amount: 200000,
        expireAt: new Date(Date.now() + 300_000),
        completedAt: new Date(),
      });

      const result = await service.getTopupStatus('topup-u-1', 'user-123');

      expect(result.status).toBe('COMPLETED');
    });

    it('throws NotFoundException when topup transaction does not exist', async () => {
      mockPrisma.userTopupTransaction.findFirst.mockResolvedValue(null);

      await expect(service.getTopupStatus('bad-id', 'user-123')).rejects.toThrow(NotFoundException);
    });
  });

  // ── getPendingTopup ────────────────────────────────────────────────────────

  describe('getPendingTopup', () => {
    it('returns active pending topup', async () => {
      mockPrisma.userTopupTransaction.findFirst.mockResolvedValue({
        id: 'topup-u-2',
        transferCode: 'RU-XYZ789',
        amount: 150000,
        expireAt: new Date(Date.now() + 200_000),
        txnCode: 'TNU-002',
      });

      const result = await service.getPendingTopup('user-123');

      expect(result?.transferCode).toBe('RU-XYZ789');
    });

    it('returns null when no pending topup exists', async () => {
      mockPrisma.userTopupTransaction.findFirst.mockResolvedValue(null);

      const result = await service.getPendingTopup('user-123');

      expect(result).toBeNull();
    });
  });

  // ── withdraw ───────────────────────────────────────────────────────────────

  describe('withdraw', () => {
    it('initiates withdrawal and reserves balance', async () => {
      mockPrisma.userWallet.findUnique.mockResolvedValue(mockWallet);
      mockPrisma.user.findUnique.mockResolvedValue({ email: 'user@test.com', fullName: 'Test User' });
      mockPrisma.customerWithdrawalAccount.findFirst.mockResolvedValue(null);
      mockPrisma.userWalletTransaction.create.mockResolvedValue({
        id: 'txn-wd-1',
        txnCode: 'UWX-001',
        status: 'PENDING',
        referenceId: 'wd-ref-001',
        createdAt: new Date(),
      });
      mockPrisma.userWallet.update.mockResolvedValue({ ...mockWallet, availableBalance: 200000 });

      const result = await service.withdraw('user-wallet-abc', 100000, 'wd-ref-001');

      expect(result.transaction.status).toBe('PENDING');
    });

    it('throws BadRequestException when balance is insufficient', async () => {
      mockPrisma.userWallet.findUnique.mockResolvedValue({ ...mockWallet, availableBalance: 10000 });
      mockPrisma.user.findUnique.mockResolvedValue({ email: 'user@test.com', fullName: 'Test User' });

      await expect(service.withdraw('user-wallet-abc', 100000, 'wd-ref')).rejects.toThrow(BadRequestException);
    });
  });

  // ── processSePayWebhook ────────────────────────────────────────────────────

  describe('processSePayWebhook', () => {
    it('returns Already processed for duplicate sepayId (idempotency)', async () => {
      mockPrisma.userTopupTransaction.findUnique.mockResolvedValue({ id: 'existing', status: 'COMPLETED' });

      const result = await service.processSePayWebhook(
        {
          id: 99999,
          content: 'RU-ABCD123 payment',
          transferType: 'in',
          transferAmount: 200000,
        },
        'Apikey user-api-key',
      );

      expect(result.message).toBe('Already processed');
    });

    it('throws UnauthorizedException when API key is invalid', async () => {
      await expect(
        service.processSePayWebhook({ id: 1, content: 'x', transferType: 'in', transferAmount: 1 }, 'Apikey bad-key'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
