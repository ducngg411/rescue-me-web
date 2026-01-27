import { Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRescueRequestDto } from './dto/create-rescue-request.dto';

@Injectable()
export class RescueRequestService {
    constructor(private prisma: PrismaService) { }

    // Auto-expire MATCHING requests every minute
    @Cron(CronExpression.EVERY_MINUTE)
    async autoExpireMatchingRequests() {
        const result = await this.checkAndExpireRequests();
        if (result.totalProcessed > 0) {
            console.log(`⏰ [Cron] Processed ${result.totalProcessed} requests (Phase 1→2: ${result.phase1ToPhase2}, Phase 2→EXPIRED: ${result.phase2ToExpired})`);
        }
    }

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

        // U2: Auto-transition to MATCHING state - Phase 1 (60s)
        const now = new Date();
        const phase1Timeout = 60; // Phase 1: 60 seconds normal radius
        const expiresAt = new Date(now.getTime() + phase1Timeout * 1000);

        // Create rescue request with MATCHING status
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
                status: 'MATCHING', // U2: Start in MATCHING state
                matchingStartedAt: now,
                expiresAt: expiresAt,
                matchAttempts: 1,
                searchPhase: 1, // Phase 1: normal radius search
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

        // Mark video uploads as confirmed (attached to request)
        if (dto.videoUploadIds && dto.videoUploadIds.length > 0) {
            await this.prisma.upload.updateMany({
                where: {
                    id: { in: dto.videoUploadIds },
                    userId,
                },
                data: {
                    confirmed: true,
                },
            });
            console.log(`✅ [RescueRequest] Confirmed ${dto.videoUploadIds.length} video uploads`);
        }

        console.log('✅ [RescueRequest] Created request:', rescueRequest.id);
        console.log('📊 [RescueRequest] Media created:', rescueRequest.media.length);
        console.log('🔍 [RescueRequest] Phase 1: MATCHING (normal radius), expires at:', expiresAt.toISOString());

        // TODO: Broadcast to providers in normal radius (P2 - Provider side)
        // this.broadcastToProviders(rescueRequest, { radiusKm: 10 });

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
                assignedProvider: {
                    select: {
                        id: true,
                        name: true,
                        serviceName: true,
                        serviceTypes: true,
                        phoneNumber: true,
                        pricePerKm: true,
                        baseFee: true,
                        isOnline: true,
                        // Add rating/reviews if available in future
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

        // U2: Allow cancellation if status is CREATED, MATCHING, or SEARCHING
        if (!['CREATED', 'MATCHING', 'SEARCHING'].includes(request.status)) {
            throw new Error('Cannot cancel request in current status');
        }

        console.log(`🚫 [RescueRequest] Cancelling request ${requestId} with status ${request.status}`);

        return this.prisma.rescueRequest.update({
            where: { id: requestId },
            data: { status: 'CANCELLED' },
            include: {
                media: true,
            },
        });
    }

    async retryRescueRequest(requestId: string, userId: string) {
        // Get original request
        const originalRequest = await this.getRescueRequestById(requestId, userId);

        // Only allow retry if status is EXPIRED or CANCELLED
        if (!['EXPIRED', 'CANCELLED'].includes(originalRequest.status)) {
            throw new Error('Can only retry EXPIRED or CANCELLED requests');
        }

        console.log(`🔄 [RescueRequest] Retrying request ${requestId}`);

        // Create new request with same data - start with Phase 1
        const now = new Date();
        const phase1Timeout = 60; // Phase 1: 60 seconds
        const expiresAt = new Date(now.getTime() + phase1Timeout * 1000);

        const newRequest = await this.prisma.rescueRequest.create({
            data: {
                userId,
                incidentType: originalRequest.incidentType,
                vehicleType: originalRequest.vehicleType,
                description: originalRequest.description,
                contactPhone: originalRequest.contactPhone,
                pickupLocation: originalRequest.pickupLocation as any,
                dropoffLocation: originalRequest.dropoffLocation as any,
                videoUrls: originalRequest.videoUrls,
                status: 'MATCHING',
                matchingStartedAt: now,
                expiresAt: expiresAt,
                matchAttempts: (originalRequest.matchAttempts || 0) + 1,
                searchPhase: 1, // Restart with Phase 1
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

        console.log(`✅ [RescueRequest] Created retry request: ${newRequest.id}`);

        return newRequest;
    }

    async getRequestStatus(requestId: string, userId: string) {
        const request = await this.getRescueRequestById(requestId, userId);

        return {
            id: request.id,
            status: request.status,
            matchingStartedAt: request.matchingStartedAt,
            assignedAt: request.assignedAt,
            expiresAt: request.expiresAt,
            matchAttempts: request.matchAttempts,
            searchPhase: request.searchPhase, // U2: Include search phase for 2-phase matching
            assignedProvider: request.assignedProvider,
        };
    }

    async checkAndExpireRequests() {
        const now = new Date();

        // U2: 2-Phase Matching Logic
        // Find all MATCHING requests that have expired
        const expiredRequests = await this.prisma.rescueRequest.findMany({
            where: {
                status: 'MATCHING',
                expiresAt: {
                    lte: now,
                },
            },
        });

        let phase1ToPhase2Count = 0;
        let phase2ToExpiredCount = 0;

        for (const request of expiredRequests) {
            if (request.searchPhase === 1) {
                // Phase 1 → Phase 2: Expand search radius + 30s extra
                const phase2Timeout = 30; // Phase 2: 30 seconds expanded radius
                const newExpiresAt = new Date(now.getTime() + phase2Timeout * 1000);

                await this.prisma.rescueRequest.update({
                    where: { id: request.id },
                    data: {
                        searchPhase: 2,
                        expiresAt: newExpiresAt,
                    },
                });

                console.log(`🔄 [RescueRequest] ${request.id} → Phase 2 (expanded search), new expires: ${newExpiresAt.toISOString()}`);
                phase1ToPhase2Count++;

                // TODO: Broadcast to providers with expanded radius (P2 - Provider side)
                // this.broadcastToProviders(request, { radiusKm: 20 });
            } else if (request.searchPhase === 2) {
                // Phase 2 → EXPIRED: No providers found in expanded search
                await this.prisma.rescueRequest.update({
                    where: { id: request.id },
                    data: {
                        status: 'EXPIRED',
                    },
                });

                console.log(`⏰ [RescueRequest] ${request.id} → EXPIRED (no providers found after Phase 2)`);
                phase2ToExpiredCount++;
            }
        }

        if (phase1ToPhase2Count > 0 || phase2ToExpiredCount > 0) {
            console.log(`📊 [RescueRequest] Phase 1→2: ${phase1ToPhase2Count}, Phase 2→EXPIRED: ${phase2ToExpiredCount}`);
        }

        return {
            phase1ToPhase2: phase1ToPhase2Count,
            phase2ToExpired: phase2ToExpiredCount,
            totalProcessed: expiredRequests.length,
        };
    }
}
