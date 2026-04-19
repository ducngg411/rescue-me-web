import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { RescueRequestService } from './rescue-request.service';
import { IncidentType, VehicleType } from './dto/create-rescue-request.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CommissionService } from '../wallet/commission.service';
import { UserWalletService } from '../user-wallet/user-wallet.service';
import { MailService } from '../mail/mail.service';
import { DisputeService } from '../dispute/dispute.service';
import { VietMapService } from '../vietmap/vietmap.service';
import { FirebaseService } from '../firebase/firebase.service';

jest.mock('../common/business-codes', () => ({
  allocateUniqueOrderCode: jest.fn().mockResolvedValue('RMO-001'),
  allocateUniqueJobPaymentTxnCode: jest.fn().mockResolvedValue('RMJ-001'),
  allocateUniqueUserWalletTxnCode: jest.fn().mockResolvedValue('UWX-001'),
  allocateUniqueProviderWalletTxnCode: jest.fn().mockResolvedValue('TXN-001'),
  formatOrderLabelForSupport: jest.fn().mockReturnValue('#RMO-001'),
}));

const mockPrisma = {
  user: { findUnique: jest.fn(), findMany: jest.fn() },
  rescueRequest: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  requestMedia: { createMany: jest.fn() },
  quote: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  payment: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  review: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  upload: { updateMany: jest.fn() },
  jobPaymentTransaction: { create: jest.fn() },
  userWallet: { findUnique: jest.fn() },
  $transaction: jest.fn().mockImplementation((fn) =>
    Array.isArray(fn) ? Promise.all(fn) : fn(mockPrisma),
  ),
};

const mockCommissionService = { getRate: jest.fn().mockResolvedValue(0.1) };
const mockUserWalletService = {
  ensureWallet: jest.fn().mockResolvedValue({ id: 'uw-1', availableBalance: 500000 }),
  debit: jest.fn().mockResolvedValue({ transaction: { id: 'txn-1' } }),
};
const mockMailService = { sendPaymentDispute: jest.fn() };
const mockDisputeService = { openCustomerDisputeFromPayment: jest.fn() };
const mockVietMapService = {
  calculateHaversineDistance: jest.fn().mockReturnValue(5),
  calculateRoute: jest.fn().mockResolvedValue({ success: false }),
};
const mockFirebaseService = { sendMulticast: jest.fn().mockResolvedValue(1) };

const mockUser = {
  id: 'user-123',
  email: 'user@test.com',
  role: 'USER',
  isOnline: false,
  bannedAt: null,
};

const mockProvider = {
  id: 'provider-456',
  email: 'provider@test.com',
  role: 'PROVIDER',
  isOnline: true,
  verificationStatus: 'APPROVED',
  currentLocation: { lat: 10.77, lng: 106.7 },
  serviceRadiusKm: 15,
  serviceTypes: ['TOWING'],
  supportedVehicleTypes: ['CAR'],
  fcmToken: 'fcm-token-abc',
};

const mockRequest = {
  id: 'req-001',
  orderCode: 'RMO-001',
  userId: 'user-123',
  assignedProviderId: null,
  status: 'SEARCHING',
  incidentType: 'FLAT_TIRE',
  vehicleType: 'CAR',
  pickupLocation: { lat: 10.77, lng: 106.7, addressText: '123 Main St' },
  contactPhone: '0901234567',
  createdAt: new Date(),
};

describe('RescueRequestService', () => {
  let service: RescueRequestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RescueRequestService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CommissionService, useValue: mockCommissionService },
        { provide: UserWalletService, useValue: mockUserWalletService },
        { provide: MailService, useValue: mockMailService },
        { provide: DisputeService, useValue: mockDisputeService },
        { provide: VietMapService, useValue: mockVietMapService },
        { provide: FirebaseService, useValue: mockFirebaseService },
      ],
    }).compile();

    service = module.get<RescueRequestService>(RescueRequestService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((fn) =>
      Array.isArray(fn) ? Promise.all(fn) : fn(mockPrisma),
    );
  });

  // ── createRescueRequest ────────────────────────────────────────────────────

  describe('createRescueRequest', () => {
    it('creates a rescue request successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.rescueRequest.create.mockResolvedValue(mockRequest);
      mockPrisma.requestMedia.createMany.mockResolvedValue({ count: 0 });
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await service.createRescueRequest('user-123', {
        incidentType: IncidentType.FLAT_TIRE,
        vehicleType: VehicleType.CAR,
        pickupLocation: { lat: 10.77, lng: 106.7, addressText: '123 Main St' } as any,
        contactPhone: '0901234567',
        mediaObjectKeys: [],
        videoUrls: [],
        videoUploadIds: [],
      });

      expect(result.id).toBe('req-001');
      expect(mockPrisma.rescueRequest.create).toHaveBeenCalled();
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createRescueRequest('missing-user', {} as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── getUserRescueRequests ──────────────────────────────────────────────────

  describe('getUserRescueRequests', () => {
    it('returns list of user requests', async () => {
      mockPrisma.rescueRequest.findMany.mockResolvedValue([mockRequest]);

      const result = await service.getUserRescueRequests('user-123');

      expect(result).toHaveLength(1);
    });
  });

  // ── getRescueRequestById ───────────────────────────────────────────────────

  describe('getRescueRequestById', () => {
    it('returns request for the owning user', async () => {
      mockPrisma.rescueRequest.findFirst.mockResolvedValue({
        ...mockRequest,
        user: mockUser,
        assignedProvider: null,
        quotes: [],
        payment: null,
        review: null,
        media: [],
      });

      const result = await service.getRescueRequestById('req-001', 'user-123');

      expect(result.id).toBe('req-001');
    });

    it('throws NotFoundException when request does not exist', async () => {
      mockPrisma.rescueRequest.findFirst.mockResolvedValue(null);

      await expect(
        service.getRescueRequestById('bad-id', 'user-123'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── cancelRescueRequest ────────────────────────────────────────────────────

  describe('cancelRescueRequest', () => {
    it('cancels a SEARCHING request', async () => {
      mockPrisma.rescueRequest.findFirst.mockResolvedValue({
        ...mockRequest,
        status: 'SEARCHING',
      });
      mockPrisma.rescueRequest.update.mockResolvedValue({ ...mockRequest, status: 'CANCELLED' });
      mockPrisma.quote.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.cancelRescueRequest('req-001', 'user-123');

      expect(result.status).toBe('CANCELLED');
    });

    it('throws when cancelling a non-cancellable request', async () => {
      mockPrisma.rescueRequest.findFirst.mockResolvedValue({
        ...mockRequest,
        status: 'COMPLETED',
        userId: 'user-123',
      });

      await expect(
        service.cancelRescueRequest('req-001', 'user-123'),
      ).rejects.toThrow('Cannot cancel request in current status');
    });
  });

  // ── declineRequest ─────────────────────────────────────────────────────────

  describe('declineRequest', () => {
    it('declines a request assigned to provider', async () => {
      mockPrisma.rescueRequest.findUnique.mockResolvedValue({
        ...mockRequest,
        assignedProviderId: 'provider-456',
        status: 'ASSIGNED',
      });
      mockPrisma.rescueRequest.update.mockResolvedValue({ ...mockRequest, status: 'SEARCHING' });
      mockPrisma.quote.update.mockResolvedValue({});

      const result = await service.declineRequest('req-001', 'provider-456');

      expect(result).toBeDefined();
    });

    it('throws NotFoundException when request not found', async () => {
      mockPrisma.rescueRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.declineRequest('bad-id', 'provider-456'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── createQuote ────────────────────────────────────────────────────────────

  describe('createQuote', () => {
    it('creates a quote for an eligible provider', async () => {
      mockPrisma.rescueRequest.findUnique.mockResolvedValue({
        ...mockRequest,
        status: 'MATCHING',
        quoteWindowOpen: true,
        quoteWindowClosedAt: null,
        quoteWindowExpiresAt: new Date(Date.now() + 300_000),
        assignedProviderId: null,
        user: mockUser,
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockProvider,
        verificationStatus: 'APPROVED',
        providerWallet: { availableBalance: 100000 },
      });
      mockPrisma.quote.findFirst.mockResolvedValue(null);
      mockPrisma.quote.create.mockResolvedValue({
        id: 'quote-1',
        requestId: 'req-001',
        providerId: 'provider-456',
        price: 150000,
        status: 'PENDING',
      });

      const result = await service.createQuote('req-001', 'provider-456', {
        price: 150000,
        estimatedArrivalMinutes: 20,
        message: 'On my way',
      });

      expect(result.status).toBe('PENDING');
    });
  });

  // ── respondQuote ───────────────────────────────────────────────────────────

  describe('respondQuote', () => {
    it('throws NotFoundException when request not found', async () => {
      mockPrisma.rescueRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.respondQuote('bad-req', 'quote-1', 'user-123', 'ACCEPT'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── submitReview ───────────────────────────────────────────────────────────

  describe('submitReview', () => {
    it('throws NotFoundException when request not found', async () => {
      mockPrisma.rescueRequest.findFirst.mockResolvedValue(null);

      await expect(
        service.submitReview('bad-req', 'user-123', { rating: 5, comment: 'Great!' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when request not completed', async () => {
      mockPrisma.rescueRequest.findFirst.mockResolvedValue({
        ...mockRequest,
        status: 'SEARCHING',
        userId: 'user-123',
        assignedProviderId: 'provider-456',
        review: null,
        payment: null,
      });

      await expect(
        service.submitReview('req-001', 'user-123', { rating: 5, comment: 'Great!' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── startNavigation ────────────────────────────────────────────────────────

  describe('startNavigation', () => {
    it('throws NotFoundException when request not found', async () => {
      mockPrisma.rescueRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.startNavigation('bad-req', 'provider-456'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── getIncidentMapData ─────────────────────────────────────────────────────

  describe('getIncidentMapData', () => {
    it('returns incident map data array', async () => {
      mockPrisma.rescueRequest.findMany.mockResolvedValue([mockRequest]);

      const result = await service.getIncidentMapData();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ── createPayment ──────────────────────────────────────────────────────────

  describe('createPayment', () => {
    it('throws NotFoundException when request not found', async () => {
      mockPrisma.rescueRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.createPayment('bad-req', 'user-123', { paymentMethod: 'CASH' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── confirmPaymentSent ─────────────────────────────────────────────────────

  describe('confirmPaymentSent', () => {
    it('throws NotFoundException when request not found', async () => {
      mockPrisma.rescueRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.confirmPaymentSent('bad-req', 'user-123'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── checkAndExpireRequests ─────────────────────────────────────────────────

  describe('checkAndExpireRequests', () => {
    it('returns processed counts', async () => {
      mockPrisma.rescueRequest.findMany.mockResolvedValue([]);
      mockPrisma.rescueRequest.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.checkAndExpireRequests();

      expect(result.totalProcessed).toBeDefined();
    });
  });
});
