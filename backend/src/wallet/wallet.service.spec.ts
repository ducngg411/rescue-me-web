import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { WalletTransactionStatus, WalletTransactionType, WalletReferenceType } from '@prisma/client';
import { WalletService } from './wallet.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';

jest.mock('../common/business-codes', () => ({
  allocateUniqueProviderWalletTxnCode: jest.fn().mockResolvedValue('TXN-001'),
  allocateUniqueProviderTopupTransferCode: jest.fn().mockResolvedValue('RM-ABCD123'),
  allocateUniqueProviderTopupTxnCode: jest.fn().mockResolvedValue('TNP-001'),
  allocateUniqueUserTopupTxnCode: jest.fn().mockResolvedValue('TNU-001'),
}));

jest.mock('../stats/provider-job-stats.util', () => ({
  grossRevenueFromCompletedRequest: jest.fn().mockReturnValue(100000),
  whereCompletedJobsInLocalDay: jest.fn().mockReturnValue({}),
}));

const mockPrisma = {
  providerWallet: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    aggregate: jest.fn(),
  },
  walletTransaction: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    aggregate: jest.fn(),
  },
  topupTransaction: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  userTopupTransaction: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  userWalletTransaction: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  userWallet: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  rescueRequest: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  payment: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  jobPaymentTransaction: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  providerWithdrawalAccount: {
    findFirst: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  platformConfig: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn().mockImplementation((fn) =>
    Array.isArray(fn) ? Promise.all(fn) : fn(mockPrisma),
  ),
};

const mockConfigService = {
  get: jest.fn((key: string, def?: string) => {
    const map: Record<string, string> = {
      SEPAY_API_KEY: 'test-api-key',
      SEPAY_BANK_ACCOUNT: '07729096901',
      SEPAY_BANK_CODE: 'TPBank',
    };
    return map[key] ?? def;
  }),
};

const mockMailService = {
  sendTopupReceipt: jest.fn().mockResolvedValue(undefined),
};

const mockWallet = {
  id: 'wallet-abc',
  providerId: 'provider-123',
  availableBalance: 500000,
  pendingBalance: 0,
};

const mockTx = {
  id: 'tx-001',
  walletId: 'wallet-abc',
  txnCode: 'TXN-001',
  type: WalletTransactionType.CREDIT,
  amount: 100000,
  status: WalletTransactionStatus.COMPLETED,
  referenceType: WalletReferenceType.TOPUP,
  referenceId: 'ref-1',
};

describe('WalletService', () => {
  let service: WalletService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    jest.clearAllMocks();

    mockPrisma.platformConfig.findUnique.mockResolvedValue(null);
    mockPrisma.$transaction.mockImplementation((fn) =>
      Array.isArray(fn) ? Promise.all(fn) : fn(mockPrisma),
    );
  });

  // ── ensureWallet ───────────────────────────────────────────────────────────

  describe('ensureWallet', () => {
    it('creates wallet lazily when it does not exist', async () => {
      mockPrisma.providerWallet.upsert.mockResolvedValue(mockWallet);

      const result = await service.ensureWallet('provider-123');

      expect(result.providerId).toBe('provider-123');
      expect(mockPrisma.providerWallet.upsert).toHaveBeenCalled();
    });
  });

  // ── getWalletById ──────────────────────────────────────────────────────────

  describe('getWalletById', () => {
    it('returns wallet by id', async () => {
      mockPrisma.providerWallet.findUnique.mockResolvedValue(mockWallet);

      const result = await service.getWalletById('wallet-abc');

      expect(result.id).toBe('wallet-abc');
    });

    it('throws NotFoundException when wallet not found', async () => {
      mockPrisma.providerWallet.findUnique.mockResolvedValue(null);

      await expect(service.getWalletById('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── getWalletByProvider ────────────────────────────────────────────────────

  describe('getWalletByProvider', () => {
    it('returns wallet for a provider', async () => {
      mockPrisma.providerWallet.findUnique.mockResolvedValue(mockWallet);

      const result = await service.getWalletByProvider('provider-123');

      expect(result.providerId).toBe('provider-123');
    });

    it('throws NotFoundException when provider has no wallet', async () => {
      mockPrisma.providerWallet.findUnique.mockResolvedValue(null);

      await expect(service.getWalletByProvider('missing-provider')).rejects.toThrow(NotFoundException);
    });
  });

  // ── credit ─────────────────────────────────────────────────────────────────

  describe('credit', () => {
    it('credits COMPLETED: adds to availableBalance', async () => {
      mockPrisma.providerWallet.findUnique.mockResolvedValue(mockWallet);
      mockPrisma.walletTransaction.create.mockResolvedValue({ ...mockTx, status: WalletTransactionStatus.COMPLETED });
      mockPrisma.providerWallet.update.mockResolvedValue({ ...mockWallet, availableBalance: 600000 });

      const result = await service.credit(
        'wallet-abc',
        100000,
        WalletReferenceType.TOPUP,
        'ref-1',
      );

      expect(result.transaction.status).toBe(WalletTransactionStatus.COMPLETED);
      const updateCall = mockPrisma.providerWallet.update.mock.calls[0][0];
      expect(updateCall.data.availableBalance).toBeDefined();
    });

    it('credits PENDING: adds to pendingBalance', async () => {
      mockPrisma.providerWallet.findUnique.mockResolvedValue(mockWallet);
      mockPrisma.walletTransaction.create.mockResolvedValue({ ...mockTx, status: WalletTransactionStatus.PENDING });
      mockPrisma.providerWallet.update.mockResolvedValue({ ...mockWallet, pendingBalance: 100000 });

      const result = await service.credit(
        'wallet-abc',
        100000,
        WalletReferenceType.JOB,
        'ref-2',
        { status: WalletTransactionStatus.PENDING },
      );

      expect(result.transaction.status).toBe(WalletTransactionStatus.PENDING);
      const updateCall = mockPrisma.providerWallet.update.mock.calls[0][0];
      expect(updateCall.data.pendingBalance).toBeDefined();
    });

    it('throws BadRequestException for non-positive amount', async () => {
      await expect(
        service.credit('wallet-abc', 0, WalletReferenceType.TOPUP, 'ref-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── debit ──────────────────────────────────────────────────────────────────

  describe('debit', () => {
    it('debits from availableBalance', async () => {
      mockPrisma.providerWallet.findUnique.mockResolvedValue({ ...mockWallet, availableBalance: 500000 });
      mockPrisma.walletTransaction.create.mockResolvedValue({ ...mockTx, type: WalletTransactionType.DEBIT });
      mockPrisma.providerWallet.update.mockResolvedValue({ ...mockWallet, availableBalance: 400000 });

      const result = await service.debit(
        'wallet-abc',
        100000,
        WalletReferenceType.WITHDRAW,
        'withdraw-ref',
      );

      expect(result.transaction.type).toBe(WalletTransactionType.DEBIT);
    });

    it('throws BadRequestException for insufficient balance', async () => {
      mockPrisma.providerWallet.findUnique.mockResolvedValue({ ...mockWallet, availableBalance: 50000 });

      await expect(
        service.debit('wallet-abc', 100000, WalletReferenceType.WITHDRAW, 'ref-x'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for non-positive amount', async () => {
      await expect(
        service.debit('wallet-abc', -1, WalletReferenceType.WITHDRAW, 'ref-x'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── withdraw ───────────────────────────────────────────────────────────────

  describe('withdraw', () => {
    it('initiates withdrawal and reserves balance', async () => {
      mockPrisma.providerWallet.findUnique.mockResolvedValue({ ...mockWallet, availableBalance: 500000 });
      mockPrisma.providerWithdrawalAccount.findFirst.mockResolvedValue(null);
      mockPrisma.walletTransaction.create.mockResolvedValue({ ...mockTx, status: WalletTransactionStatus.PENDING });
      mockPrisma.providerWallet.update.mockResolvedValue({ ...mockWallet, availableBalance: 400000 });

      const result = await service.withdraw('wallet-abc', 100000, 'wd-ref-001');

      expect(result.transaction.status).toBe(WalletTransactionStatus.PENDING);
    });

    it('throws BadRequestException when balance is insufficient', async () => {
      mockPrisma.providerWallet.findUnique.mockResolvedValue({ ...mockWallet, availableBalance: 5000 });

      await expect(service.withdraw('wallet-abc', 100000, 'wd-ref')).rejects.toThrow(BadRequestException);
    });
  });

  // ── processSePayWebhook ────────────────────────────────────────────────────

  describe('processSePayWebhook', () => {
    const validBody = {
      id: 12345,
      content: 'RM-ABCD123 thanh toan',
      transferType: 'in',
      transferAmount: 200000,
      referenceCode: 'SEPAY-REF',
    };

    it('processes provider topup webhook and credits wallet', async () => {
      mockPrisma.topupTransaction.findUnique.mockResolvedValue(null);
      mockPrisma.jobPaymentTransaction.findUnique.mockResolvedValue(null);
      mockPrisma.topupTransaction.findFirst.mockResolvedValue({
        id: 'topup-1',
        walletId: 'wallet-abc',
        amount: 200000,
        status: 'PENDING',
        transferCode: 'RM-ABCD123',
        txnCode: 'TNP-001',
        expireAt: new Date(Date.now() + 300_000),
      });
      mockPrisma.providerWallet.findUnique.mockResolvedValue(mockWallet);
      mockPrisma.providerWallet.update.mockResolvedValue({ ...mockWallet, availableBalance: 700000 });
      mockPrisma.topupTransaction.update.mockResolvedValue({});
      mockPrisma.walletTransaction.create.mockResolvedValue(mockTx);
      mockPrisma.user.findUnique.mockResolvedValue({ email: 'p@test.com', fullName: 'Provider' });

      const result = await service.processSePayWebhook(validBody, 'Apikey test-api-key');

      expect(result.success).toBe(true);
    });

    it('returns Already processed for duplicate sepayId (idempotency)', async () => {
      mockPrisma.topupTransaction.findUnique.mockResolvedValue({ id: 'existing-topup' });
      mockPrisma.jobPaymentTransaction.findUnique.mockResolvedValue(null);

      const result = await service.processSePayWebhook(validBody, 'Apikey test-api-key');

      expect(result.message).toBe('Already processed');
    });

    it('throws UnauthorizedException when API key is invalid', async () => {
      await expect(
        service.processSePayWebhook(validBody, 'Apikey wrong-key'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns success with message when no matching transfer code', async () => {
      mockPrisma.topupTransaction.findUnique.mockResolvedValue(null);
      mockPrisma.jobPaymentTransaction.findUnique.mockResolvedValue(null);

      const result = await service.processSePayWebhook(
        { ...validBody, content: 'random text no code' },
        'Apikey test-api-key',
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('No matching');
    });

    it('skips non-in/out transfer types', async () => {
      const result = await service.processSePayWebhook(
        { ...validBody, transferType: 'pending' },
        'Apikey test-api-key',
      );

      expect(result.success).toBe(true);
    });
  });

  // ── initTopup ──────────────────────────────────────────────────────────────

  describe('initTopup', () => {
    it('creates a new PENDING topup transaction', async () => {
      mockPrisma.providerWallet.upsert.mockResolvedValue(mockWallet);
      mockPrisma.topupTransaction.findFirst.mockResolvedValue(null);
      mockPrisma.topupTransaction.create.mockResolvedValue({
        id: 'topup-new',
        amount: 200000,
        transferCode: 'RM-ABCD123',
        expireAt: new Date(Date.now() + 300_000),
      });

      const result = await service.initTopup('provider-123', 200000);

      expect(result.transferCode).toBe('RM-ABCD123');
      expect(result.isReuse).toBe(false);
    });

    it('reuses existing PENDING topup when same amount', async () => {
      mockPrisma.providerWallet.upsert.mockResolvedValue(mockWallet);
      mockPrisma.topupTransaction.findFirst.mockResolvedValue({
        id: 'topup-existing',
        walletId: 'wallet-abc',
        amount: 200000,
        transferCode: 'RM-EXISTING',
        txnCode: 'TNP-999',
        expireAt: new Date(Date.now() + 300_000),
      });

      const result = await service.initTopup('provider-123', 200000);

      expect(result.isReuse).toBe(true);
      expect(result.transferCode).toBe('RM-EXISTING');
    });

    it('throws BadRequestException when amount is below minimum', async () => {
      await expect(service.initTopup('provider-123', 50000)).rejects.toThrow(BadRequestException);
    });
  });

  // ── getTopupStatus ─────────────────────────────────────────────────────────

  describe('getTopupStatus', () => {
    it('returns PENDING status for active topup', async () => {
      mockPrisma.providerWallet.findUnique.mockResolvedValue(mockWallet);
      mockPrisma.topupTransaction.findFirst.mockResolvedValue({
        id: 'topup-1',
        status: 'PENDING',
        amount: 200000,
        expireAt: new Date(Date.now() + 300_000),
        completedAt: null,
      });

      const result = await service.getTopupStatus('topup-1', 'provider-123');

      expect(result.status).toBe('PENDING');
    });

    it('auto-expires topup past expireAt and returns EXPIRED', async () => {
      mockPrisma.providerWallet.findUnique.mockResolvedValue(mockWallet);
      mockPrisma.topupTransaction.findFirst.mockResolvedValue({
        id: 'topup-1',
        status: 'PENDING',
        amount: 200000,
        expireAt: new Date(Date.now() - 60_000),
        completedAt: null,
      });
      mockPrisma.topupTransaction.update.mockResolvedValue({ status: 'EXPIRED' });

      const result = await service.getTopupStatus('topup-1', 'provider-123');

      expect(result.status).toBe('EXPIRED');
    });
  });

  // ── getTransactions ────────────────────────────────────────────────────────

  describe('getTransactions', () => {
    it('returns paginated transaction list', async () => {
      mockPrisma.walletTransaction.findMany.mockResolvedValue([mockTx]);
      mockPrisma.walletTransaction.count.mockResolvedValue(1);
      mockPrisma.rescueRequest.findMany.mockResolvedValue([]);
      mockPrisma.$transaction.mockResolvedValue([[mockTx], 1]);

      const result = await service.getTransactions('wallet-abc', { skip: 0, take: 10 });

      expect(result.total).toBe(1);
    });
  });
});
