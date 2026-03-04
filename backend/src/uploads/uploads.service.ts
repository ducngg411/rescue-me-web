import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaService } from '../prisma/prisma.service';
import { PresignUploadDto, PresignUploadResponseDto, UploadPurpose, DocumentType } from './dto/presign-upload.dto';
import { ConfirmUploadResponseDto } from './dto/confirm-upload.dto';
import { TrackCloudinaryUploadDto, TrackCloudinaryUploadResponseDto } from './dto/cloudinary-upload.dto';
import { UploadPurpose as PrismaUploadPurpose, DocumentType as PrismaDocumentType } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class UploadsService {
    private s3Client: S3Client;
    private bucketName: string;
    private publicDomain: string;

    constructor(
        private configService: ConfigService,
        private prisma: PrismaService,
    ) {
        const endpoint = this.configService.get<string>('R2_ENDPOINT');
        const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
        const secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY');
        const bucketName = this.configService.get<string>('R2_BUCKET_NAME');
        const publicDomain = this.configService.get<string>('R2_PUBLIC_DOMAIN');

        if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName || !publicDomain) {
            throw new Error('Missing required R2 configuration. Please check your .env file.');
        }

        // Initialize R2 client
        this.s3Client = new S3Client({
            region: 'auto',
            endpoint,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        });

        this.bucketName = bucketName;
        this.publicDomain = publicDomain;

        // Initialize Cloudinary
        const cloudinaryCloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
        const cloudinaryApiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
        const cloudinaryApiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

        if (cloudinaryCloudName && cloudinaryApiKey && cloudinaryApiSecret) {
            cloudinary.config({
                cloud_name: cloudinaryCloudName,
                api_key: cloudinaryApiKey,
                api_secret: cloudinaryApiSecret,
            });
            console.log(' Cloudinary configured:', cloudinaryCloudName);
        } else {
            console.warn('  Cloudinary not configured - video upload features will not work');
        }
    }

    async presignUpload(
        userId: string,
        dto: PresignUploadDto,
    ): Promise<PresignUploadResponseDto> {
        // Validate purpose and docType
        if (dto.purpose === UploadPurpose.PROVIDER_VERIFICATION && !dto.docType) {
            throw new BadRequestException('docType is required for provider_verification');
        }

        if (dto.purpose !== UploadPurpose.PROVIDER_VERIFICATION && dto.docType) {
            throw new BadRequestException('docType is only allowed for provider_verification');
        }

        // Validate file size
        if (dto.fileSize > 5 * 1024 * 1024) {
            throw new BadRequestException('File size must not exceed 5MB');
        }

        // Validate content type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(dto.contentType)) {
            throw new BadRequestException(`Content type must be one of: ${allowedTypes.join(', ')}`);
        }

        // Verify user is provider for provider_verification
        if (dto.purpose === UploadPurpose.PROVIDER_VERIFICATION) {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
            });

            if (!user || user.role !== 'PROVIDER') {
                throw new ForbiddenException('Only providers can upload verification documents');
            }

            // Delete existing uploads for this docType to prevent accumulation
            if (dto.docType) {
                await this.deleteUploadsByDocType(userId, dto.purpose, dto.docType);
            }
        }

        // Generate object key
        const objectKey = this.generateObjectKey(userId, dto.purpose, dto.docType, dto.fileName);

        // Generate public URL
        const publicUrl = `${this.publicDomain}/${objectKey}`;

        // Create upload record in database (not confirmed yet)
        const upload = await this.prisma.upload.create({
            data: {
                userId,
                purpose: this.mapPurposeToEnum(dto.purpose),
                docType: dto.docType ? this.mapDocTypeToEnum(dto.docType) : null,
                objectKey,
                fileName: dto.fileName,
                fileSize: dto.fileSize,
                contentType: dto.contentType,
                publicUrl,
                confirmed: false,
            },
        });

        // Generate presigned URL
        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: objectKey,
            ContentType: dto.contentType,
            ContentLength: dto.fileSize,
        });

        const expiresIn = 120; // 120 seconds
        const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn });

        return {
            uploadUrl,
            objectKey,
            publicUrl,
            uploadId: upload.id,
            expiresIn,
        };
    }

    async confirmUpload(userId: string, uploadId: string): Promise<ConfirmUploadResponseDto> {
        // Find upload record
        const upload = await this.prisma.upload.findUnique({
            where: { id: uploadId },
        });

        if (!upload) {
            throw new NotFoundException('Upload not found');
        }

        // Verify ownership
        if (upload.userId !== userId) {
            throw new ForbiddenException('You can only confirm your own uploads');
        }

        // Check if already confirmed
        if (upload.confirmed) {
            throw new BadRequestException('Upload already confirmed');
        }

        // Update upload as confirmed
        const confirmedUpload = await this.prisma.upload.update({
            where: { id: uploadId },
            data: { confirmed: true },
        });

        return {
            success: true,
            upload: {
                id: confirmedUpload.id,
                objectKey: confirmedUpload.objectKey,
                publicUrl: confirmedUpload.publicUrl,
                fileName: confirmedUpload.fileName,
                fileSize: confirmedUpload.fileSize,
                contentType: confirmedUpload.contentType,
                createdAt: confirmedUpload.createdAt,
            },
        };
    }

    private generateObjectKey(
        userId: string,
        purpose: UploadPurpose,
        docType: DocumentType | undefined,
        fileName: string,
    ): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const extension = fileName.split('.').pop();

        switch (purpose) {
            case UploadPurpose.PROVIDER_VERIFICATION:
                if (!docType) {
                    throw new BadRequestException('docType is required for provider_verification');
                }
                return `providers/${userId}/verification/${docType}/${timestamp}_${random}.${extension}`;

            case UploadPurpose.REQUEST_PHOTO:
                return `requests/${userId}/${timestamp}_${random}.${extension}`;

            case UploadPurpose.REVIEW_PHOTO:
                return `reviews/${userId}/${timestamp}_${random}.${extension}`;

            case UploadPurpose.BEFORE_AFTER:
                return `before-after/${userId}/${timestamp}_${random}.${extension}`;

            default:
                throw new BadRequestException('Invalid upload purpose');
        }
    }

    private mapPurposeToEnum(purpose: UploadPurpose): PrismaUploadPurpose {
        const mapping: Record<UploadPurpose, PrismaUploadPurpose> = {
            [UploadPurpose.PROVIDER_VERIFICATION]: PrismaUploadPurpose.PROVIDER_VERIFICATION,
            [UploadPurpose.REQUEST_PHOTO]: PrismaUploadPurpose.REQUEST_PHOTO,
            [UploadPurpose.REVIEW_PHOTO]: PrismaUploadPurpose.REVIEW_PHOTO,
            [UploadPurpose.BEFORE_AFTER]: PrismaUploadPurpose.BEFORE_AFTER,
        };
        return mapping[purpose];
    }

    private mapDocTypeToEnum(docType: DocumentType): PrismaDocumentType {
        const mapping: Record<DocumentType, PrismaDocumentType> = {
            [DocumentType.CITIZEN_ID_FRONT]: PrismaDocumentType.CITIZEN_ID_FRONT,
            [DocumentType.CITIZEN_ID_BACK]: PrismaDocumentType.CITIZEN_ID_BACK,
            [DocumentType.SELFIE]: PrismaDocumentType.SELFIE,
            [DocumentType.CAR_PHOTO]: PrismaDocumentType.CAR_PHOTO,
            [DocumentType.MOTORBIKE_PHOTO]: PrismaDocumentType.MOTORBIKE_PHOTO,
            [DocumentType.DRIVER_LICENSE]: PrismaDocumentType.DRIVER_LICENSE,
            [DocumentType.BUSINESS_REGISTRATION]: PrismaDocumentType.BUSINESS_REGISTRATION,
        };
        return mapping[docType];
    }

    // Get user's uploads
    async getUserUploads(userId: string, purpose?: UploadPurpose) {
        const where: any = { userId, confirmed: true };

        if (purpose) {
            where.purpose = this.mapPurposeToEnum(purpose);
        }

        return this.prisma.upload.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
    }

    // Delete upload (soft delete or hard delete with R2 cleanup)
    async deleteUpload(userId: string, uploadId: string) {
        // Find upload record
        const upload = await this.prisma.upload.findUnique({
            where: { id: uploadId },
        });

        if (!upload) {
            throw new NotFoundException('Upload not found');
        }

        // Verify ownership
        if (upload.userId !== userId) {
            throw new ForbiddenException('You can only delete your own uploads');
        }

        // Delete from R2
        try {
            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: upload.objectKey,
            });
            await this.s3Client.send(command);
        } catch (error) {
            console.error('Failed to delete from R2:', error);
            // Continue with database deletion even if R2 deletion fails
        }

        // Delete from database
        await this.prisma.upload.delete({
            where: { id: uploadId },
        });

        return {
            success: true,
            message: 'Upload deleted successfully',
        };
    }

    // Delete uploads by docType for a user (used when uploading new file for same docType)
    async deleteUploadsByDocType(userId: string, purpose: UploadPurpose, docType: DocumentType) {
        const uploads = await this.prisma.upload.findMany({
            where: {
                userId,
                purpose: this.mapPurposeToEnum(purpose),
                docType: this.mapDocTypeToEnum(docType),
            },
        });

        for (const upload of uploads) {
            try {
                // Delete from R2
                const command = new DeleteObjectCommand({
                    Bucket: this.bucketName,
                    Key: upload.objectKey,
                });
                await this.s3Client.send(command);

                // Delete from database
                await this.prisma.upload.delete({
                    where: { id: upload.id },
                });
            } catch (error) {
                console.error(`Failed to delete upload ${upload.id}:`, error);
                // Continue with next upload
            }
        }

        return {
            success: true,
            deletedCount: uploads.length,
        };
    }

    // ==================== CLOUDINARY METHODS ====================

    /**
     * Track a Cloudinary upload in database
     * Cleanup orphaned videos older than 1 hour that are still unconfirmed
     */
    async trackCloudinaryUpload(
        userId: string,
        dto: TrackCloudinaryUploadDto,
    ): Promise<TrackCloudinaryUploadResponseDto> {
        // Clean up orphaned videos (unconfirmed and older than 1 hour)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const orphanedVideos = await this.prisma.upload.findMany({
            where: {
                userId,
                purpose: 'REQUEST_VIDEO',
                confirmed: false,
                createdAt: {
                    lt: oneHourAgo, // Older than 1 hour
                },
            },
        });

        console.log(`🧹 [Cloudinary] Found ${orphanedVideos.length} orphaned videos to cleanup`);

        // Delete orphaned videos
        for (const video of orphanedVideos) {
            try {
                await this.deleteCloudinaryUpload(userId, video.id);
                console.log(`🗑️ [Cloudinary] Deleted orphaned video: ${video.id}`);
            } catch (error) {
                console.error(`❌ [Cloudinary] Failed to delete orphaned video ${video.id}:`, error);
            }
        }

        // Create new upload record
        const upload = await this.prisma.upload.create({
            data: {
                userId,
                purpose: 'REQUEST_VIDEO',
                storageType: 'CLOUDINARY',
                objectKey: dto.cloudinaryPublicId, // Use public_id as objectKey
                fileName: dto.fileName,
                fileSize: dto.fileSize,
                contentType: dto.contentType,
                publicUrl: dto.publicUrl,
                cloudinaryPublicId: dto.cloudinaryPublicId,
                cloudinaryResourceType: dto.resourceType || 'video',
                confirmed: false,
            },
        });

        return {
            uploadId: upload.id,
            publicUrl: upload.publicUrl,
        };
    }

    /**
     * Delete a Cloudinary video from both Cloudinary and database
     */
    async deleteCloudinaryUpload(userId: string, uploadId: string) {
        try {
            console.log(`[deleteCloudinaryUpload] Starting deletion for uploadId: ${uploadId}, userId: ${userId}`);

            // Find upload
            const upload = await this.prisma.upload.findUnique({
                where: { id: uploadId },
            });

            if (!upload) {
                console.log(`[deleteCloudinaryUpload] Upload not found: ${uploadId}`);
                throw new NotFoundException('Upload not found');
            }

            console.log(`[deleteCloudinaryUpload] Upload found:`, {
                id: upload.id,
                storageType: upload.storageType,
                cloudinaryPublicId: upload.cloudinaryPublicId,
                userId: upload.userId
            });

            // Verify ownership
            if (upload.userId !== userId) {
                console.log(`[deleteCloudinaryUpload] Ownership mismatch - upload.userId: ${upload.userId}, requestUserId: ${userId}`);
                throw new ForbiddenException('You can only delete your own uploads');
            }

            // Only delete from Cloudinary if it's a Cloudinary upload
            if (upload.storageType === 'CLOUDINARY' && upload.cloudinaryPublicId) {
                try {
                    console.log(`[deleteCloudinaryUpload] Deleting from Cloudinary:`, {
                        publicId: upload.cloudinaryPublicId,
                        resourceType: upload.cloudinaryResourceType || 'video'
                    });

                    const result = await cloudinary.uploader.destroy(
                        upload.cloudinaryPublicId,
                        { resource_type: upload.cloudinaryResourceType || 'video' }
                    );

                    console.log(`[deleteCloudinaryUpload] Cloudinary deletion result:`, result);
                } catch (error) {
                    console.error('[deleteCloudinaryUpload] Failed to delete from Cloudinary:', error);
                    // Continue to delete from database anyway
                }
            }

            // Delete from database
            console.log(`[deleteCloudinaryUpload] Deleting from database: ${uploadId}`);
            await this.prisma.upload.delete({
                where: { id: uploadId },
            });

            console.log(`[deleteCloudinaryUpload] Successfully deleted upload: ${uploadId}`);

            return {
                success: true,
                message: 'Video deleted successfully',
            };
        } catch (error) {
            console.error('[deleteCloudinaryUpload] Error:', error);
            throw error;
        }
    }

    /**
     * Confirm Cloudinary uploads (called when creating rescue request)
     * Delete any unconfirmed videos
     */
    async confirmCloudinaryUploads(userId: string, uploadIds: string[]) {
        // Mark specified uploads as confirmed
        await this.prisma.upload.updateMany({
            where: {
                id: { in: uploadIds },
                userId,
            },
            data: {
                confirmed: true,
            },
        });

        // Delete all unconfirmed Cloudinary videos for this user
        const unconfirmedVideos = await this.prisma.upload.findMany({
            where: {
                userId,
                purpose: 'REQUEST_VIDEO',
                confirmed: false,
            },
        });

        for (const video of unconfirmedVideos) {
            await this.deleteCloudinaryUpload(userId, video.id);
        }

        return {
            success: true,
            confirmedCount: uploadIds.length,
            deletedCount: unconfirmedVideos.length,
        };
    }
}
