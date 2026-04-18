import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common'; // UnauthorizedException used in refreshToken tests
import { JwtService } from '@nestjs/jwt';
import { GuestAuthService } from './guest-auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from '../firebase/firebase.service';

const mockPrisma = {
  guestSession: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  user: { findFirst: jest.fn(), findUnique: jest.fn() },
  rescueRequest: { updateMany: jest.fn() },
  payment: { updateMany: jest.fn() },
  $transaction: jest.fn().mockImplementation((fn) =>
    Array.isArray(fn) ? Promise.all(fn) : fn(mockPrisma),
  ),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('guest_jwt_token'),
  decode: jest.fn().mockReturnValue({ sub: 'user-123', type: 'USER' }),
};

const mockFirebaseService = {
  verifyPhoneToken: jest.fn(),
};

const mockSession = {
  id: 'guest-session-1',
  phoneNormalized: '0901234567',
  phoneVerifiedAt: new Date(),
  expiresAt: new Date(Date.now() + 86400_000),
  deviceId: null,
  lastIp: null,
  convertedUserId: null,
};

describe('GuestAuthService', () => {
  let service: GuestAuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GuestAuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: FirebaseService, useValue: mockFirebaseService },
      ],
    }).compile();

    service = module.get<GuestAuthService>(GuestAuthService);
    jest.clearAllMocks();
    mockJwtService.sign.mockReturnValue('guest_jwt_token');
    mockJwtService.decode.mockReturnValue({ sub: 'user-123', type: 'USER' });
    mockPrisma.$transaction.mockImplementation((fn) =>
      Array.isArray(fn) ? Promise.all(fn) : fn(mockPrisma),
    );
  });

  // ── verifyPhone ────────────────────────────────────────────────────────────

  describe('verifyPhone', () => {
    it('creates a guest session on successful Firebase verification', async () => {
      mockFirebaseService.verifyPhoneToken.mockResolvedValue({ phoneNumber: '+84901234567' });
      mockPrisma.guestSession.create.mockResolvedValue(mockSession);

      const result = await service.verifyPhone({ firebaseIdToken: 'valid-firebase-token' }, '127.0.0.1');

      expect(result.accessToken).toBe('guest_jwt_token');
      expect(result.guestSessionId).toBe('guest-session-1');
      expect(result.phone).toBe('0901234567');
    });

    it('throws UnauthorizedException when Firebase token is invalid', async () => {
      mockFirebaseService.verifyPhoneToken.mockRejectedValue(new Error('Invalid token'));

      await expect(
        service.verifyPhone({ firebaseIdToken: 'bad-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── refreshToken ───────────────────────────────────────────────────────────

  describe('refreshToken', () => {
    it('returns a new token for a valid non-expired session', async () => {
      mockPrisma.guestSession.findUnique.mockResolvedValue(mockSession);

      const result = await service.refreshToken('guest-session-1');

      expect(result.accessToken).toBeDefined();
    });

    it('throws UnauthorizedException when session is expired', async () => {
      mockPrisma.guestSession.findUnique.mockResolvedValue({
        ...mockSession,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refreshToken('guest-session-1')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when session not found', async () => {
      mockPrisma.guestSession.findUnique.mockResolvedValue(null);

      await expect(service.refreshToken('bad-session')).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── logout ─────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('expires the guest session', async () => {
      mockPrisma.guestSession.update.mockResolvedValue(mockSession);

      const result = await service.logout('guest-session-1');

      expect(result).toBeDefined();
      expect(mockPrisma.guestSession.update).toHaveBeenCalled();
    });
  });

  // ── convertToUser ──────────────────────────────────────────────────────────

  describe('convertToUser', () => {
    it('throws BadRequestException when session is already converted', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-123' });
      mockPrisma.guestSession.findUnique.mockResolvedValue({
        ...mockSession,
        isConverted: true,
      });

      await expect(
        service.convertToUser('guest-session-1', 'valid-access-token'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when session not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-123' });
      mockPrisma.guestSession.findUnique.mockResolvedValue(null);

      await expect(
        service.convertToUser('bad-session', 'valid-access-token'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
