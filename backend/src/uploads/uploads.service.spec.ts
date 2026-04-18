import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadsService } from './uploads.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://presigned.r2.example.com/test-key?sig=abc'),
}));

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      destroy: jest.fn().mockResolvedValue({ result: 'ok' }),
    },
  },
}));

const mockConfigService = {
  get: jest.fn((key: string) => {
    const map: Record<string, string> = {
      R2_ENDPOINT: 'https://acc.r2.cloudflarestorage.com',
      R2_ACCESS_KEY_ID: 'test-key-id',
      R2_SECRET_ACCESS_KEY: 'test-secret',
      R2_BUCKET_NAME: 'test-bucket',
      R2_PUBLIC_DOMAIN: 'https://cdn.example.com',
      CLOUDINARY_CLOUD_NAME: 'test-cloud',
      CLOUDINARY_API_KEY: 'test-api-key',
      CLOUDINARY_API_SECRET: 'test-secret',
    };
    return map[key];
  }),
};

const mockPrisma = {
  upload: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  user: { findUnique: jest.fn() },
};

const mockUpload = {
  id: 'upload-001',
  userId: 'user-123',
  purpose: 'REQUEST_PHOTO',
  objectKey: 'requests/user-123/test.jpg',
  fileName: 'test.jpg',
  fileSize: 102400,
  contentType: 'image/jpeg',
  publicUrl: 'https://cdn.example.com/requests/user-123/test.jpg',
  confirmed: false,
  storageType: 'R2',
  cloudinaryPublicId: null,
  docType: null,
  createdAt: new Date(),
};

describe('UploadsService', () => {
  let service: UploadsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<UploadsService>(UploadsService);
    jest.clearAllMocks();
    mockPrisma.upload.findMany.mockResolvedValue([]);
  });

  // ── presignUpload ──────────────────────────────────────────────────────────

  describe('presignUpload', () => {
    it('generates presigned URL for request photo upload', async () => {
      mockPrisma.upload.create.mockResolvedValue({ ...mockUpload, id: 'upload-001' });

      const result = await service.presignUpload('user-123', {
        purpose: 'request_photo' as any,
        fileName: 'test.jpg',
        fileSize: 102400,
        contentType: 'image/jpeg',
      });

      expect(result.uploadUrl).toContain('presigned.r2.example.com');
      expect(result.uploadId).toBe('upload-001');
    });

    it('throws BadRequestException when PROVIDER_VERIFICATION upload has no docType', async () => {
      await expect(
        service.presignUpload('user-123', {
          purpose: 'provider_verification' as any,
          fileName: 'id.jpg',
          fileSize: 200000,
          contentType: 'image/jpeg',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when file size exceeds limit', async () => {
      await expect(
        service.presignUpload('user-123', {
          purpose: 'request_photo' as any,
          fileName: 'huge.jpg',
          fileSize: 20 * 1024 * 1024,
          contentType: 'image/jpeg',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for unsupported content type', async () => {
      await expect(
        service.presignUpload('user-123', {
          purpose: 'request_photo' as any,
          fileName: 'doc.pdf',
          fileSize: 100000,
          contentType: 'application/pdf',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── confirmUpload ──────────────────────────────────────────────────────────

  describe('confirmUpload', () => {
    it('marks upload as confirmed', async () => {
      mockPrisma.upload.findUnique.mockResolvedValue(mockUpload);
      mockPrisma.upload.update.mockResolvedValue({ ...mockUpload, confirmed: true });

      const result = await service.confirmUpload('user-123', 'upload-001');

      expect(result.success).toBe(true);
    });

    it('throws NotFoundException when upload not found', async () => {
      mockPrisma.upload.findUnique.mockResolvedValue(null);

      await expect(service.confirmUpload('user-123', 'bad-id')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user does not own the upload', async () => {
      mockPrisma.upload.findUnique.mockResolvedValue({ ...mockUpload, userId: 'other-user' });

      await expect(service.confirmUpload('user-123', 'upload-001')).rejects.toThrow(ForbiddenException);
    });
  });

  // ── deleteUpload ───────────────────────────────────────────────────────────

  describe('deleteUpload', () => {
    it('deletes an R2 upload', async () => {
      mockPrisma.upload.findUnique.mockResolvedValue(mockUpload);
      mockPrisma.upload.delete.mockResolvedValue(mockUpload);

      const result = await service.deleteUpload('user-123', 'upload-001');

      expect(result.success).toBe(true);
    });

    it('throws NotFoundException when upload not found', async () => {
      mockPrisma.upload.findUnique.mockResolvedValue(null);

      await expect(service.deleteUpload('user-123', 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── getUserUploads ─────────────────────────────────────────────────────────

  describe('getUserUploads', () => {
    it('returns all uploads for a user', async () => {
      mockPrisma.upload.findMany.mockResolvedValue([mockUpload]);

      const result = await service.getUserUploads('user-123');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('upload-001');
    });

    it('filters uploads by purpose when provided', async () => {
      mockPrisma.upload.findMany.mockResolvedValue([]);

      await service.getUserUploads('user-123', 'provider_verification' as any);

      expect(mockPrisma.upload.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ purpose: 'PROVIDER_VERIFICATION' }),
        }),
      );
    });
  });

  // ── trackCloudinaryUpload ──────────────────────────────────────────────────

  describe('trackCloudinaryUpload', () => {
    it('creates a confirmed cloudinary upload record', async () => {
      const cloudinaryUpload = {
        id: 'upload-002',
        userId: 'user-123',
        purpose: 'REQUEST_VIDEO',
        cloudinaryPublicId: 'rescue/video-abc',
        publicUrl: 'https://res.cloudinary.com/test-cloud/video/rescue/video-abc',
        confirmed: false,
        createdAt: new Date(),
      };
      mockPrisma.upload.findMany.mockResolvedValue([]);
      mockPrisma.upload.create.mockResolvedValue(cloudinaryUpload);

      const result = await service.trackCloudinaryUpload('user-123', {
        cloudinaryPublicId: 'rescue/video-abc',
        publicUrl: 'https://res.cloudinary.com/test-cloud/video/rescue/video-abc',
        resourceType: 'video',
        fileName: 'incident.mp4',
        fileSize: 5_000_000,
      } as any);

      expect(result.uploadId).toBe('upload-002');
    });
  });

  // ── deleteCloudinaryUpload ─────────────────────────────────────────────────

  describe('deleteCloudinaryUpload', () => {
    it('deletes cloudinary upload by uploadId', async () => {
      mockPrisma.upload.findUnique.mockResolvedValue({
        ...mockUpload,
        storageType: 'CLOUDINARY',
        cloudinaryPublicId: 'rescue/video-abc',
        purpose: 'REQUEST_VIDEO',
      });
      mockPrisma.upload.delete.mockResolvedValue({});

      const result = await service.deleteCloudinaryUpload('user-123', 'upload-001');

      expect(result.success).toBe(true);
    });

    it('throws NotFoundException when upload does not exist', async () => {
      mockPrisma.upload.findUnique.mockResolvedValue(null);

      await expect(service.deleteCloudinaryUpload('user-123', 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
