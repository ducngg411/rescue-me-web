import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { VerificationStatus } from '@prisma/client';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

jest.mock('../common/business-codes', () => ({
  allocateUniqueProviderWalletTxnCode: jest.fn().mockResolvedValue('TXN-ADM-001'),
  allocateUniqueUserWalletTxnCode: jest.fn().mockResolvedValue('UWX-ADM-001'),
  formatOrderLabelForSupport: jest.fn().mockReturnValue('#RMO-001'),
}));

const mockPrisma = {
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  upload: { findMany: jest.fn() },
  rescueRequest: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
    aggregate: jest.fn(),
  },
  payment: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    update: jest.fn(),
  },
  disputeCase: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    groupBy: jest.fn(),
  },
  disputeMessage: { create: jest.fn() },
  disputeEvidence: { create: jest.fn(), createMany: jest.fn() },
  disputeReadState: { upsert: jest.fn() },
  providerWallet: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    aggregate: jest.fn(),
  },
  walletTransaction: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  topupTransaction: { findMany: jest.fn(), count: jest.fn(), aggregate: jest.fn() },
  userTopupTransaction: { findMany: jest.fn(), count: jest.fn(), aggregate: jest.fn() },
  userWallet: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    aggregate: jest.fn(),
  },
  userWalletTransaction: {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  providerWithdrawalAccount: { findFirst: jest.fn() },
  customerWithdrawalAccount: { findFirst: jest.fn() },
  platformConfig: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    findMany: jest.fn(),
  },
  feeAuditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  review: { aggregate: jest.fn() },
  jobPaymentTransaction: { findMany: jest.fn(), count: jest.fn() },
  session: { deleteMany: jest.fn() },
  $transaction: jest.fn().mockImplementation((fn) =>
    Array.isArray(fn) ? Promise.all(fn) : fn(mockPrisma),
  ),
};

const mockMailService = {
  sendProviderApproved: jest.fn().mockResolvedValue(undefined),
  sendProviderRejected: jest.fn().mockResolvedValue(undefined),
  sendProviderSuspended: jest.fn().mockResolvedValue(undefined),
  sendProviderUnsuspended: jest.fn().mockResolvedValue(undefined),
  sendUserSuspended: jest.fn().mockResolvedValue(undefined),
  sendUserUnsuspended: jest.fn().mockResolvedValue(undefined),
  sendUserDeleted: jest.fn().mockResolvedValue(undefined),
};

const mockProvider = {
  id: 'provider-456',
  email: 'provider@test.com',
  fullName: 'Provider Full',
  name: 'Provider',
  role: 'PROVIDER',
  verificationStatus: VerificationStatus.PENDING,
  bannedAt: null,
};

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((fn) =>
      Array.isArray(fn) ? Promise.all(fn) : fn(mockPrisma),
    );
    // Safe defaults for mocks that return arrays/aggregates
    mockPrisma.payment.findMany.mockResolvedValue([]);
    mockPrisma.walletTransaction.findMany.mockResolvedValue([]);
    mockPrisma.walletTransaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    mockPrisma.walletTransaction.count.mockResolvedValue(0);
    mockPrisma.topupTransaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    mockPrisma.userTopupTransaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    mockPrisma.userWalletTransaction.count.mockResolvedValue(0);
    mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { totalAmount: 0 } });
    mockPrisma.platformConfig.findMany.mockResolvedValue([]);
    mockPrisma.platformConfig.findUnique.mockResolvedValue(null);
  });

  // ── getProviders ───────────────────────────────────────────────────────────

  describe('getProviders', () => {
    it('returns provider list', async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockProvider]);

      const result = await service.getProviders({ status: 'ALL' });

      expect(result).toHaveLength(1);
    });

    it('filters by verification status', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await service.getProviders({ status: 'PENDING' });

      expect(result).toHaveLength(0);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ verificationStatus: 'PENDING' }),
        }),
      );
    });
  });

  // ── getProviderDetail ──────────────────────────────────────────────────────

  describe('getProviderDetail', () => {
    it('returns provider detail with uploads', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockProvider);
      mockPrisma.upload.findMany.mockResolvedValue([]);
      mockPrisma.review.aggregate.mockResolvedValue({ _avg: { rating: null }, _count: { rating: 0 } });
      mockPrisma.rescueRequest.count.mockResolvedValue(5);

      const result = await service.getProviderDetail('provider-456');

      expect(result.id).toBe('provider-456');
    });

    it('throws NotFoundException when provider not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProviderDetail('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── approveProvider ────────────────────────────────────────────────────────

  describe('approveProvider', () => {
    it('approves a PENDING provider', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockProvider,
        verificationStatus: VerificationStatus.PENDING,
      });
      mockPrisma.user.update.mockResolvedValue({
        ...mockProvider,
        verificationStatus: VerificationStatus.APPROVED,
      });

      const result = await service.approveProvider('provider-456', 'admin-001');

      expect(result.verificationStatus).toBe(VerificationStatus.APPROVED);
    });

    it('throws NotFoundException when provider not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.approveProvider('bad-id', 'admin-001')).rejects.toThrow(NotFoundException);
    });
  });

  // ── rejectProvider ─────────────────────────────────────────────────────────

  describe('rejectProvider', () => {
    it('rejects a PENDING provider with a reason', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockProvider,
        verificationStatus: VerificationStatus.PENDING,
      });
      mockPrisma.user.update.mockResolvedValue({
        ...mockProvider,
        verificationStatus: VerificationStatus.REJECTED,
      });

      const result = await service.rejectProvider('provider-456', 'admin-001', 'INCOMPLETE_DOCS', 'Missing ID card');

      expect(result.verificationStatus).toBe(VerificationStatus.REJECTED);
    });
  });

  // ── suspendProvider ────────────────────────────────────────────────────────

  describe('suspendProvider', () => {
    it('suspends an approved provider', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockProvider,
        verificationStatus: VerificationStatus.APPROVED,
        bannedAt: null,
      });
      mockPrisma.user.update.mockResolvedValue({
        ...mockProvider,
        bannedAt: new Date(),
      });

      const result = await service.suspendProvider('provider-456', 'admin-001', 'Repeated violations');

      expect(result.bannedAt).toBeDefined();
    });
  });

  // ── getUsers ───────────────────────────────────────────────────────────────

  describe('getUsers', () => {
    it('returns paginated user list', async () => {
      mockPrisma.$transaction.mockResolvedValue([[{ id: 'user-123', email: 'u@test.com', role: 'USER' }], 1]);

      const result = await service.getUsers({});

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  // ── suspendUser ────────────────────────────────────────────────────────────

  describe('suspendUser', () => {
    it('suspends a user account', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-123', role: 'USER', bannedAt: null });
      mockPrisma.user.update.mockResolvedValue({ id: 'user-123', bannedAt: new Date() });
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.suspendUser('user-123', 'Policy violation');

      expect(result.bannedAt).toBeDefined();
    });

    it('throws NotFoundException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.suspendUser('bad-id', 'reason')).rejects.toThrow(NotFoundException);
    });
  });

  // ── activateUser ───────────────────────────────────────────────────────────

  describe('activateUser', () => {
    it('activates a suspended user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-123', bannedAt: new Date() });
      mockPrisma.user.update.mockResolvedValue({ id: 'user-123', bannedAt: null });

      const result = await service.activateUser('user-123');

      expect(result.bannedAt).toBeNull();
    });
  });

  // ── getBillingConfig ───────────────────────────────────────────────────────

  describe('getBillingConfig', () => {
    it('returns billing configuration', async () => {
      mockPrisma.platformConfig.findMany.mockResolvedValue([
        { key: 'COMMISSION_RATE', value: '0.1' },
        { key: 'SEPAY_BANK_ACCOUNT', value: '07729096901' },
      ]);

      const result = await service.getBillingConfig();

      expect(result).toBeDefined();
    });
  });

  // ── getTransactionSummary ──────────────────────────────────────────────────

  describe('getTransactionSummary', () => {
    it('returns summary totals', async () => {
      const result = await service.getTransactionSummary();

      expect(result).toBeDefined();
      expect(result.totalRevenue).toBeDefined();
    });
  });

  // ── getRescueRequestStats ──────────────────────────────────────────────────

  describe('getRescueRequestStats', () => {
    it('returns rescue request statistics', async () => {
      mockPrisma.rescueRequest.count.mockResolvedValue(42);
      mockPrisma.rescueRequest.groupBy.mockResolvedValue([]);

      const result = await service.getRescueRequestStats();

      expect(result).toBeDefined();
    });
  });

  // ── getDisputeStats ────────────────────────────────────────────────────────

  describe('getDisputeStats', () => {
    it('returns dispute statistics', async () => {
      mockPrisma.disputeCase.count.mockResolvedValue(10);
      mockPrisma.disputeCase.groupBy.mockResolvedValue([]);

      const result = await service.getDisputeStats();

      expect(result).toBeDefined();
    });
  });

  // ── getUserStats ───────────────────────────────────────────────────────────

  describe('getUserStats', () => {
    it('returns user statistics', async () => {
      mockPrisma.$transaction.mockResolvedValue([100, 80, 20, 10]);

      const result = await service.getUserStats();

      expect(result).toBeDefined();
      expect(result.total).toBe(100);
    });
  });
});
