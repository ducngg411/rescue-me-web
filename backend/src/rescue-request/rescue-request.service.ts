import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRescueRequestDto } from './dto/create-rescue-request.dto';

@Injectable()
export class RescueRequestService {
    constructor(private prisma: PrismaService) { }

    async createRescueRequest(userId: string, dto: CreateRescueRequestDto) {
        console.log('📝 [RescueRequest] Creating request for user:', userId);
        console.log('📝 [RescueRequest] DTO:', JSON.stringify(dto, null, 2));
        console.log('📸 [RescueRequest] Media objectKeys:', dto.mediaObjectKeys);
        console.log('🎥 [RescueRequest] Video URLs:', dto.videoUrls);
        console.log('🎥 [RescueRequest] Video UploadIds:', dto.videoUploadIds);

        // Validate user exists
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Prepare media items
        const mediaItems: Array<{
            mediaType: string;
            objectKey: string | null;
            fileName: string;
            fileSize: number;
            contentType: string;
            publicUrl: string;
            cloudinaryPublicId: string | null;
        }> = [];

        // Add images from mediaObjectKeys
        if (dto.mediaObjectKeys && dto.mediaObjectKeys.length > 0) {
            for (const objectKey of dto.mediaObjectKeys) {
                const fileName = objectKey.split('/').pop() || 'unknown';
                mediaItems.push({
                    mediaType: 'IMAGE',
                    objectKey,
                    fileName,
                    fileSize: 0,
                    contentType: 'image/jpeg',
                    publicUrl: `${process.env.R2_PUBLIC_DOMAIN}/${objectKey}`,
                    cloudinaryPublicId: null,
                });
            }
        }

        // Add videos from videoUploadIds (preferred) or videoUrls (legacy)
        if (dto.videoUploadIds && dto.videoUploadIds.length > 0) {
            // Fetch video upload details
            const videoUploads = await this.prisma.upload.findMany({
                where: {
                    id: { in: dto.videoUploadIds },
                    userId,
                    purpose: 'REQUEST_VIDEO',
                },
            });

            for (const upload of videoUploads) {
                mediaItems.push({
                    mediaType: 'VIDEO',
                    objectKey: null, // Cloudinary videos don't use R2
                    fileName: upload.fileName,
                    fileSize: upload.fileSize,
                    contentType: upload.contentType,
                    publicUrl: upload.publicUrl,
                    cloudinaryPublicId: upload.cloudinaryPublicId,
                });
            }
        } else if (dto.videoUrls && dto.videoUrls.length > 0) {
            // Legacy: support old videoUrls format
            for (const videoUrl of dto.videoUrls) {
                mediaItems.push({
                    mediaType: 'VIDEO',
                    objectKey: null,
                    fileName: 'video.mp4',
                    fileSize: 0,
                    contentType: 'video/mp4',
                    publicUrl: videoUrl,
                    cloudinaryPublicId: null,
                });
            }
        }

        console.log(`📊 [RescueRequest] Total media items:`, mediaItems.length);

        // Create rescue request
        const rescueRequest = await this.prisma.rescueRequest.create({
            data: {
                userId,
                incidentType: dto.incidentType,
                vehicleType: dto.vehicleType,
                description: dto.description,
                contactPhone: dto.contactPhone,
                pickupLocation: dto.pickupLocation as any,
                dropoffLocation: dto.dropoffLocation as any,
                videoUrls: dto.videoUrls || [], // Keep for backward compatibility
                status: 'CREATED',
                // Create associated media
                media: mediaItems.length > 0
                    ? {
                        create: mediaItems,
                    }
                    : undefined,
            },
            include: {
                media: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phoneNumber: true,
                    },
                },
            },
        });

        console.log('✅ [RescueRequest] Created request:', rescueRequest.id);
        console.log('📊 [RescueRequest] Media created:', rescueRequest.media.length);

        return rescueRequest;
    }

    async getUserRescueRequests(userId: string) {
        return this.prisma.rescueRequest.findMany({
            where: { userId },
            include: {
                media: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async getRescueRequestById(requestId: string, userId: string) {
        const request = await this.prisma.rescueRequest.findFirst({
            where: {
                id: requestId,
                userId, // Ensure user can only access their own requests
            },
            include: {
                media: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phoneNumber: true,
                    },
                },
            },
        });

        if (!request) {
            throw new NotFoundException('Rescue request not found');
        }

        return request;
    }

    async cancelRescueRequest(requestId: string, userId: string) {
        // Check if request exists and belongs to user
        const request = await this.getRescueRequestById(requestId, userId);

        // Only allow cancellation if status is CREATED or SEARCHING
        if (!['CREATED', 'SEARCHING'].includes(request.status)) {
            throw new Error('Cannot cancel request in current status');
        }

        return this.prisma.rescueRequest.update({
            where: { id: requestId },
            data: { status: 'CANCELLED' },
            include: {
                media: true,
            },
        });
    }
}
