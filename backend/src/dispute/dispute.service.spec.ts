import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { DisputeService } from './dispute.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CommissionService } from '../wallet/commission.service';

jest.mock('../common/business-codes', () => ({
  formatOrderLabelForSupport: jest.fn().mockReturnValue('#RMO-001'),
}));

const mockPrisma = {
  payment: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  disputeCase: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  disputeMessage: {
    create: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
  },
  disputeEvidence: {
    createMany: jest.fn(),
  },
  disputeReadState: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  rescueRequest: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn().mockImplementation((fn) =>
    Array.isArray(fn) ? Promise.all(fn) : fn(mockPrisma),
  ),
};

const mockMailService = {
  sendPaymentDispute: jest.fn().mockResolvedValue(undefined),
};

const mockCommissionService = {
  getEffectiveCommissionRate: jest.fn().mockResolvedValue(0.1),
};

const mockPayment = {
  id: 'payment-001',
  requestId: 'req-001',
  userId: 'user-123',
  providerId: 'provider-456',
  totalAmount: 200000,
  status: 'USER_CONFIRMED',
};

const mockDisputeCase = {
  id: 'dispute-001',
  paymentId: 'payment-001',
  requestId: 'req-001',
  openedByUserId: 'user-123',
  openedByRole: 'CUSTOMER',
  status: 'WAITING_FOR_PROVIDER',
  targetAmount: 180000,
  customerReplyAllowed: false,
  providerReplyAllowed: true,
  payment: { ...mockPayment },
  firstResponseDueAt: new Date(Date.now() + 86400_000),
  firstRespondedAt: null,
};

describe('DisputeService', () => {
  let service: DisputeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MailService, useValue: mockMailService },
        { provide: CommissionService, useValue: mockCommissionService },
      ],
    }).compile();

    service = module.get<DisputeService>(DisputeService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((fn) =>
      Array.isArray(fn) ? Promise.all(fn) : fn(mockPrisma),
    );
  });

  // ── openDispute ────────────────────────────────────────────────────────────

  describe('openDispute', () => {
    it('opens a dispute for a CUSTOMER successfully', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrisma.disputeCase.findUnique.mockResolvedValue(null);
      mockPrisma.rescueRequest.findUnique.mockResolvedValue({
        id: 'req-001',
        orderCode: 'RMO-001',
        user: { fullName: 'User', email: 'user@test.com' },
        assignedProvider: { email: 'p@test.com', fullName: 'Provider' },
      });
      mockPrisma.disputeCase.create.mockResolvedValue(mockDisputeCase);
      mockPrisma.disputeMessage.create.mockResolvedValue({ id: 'msg-1' });
      mockPrisma.disputeEvidence.createMany.mockResolvedValue({ count: 0 });
      mockPrisma.payment.update.mockResolvedValue({});

      const result = await service.openDispute('user-123', 'CUSTOMER', {
        orderId: 'req-001',
        paymentId: 'payment-001',
        targetAmount: 180000,
        reason: 'Provider did not complete the job',
      });

      expect(result.disputeId).toBe('dispute-001');
      expect(result.status).toBeDefined();
    });

    it('throws NotFoundException when payment not found', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      await expect(
        service.openDispute('user-123', 'CUSTOMER', {
          orderId: 'req-001',
          paymentId: 'bad-payment',
          targetAmount: 100000,
          reason: 'test',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when orderId does not match payment', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        ...mockPayment,
        requestId: 'different-req',
      });

      await expect(
        service.openDispute('user-123', 'CUSTOMER', {
          orderId: 'req-001',
          paymentId: 'payment-001',
          targetAmount: 100000,
          reason: 'test',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when customer does not own the payment', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        ...mockPayment,
        userId: 'other-user',
      });
      mockPrisma.disputeCase.findUnique.mockResolvedValue(null);

      await expect(
        service.openDispute('user-123', 'CUSTOMER', {
          orderId: 'req-001',
          paymentId: 'payment-001',
          targetAmount: 100000,
          reason: 'test',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when dispute already exists', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrisma.disputeCase.findUnique.mockResolvedValue(mockDisputeCase);

      await expect(
        service.openDispute('user-123', 'CUSTOMER', {
          orderId: 'req-001',
          paymentId: 'payment-001',
          targetAmount: 100000,
          reason: 'duplicate',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── getMyDisputes ──────────────────────────────────────────────────────────

  describe('getMyDisputes', () => {
    it('returns CUSTOMER disputes with unread count', async () => {
      mockPrisma.$transaction.mockResolvedValue([[mockDisputeCase], 1]);
      mockPrisma.disputeReadState.findUnique.mockResolvedValue(null);
      mockPrisma.disputeMessage.count.mockResolvedValue(2);

      const result = await service.getMyDisputes('user-123', 'CUSTOMER');

      expect(result.total).toBe(1);
      expect(result.items[0].unreadCount).toBe(2);
    });

    it('returns PROVIDER disputes', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      const result = await service.getMyDisputes('provider-456', 'PROVIDER');

      expect(result.total).toBe(0);
    });
  });

  // ── getDisputeDetail ───────────────────────────────────────────────────────

  describe('getDisputeDetail', () => {
    const fullDisputeCase = {
      ...mockDisputeCase,
      messages: [],
      evidence: [],
      readStates: [],
      openedBy: { id: 'user-123', fullName: 'User', email: 'user@test.com' },
      resolvedBy: null,
      payment: {
        ...mockPayment,
        userId: 'user-123',
        providerId: 'provider-456',
        request: {
          user: { id: 'user-123', fullName: 'User', email: 'u@test.com', phoneNumber: null },
          assignedProvider: { id: 'provider-456', fullName: 'Provider', email: 'p@test.com', phoneNumber: null },
        },
      },
    };

    it('returns dispute detail for the owning CUSTOMER', async () => {
      mockPrisma.disputeCase.findUnique.mockResolvedValue(fullDisputeCase);
      mockPrisma.disputeReadState.upsert.mockResolvedValue({});

      const result = await service.getDisputeDetail('dispute-001', 'user-123', 'CUSTOMER');

      expect(result.id).toBe('dispute-001');
      expect(result.permissions).toBeDefined();
    });

    it('throws NotFoundException when dispute not found', async () => {
      mockPrisma.disputeCase.findUnique.mockResolvedValue(null);

      await expect(
        service.getDisputeDetail('bad-id', 'user-123', 'CUSTOMER'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when unrelated user tries to view', async () => {
      mockPrisma.disputeCase.findUnique.mockResolvedValue({
        ...fullDisputeCase,
        payment: { ...mockPayment, userId: 'other-user', providerId: 'other-provider' },
      });

      await expect(
        service.getDisputeDetail('dispute-001', 'user-123', 'CUSTOMER'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── sendMessage ────────────────────────────────────────────────────────────

  describe('sendMessage', () => {
    it('sends a message from PROVIDER and updates dispute status', async () => {
      mockPrisma.disputeCase.findUnique.mockResolvedValue({
        ...mockDisputeCase,
        status: 'WAITING_FOR_PROVIDER',
        providerReplyAllowed: true,
      });
      mockPrisma.disputeMessage.create.mockResolvedValue({
        id: 'msg-new',
        body: 'Hello',
        author: { id: 'provider-456', fullName: 'Provider', avatar: null },
      });
      mockPrisma.disputeEvidence.createMany.mockResolvedValue({ count: 0 });
      mockPrisma.disputeCase.update.mockResolvedValue({ ...mockDisputeCase, status: 'INVESTIGATING' });

      const result = await service.sendMessage('dispute-001', 'provider-456', 'PROVIDER', {
        body: 'I was there and completed the job.',
      });

      expect(result.message.id).toBe('msg-new');
    });

    it('throws NotFoundException when dispute not found', async () => {
      mockPrisma.disputeCase.findUnique.mockResolvedValue(null);

      await expect(
        service.sendMessage('bad-id', 'user-123', 'CUSTOMER', { body: 'hello' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when customer reply is not allowed', async () => {
      mockPrisma.disputeCase.findUnique.mockResolvedValue({
        ...mockDisputeCase,
        payment: mockPayment,
        customerReplyAllowed: false,
        status: 'INVESTIGATING',
      });

      await expect(
        service.sendMessage('dispute-001', 'user-123', 'CUSTOMER', { body: 'another message' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
