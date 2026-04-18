import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthProvider, ResetType } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { FirebaseService } from '../firebase/firebase.service';

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-uuid-1234'),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true),
}));

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn().mockResolvedValue({
      getPayload: () => ({
        email: 'google@test.com',
        name: 'Google User',
        picture: 'https://pic.test',
        sub: 'google-sub-123',
      }),
    }),
  })),
}));

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  session: {
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  },
  passwordResetToken: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn().mockImplementation((fnOrArr) =>
    Array.isArray(fnOrArr) ? Promise.all(fnOrArr) : fnOrArr(mockPrisma),
  ),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock_jwt_token'),
  verify: jest.fn(),
};

const mockMailService = {
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
};

const mockFirebaseService = {
  verifyPhoneToken: jest.fn(),
};

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  hashedPassword: 'hashed_password',
  authProvider: AuthProvider.EMAIL,
  profileCompleted: false,
  bannedAt: null,
  banReason: null,
  role: 'USER',
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: MailService, useValue: mockMailService },
        { provide: FirebaseService, useValue: mockFirebaseService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    mockJwtService.sign.mockReturnValue('mock_jwt_token');
    mockPrisma.session.upsert.mockResolvedValue({});
  });

  // ── registerWithEmail ──────────────────────────────────────────────────────

  describe('registerWithEmail', () => {
    it('creates a new user and returns tokens on success', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await service.registerWithEmail({
        email: 'test@example.com',
        password: 'Password1!',
        name: 'Test User',
      });

      expect(result.tokens.accessToken).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
      expect(result.user).not.toHaveProperty('hashedPassword');
      expect(result.requiresProfileCompletion).toBe(true);
    });

    it('throws ConflictException when email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.registerWithEmail({ email: 'test@example.com', password: 'pass', name: 'x' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── loginWithEmail ─────────────────────────────────────────────────────────

  describe('loginWithEmail', () => {
    it('returns tokens for valid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, profileCompleted: true });
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, profileCompleted: true });
      const bcrypt = require('bcryptjs');
      bcrypt.compare.mockResolvedValue(true);

      const result = await service.loginWithEmail({
        email: 'test@example.com',
        password: 'Password1!',
      });

      expect(result.tokens.accessToken).toBeDefined();
      expect(result.requiresProfileCompletion).toBe(false);
    });

    it('throws UnauthorizedException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.loginWithEmail({ email: 'no@exist.com', password: 'x' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws BadRequestException when user registered via Google', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        authProvider: AuthProvider.GOOGLE,
      });

      await expect(
        service.loginWithEmail({ email: 'test@example.com', password: 'x' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException for banned users', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        bannedAt: new Date(),
        banReason: 'spam',
      });

      await expect(
        service.loginWithEmail({ email: 'test@example.com', password: 'x' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws UnauthorizedException when password is incorrect', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      const bcrypt = require('bcryptjs');
      bcrypt.compare.mockResolvedValue(false);

      await expect(
        service.loginWithEmail({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── loginWithGoogle ────────────────────────────────────────────────────────

  describe('loginWithGoogle', () => {
    it('creates a new user when Google account does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ ...mockUser, authProvider: AuthProvider.GOOGLE });

      const result = await service.loginWithGoogle('valid-google-id-token');

      expect(result.isNewUser).toBe(true);
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });

    it('logs in existing Google user and updates lastLogin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, authProvider: AuthProvider.GOOGLE });
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, authProvider: AuthProvider.GOOGLE });

      const result = await service.loginWithGoogle('valid-google-id-token');

      expect(result.isNewUser).toBe(false);
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });
  });

  // ── forgotPasswordByEmail ──────────────────────────────────────────────────

  describe('forgotPasswordByEmail', () => {
    it('sends reset email and returns success message', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.passwordResetToken.create.mockResolvedValue({ id: 'token-1', token: 'abc' });

      const result = await service.forgotPasswordByEmail({ email: 'test@example.com' });

      expect(result.message).toBeDefined();
      expect(mockMailService.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('throws NotFoundException when email not registered', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.forgotPasswordByEmail({ email: 'unknown@example.com' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for Google accounts', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        authProvider: AuthProvider.GOOGLE,
      });

      await expect(
        service.forgotPasswordByEmail({ email: 'google@example.com' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── resetPassword ──────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('resets password and invalidates sessions', async () => {
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'token-1',
        token: 'abc',
        used: false,
        expiresAt: new Date(Date.now() + 60_000),
        user: mockUser,
      });

      const result = await service.resetPassword({
        token: 'abc',
        newPassword: 'NewPassword1!',
      });

      expect(result.message).toBeDefined();
    });

    it('throws BadRequestException when token is expired', async () => {
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'token-1',
        token: 'abc',
        used: false,
        expiresAt: new Date(Date.now() - 60_000),
        user: mockUser,
      });
      mockPrisma.passwordResetToken.delete.mockResolvedValue({});

      await expect(
        service.resetPassword({ token: 'abc', newPassword: 'NewPass1!' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when token is already used', async () => {
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'token-1',
        token: 'abc',
        used: true,
        expiresAt: new Date(Date.now() + 60_000),
        user: mockUser,
      });

      await expect(
        service.resetPassword({ token: 'abc', newPassword: 'NewPass1!' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── changePassword ─────────────────────────────────────────────────────────

  describe('changePassword', () => {
    it('changes password successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue(mockUser);
      const bcrypt = require('bcryptjs');
      bcrypt.compare.mockResolvedValue(true);

      const result = await service.changePassword('user-123', {
        oldPassword: 'OldPass1!',
        newPassword: 'NewPass1!',
      });

      expect(result.message).toBeDefined();
    });

    it('throws UnauthorizedException when old password is wrong', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      const bcrypt = require('bcryptjs');
      bcrypt.compare.mockResolvedValue(false);

      await expect(
        service.changePassword('user-123', { oldPassword: 'wrong', newPassword: 'NewPass1!' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── logout ─────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('deletes user session and returns success message', async () => {
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.logout('user-123', 'mock_jwt_token');

      expect(result.message).toBeDefined();
      expect(mockPrisma.session.deleteMany).toHaveBeenCalled();
    });
  });

  // ── selectRole ─────────────────────────────────────────────────────────────

  describe('selectRole', () => {
    it('updates user role successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, profileCompleted: false });
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, role: 'PROVIDER' });

      const result = await service.selectRole('user-123', { role: 'PROVIDER' as any });

      expect(result.user).toBeDefined();
    });

    it('throws BadRequestException when profile already completed', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, profileCompleted: true });

      await expect(
        service.selectRole('user-123', { role: 'PROVIDER' as any }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
