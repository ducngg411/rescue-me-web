import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const mockUser = {
  id: 'user-123',
  email: 'user@test.com',
  name: 'Test User',
  fullName: 'Test User',
  hashedPassword: 'hashed',
  role: UserRole.USER,
  profileCompleted: true,
};

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    jest.clearAllMocks();
  });

  // ── updateProfile ──────────────────────────────────────────────────────────

  describe('updateProfile', () => {
    it('updates profile successfully for USER role', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      const updated = { ...mockUser, fullName: 'New Name' };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await service.updateProfile(
        'user-123',
        { fullName: 'New Name', phoneNumber: '0901234567' } as any,
        UserRole.USER,
      );

      expect(result).not.toHaveProperty('hashedPassword');
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });

    it('throws ForbiddenException when role is not USER', async () => {
      await expect(
        service.updateProfile('user-123', {} as any, UserRole.PROVIDER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateProfile('missing-id', {} as any, UserRole.USER),
      ).rejects.toThrow(NotFoundException);
    });

    it('syncs primary vehicle columns when vehicles array is provided', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue(mockUser);

      await service.updateProfile(
        'user-123',
        {
          fullName: 'Test',
          phoneNumber: '0901234567',
          vehicles: [{ type: 'CAR', plateNumber: '30A-12345', color: 'White' }],
        } as any,
        UserRole.USER,
      );

      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      expect(updateCall.data.vehicleType).toBe('CAR');
      expect(updateCall.data.licensePlate).toBe('30A-12345');
    });

    it('clears primary vehicle columns when vehicles array is empty', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue(mockUser);

      await service.updateProfile(
        'user-123',
        { fullName: 'Test', phoneNumber: '0901234567', vehicles: [] } as any,
        UserRole.USER,
      );

      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      expect(updateCall.data.vehicleType).toBeNull();
      expect(updateCall.data.licensePlate).toBeNull();
    });
  });

  // ── updateAvatar ───────────────────────────────────────────────────────────

  describe('updateAvatar', () => {
    it('updates avatar URL successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, avatar: 'https://new-avatar.com/img.jpg' });

      const result = await service.updateAvatar('user-123', 'https://new-avatar.com/img.jpg');

      expect(result).not.toHaveProperty('hashedPassword');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { avatar: 'https://new-avatar.com/img.jpg' } }),
      );
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateAvatar('missing-id', 'https://avatar.jpg'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── getProfile ─────────────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('returns sanitized user profile', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getProfile('user-123');

      expect(result.email).toBe('user@test.com');
      expect(result).not.toHaveProperty('hashedPassword');
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('missing-id')).rejects.toThrow(NotFoundException);
    });
  });
});
