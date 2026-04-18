import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { UserRole, VerificationStatus, ProviderType } from '@prisma/client';
import { ProviderService } from './provider.service';
import { PrismaService } from '../prisma/prisma.service';
import { VietMapService } from '../vietmap/vietmap.service';
import { MailService } from '../mail/mail.service';
import { CommissionService } from '../wallet/commission.service';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_new'),
  compare: jest.fn().mockResolvedValue(true),
}));

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  upload: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  rescueRequest: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  },
  review: {
    aggregate: jest.fn().mockResolvedValue({ _avg: { rating: null }, _count: { rating: 0 } }),
    findMany: jest.fn().mockResolvedValue([]),
  },
  providerWallet: {
    findUnique: jest.fn().mockResolvedValue({ availableBalance: 500000 }),
  },
  $transaction: jest.fn().mockImplementation((fn) =>
    Array.isArray(fn) ? Promise.all(fn) : fn(mockPrisma),
  ),
};

const mockVietMapService = {
  calculateRoute: jest.fn().mockResolvedValue({ success: false }),
};
const mockMailService = { sendProviderApproved: jest.fn() };
const mockCommissionService = {
  getRate: jest.fn().mockResolvedValue(0.1),
  getEffectiveCommissionRate: jest.fn().mockResolvedValue(0.1),
};

const mockProvider = {
  id: 'provider-123',
  email: 'provider@test.com',
  name: 'Provider Name',
  fullName: 'Provider Full Name',
  hashedPassword: 'hashed',
  authProvider: 'EMAIL',
  role: UserRole.PROVIDER,
  verificationStatus: VerificationStatus.APPROVED,
  profileCompleted: true,
  providerType: ProviderType.INDIVIDUAL,
  phoneNumber: '0901234567',
  serviceTypes: ['TOWING'],
  supportedVehicleTypes: ['CAR'],
  serviceRadiusKm: 10,
  permanentAddress: { street: '123 Main St', lat: 10.7, lng: 106.6 },
  rescueVehicles: [{ type: 'CAR', plateNumber: '30A-12345' }],
  isOnline: false,
  bannedAt: null,
};

describe('ProviderService', () => {
  let service: ProviderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: VietMapService, useValue: mockVietMapService },
        { provide: MailService, useValue: mockMailService },
        { provide: CommissionService, useValue: mockCommissionService },
      ],
    }).compile();

    service = module.get<ProviderService>(ProviderService);
    jest.clearAllMocks();
    mockPrisma.upload.findMany.mockResolvedValue([]);
    mockPrisma.rescueRequest.findMany.mockResolvedValue([]);
    mockPrisma.rescueRequest.count.mockResolvedValue(0);
    mockPrisma.review.aggregate.mockResolvedValue({ _avg: { rating: null }, _count: { rating: 0 } });
    mockPrisma.review.findMany.mockResolvedValue([]);
    mockPrisma.providerWallet.findUnique.mockResolvedValue({ availableBalance: 500000 });
  });

  // ── updateProfile ──────────────────────────────────────────────────────────

  describe('updateProfile', () => {
    it('updates provider profile successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockProvider);
      mockPrisma.user.update.mockResolvedValue(mockProvider);

      const result = await service.updateProfile(
        'provider-123',
        {
          fullName: 'Updated Name',
          phoneNumber: '0901234567',
          providerType: ProviderType.INDIVIDUAL,
          permanentAddress: { street: '123 Main St', lat: 10.7, lng: 106.6 } as any,
          serviceTypes: ['TOWING'] as any,
          supportedVehicleTypes: ['CAR'] as any,
          serviceRadiusKm: 10,
          rescueVehicles: [{ type: 'CAR', plateNumber: '30A-12345' }] as any,
        },
        UserRole.PROVIDER,
      );

      expect(result).not.toHaveProperty('hashedPassword');
    });

    it('throws ForbiddenException when role is not PROVIDER', async () => {
      await expect(
        service.updateProfile('user-123', {} as any, UserRole.USER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for BUSINESS provider without businessName', async () => {
      await expect(
        service.updateProfile(
          'provider-123',
          {
            providerType: ProviderType.BUSINESS,
            rescueVehicles: [{ type: 'CAR', plateNumber: '30A-99999' }],
          } as any,
          UserRole.PROVIDER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when no rescue vehicles provided', async () => {
      await expect(
        service.updateProfile(
          'provider-123',
          {
            providerType: ProviderType.INDIVIDUAL,
            permanentAddress: { street: 'x', lat: 1, lng: 1 } as any,
            rescueVehicles: [],
          } as any,
          UserRole.PROVIDER,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── getProfile ─────────────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('returns sanitized provider profile', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockProvider);

      const result = await service.getProfile('provider-123');

      expect(result.email).toBe('provider@test.com');
      expect(result).not.toHaveProperty('hashedPassword');
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('missing-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── submitVerification ─────────────────────────────────────────────────────

  describe('submitVerification', () => {
    it('returns missing fields when profile is incomplete', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockProvider,
        fullName: null,
        verificationStatus: VerificationStatus.DRAFT,
        profileCompleted: false,
      });

      const result = await service.submitVerification('provider-123');

      expect(result.success).toBe(false);
      expect(result.missingFields?.length).toBeGreaterThan(0);
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.submitVerification('missing-id')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user is not a PROVIDER', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockProvider, role: UserRole.USER });

      await expect(service.submitVerification('provider-123')).rejects.toThrow(ForbiddenException);
    });
  });

  // ── updateOnlineStatus ─────────────────────────────────────────────────────

  describe('updateOnlineStatus', () => {
    it('updates online status successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockProvider);
      mockPrisma.user.update.mockResolvedValue({ ...mockProvider, isOnline: true });

      const result = await service.updateOnlineStatus('provider-123', true);

      expect(result).toBeDefined();
    });

    it('throws NotFoundException when provider does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.updateOnlineStatus('missing-id', true)).rejects.toThrow(NotFoundException);
    });
  });

  // ── changePassword ─────────────────────────────────────────────────────────

  describe('changePassword', () => {
    it('changes password when current password is correct', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockProvider);
      mockPrisma.user.update.mockResolvedValue(mockProvider);
      const bcrypt = require('bcryptjs');
      bcrypt.compare.mockResolvedValue(true);

      const result = await service.changePassword('provider-123', 'OldPass1!', 'NewPass1!');

      expect(result).toBeDefined();
    });

    it('throws BadRequestException when current password is wrong', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockProvider);
      const bcrypt = require('bcryptjs');
      bcrypt.compare.mockResolvedValue(false);

      await expect(
        service.changePassword('provider-123', 'wrongPass', 'NewPass1!'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── updateCurrentLocation ──────────────────────────────────────────────────

  describe('updateCurrentLocation', () => {
    it('updates provider location when provider is online', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockProvider, isOnline: true });
      mockPrisma.user.update.mockResolvedValue(mockProvider);

      await service.updateCurrentLocation('provider-123', 10.7769, 106.7009);

      expect(mockPrisma.user.update).toHaveBeenCalled();
    });

    it('returns success:false silently when provider is offline', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockProvider, isOnline: false });

      const result = await service.updateCurrentLocation('provider-123', 10.7769, 106.7009);

      expect(result.success).toBe(false);
    });
  });

  // ── getHistoryStats ────────────────────────────────────────────────────────

  describe('getHistoryStats', () => {
    it('returns dashboard stats for the given number of days', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockProvider);
      mockPrisma.rescueRequest.findMany.mockResolvedValue([]);

      const result = await service.getHistoryStats('provider-123', 7);

      expect(result).toBeDefined();
    });
  });
});
