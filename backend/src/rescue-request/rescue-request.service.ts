import { Injectable, NotFoundException, BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRescueRequestDto } from './dto/create-rescue-request.dto';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { QuoteStatus } from './dto/quote-response.dto';
import { CommissionService } from '../wallet/commission.service';


@Injectable()
export class RescueRequestService {
    constructor(
        private prisma: PrismaService,
        private commissionService: CommissionService,
    ) { }

    // Auto-expire MATCHING requests every minute
    @Cron(CronExpression.EVERY_MINUTE)
    async autoExpireMatchingRequests() {
        const result = await this.checkAndExpireRequests();
        if (result.totalProcessed > 0) {
            console.log(`⏰ [Cron] Processed ${result.totalProcessed} requests (Phase 1→2: ${result.phase1ToPhase2}, Phase 2→EXPIRED: ${result.phase2ToExpired})`);
        }
    }

    // Auto-expire PENDING quotes every minute
    @Cron(CronExpression.EVERY_MINUTE)
    async autoExpireQuotes() {
        const result = await this.checkAndExpireQuotes();
        if (result.expired > 0) {
            console.log(`⏰ [Cron] Expired ${result.expired} pending quotes`);
        }
    }

    // Auto-close quote windows (Case 2: Window expires) every 10 seconds
    @Cron(CronExpression.EVERY_10_SECONDS)
    async autoCloseQuoteWindows() {
        const result = await this.checkAndCloseQuoteWindows();
        if (result.closed > 0) {
            console.log(`⏰ [Cron] Closed ${result.closed} quote windows (time expired)`);
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

        // U2: Auto-transition to MATCHING state - Phase 1 (60s for search phase)
        const now = new Date();
        const phase1Timeout = 60; // Phase 1: 60 seconds normal radius search
        const phaseExpiresAt = new Date(now.getTime() + phase1Timeout * 1000);

        // Quote Window: 3 minutes from creation (providers can submit quotes during this time)
        const quoteWindowDuration = 180; // 3 minutes (180 seconds)
        const quoteWindowExpiresAt = new Date(now.getTime() + quoteWindowDuration * 1000);

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
                expiresAt: phaseExpiresAt, // Search phase expiration (for phase 1 -> phase 2 transition)
                matchAttempts: 1,
                searchPhase: 1, // Phase 1: normal radius search
                // Quote window settings
                quoteWindowDuration,
                quoteWindowExpiresAt,
                maxQuotes: 3, // Default max 3 quotes
                quoteCount: 0,
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
            console.log(` [RescueRequest] Confirmed ${dto.videoUploadIds.length} video uploads`);
        }

        console.log(' [RescueRequest] Created request:', rescueRequest.id);
        console.log('📊 [RescueRequest] Media created:', mediaItems.length);
        console.log('🔍 [RescueRequest] Phase 1: MATCHING (normal radius), phase expires at:', phaseExpiresAt.toISOString());
        console.log('📋 [RescueRequest] Quote window expires at:', quoteWindowExpiresAt.toISOString());

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
                        averageRating: true,
                        reviewCount: true,
                    },
                },
            },
        });

        if (!request) {
            throw new NotFoundException('Rescue request not found');
        }

        return request;
    }

    /**
     * Provider xem chi tiết request để gửi báo giá
     * Provider can view MATCHING requests or requests assigned to them
     */
    async getRequestForProvider(requestId: string, providerId: string) {
        // Validate provider
        const provider = await this.prisma.user.findUnique({
            where: { id: providerId },
        });

        if (!provider || provider.role !== 'PROVIDER') {
            throw new Error('Only providers can access this endpoint');
        }

        // Get request
        const request = await this.prisma.rescueRequest.findUnique({
            where: { id: requestId },
            include: {
                media: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        phoneNumber: true,
                        fullName: true,
                        licensePlate: true,
                        vehicleColor: true,
                    },
                },
            },
        });

        if (!request) {
            throw new NotFoundException('Rescue request not found');
        }

        // Provider can only view:
        // 1. MATCHING requests (to send quotes) - only if quote window is still open
        // 2. Requests assigned to them
        if (request.status !== 'MATCHING' && request.assignedProviderId !== providerId) {
            throw new ForbiddenException('You do not have permission to view this request');
        }

        // If MATCHING status, check if quote window is still open
        if (request.status === 'MATCHING' && request.assignedProviderId !== providerId) {
            const now = new Date();

            // Check if quote window is closed
            if (request.quoteWindowClosedAt) {
                console.log(`❌ [Provider View] Quote window closed at ${request.quoteWindowClosedAt.toISOString()}`);
                throw new BadRequestException('QUOTE_WINDOW_CLOSED: Yêu cầu này đã đóng cửa sổ nhận báo giá');
            }

            // Check if quote window has expired
            if (request.quoteWindowExpiresAt && now > request.quoteWindowExpiresAt) {
                console.log(`❌ [Provider View] Quote window expired at ${request.quoteWindowExpiresAt.toISOString()}`);
                throw new BadRequestException('QUOTE_WINDOW_CLOSED: Cửa sổ nhận báo giá đã hết hạn');
            }

            // Check if slots are already full
            if (request.quoteCount >= request.maxQuotes) {
                console.log(`❌ [Provider View] Slots full: ${request.quoteCount}/${request.maxQuotes}`);
                throw new BadRequestException('SLOTS_FULL: Đã đủ số lượng báo giá');
            }
        }

        // Track that this provider is viewing the request (only for MATCHING status with open window)
        if (request.status === 'MATCHING') {
            const currentViewingProviders = request.viewingProviders || [];

            if (!currentViewingProviders.includes(providerId)) {
                await this.prisma.rescueRequest.update({
                    where: { id: requestId },
                    data: {
                        viewingProviders: {
                            push: providerId,
                        },
                        viewingUpdatedAt: new Date(),
                    },
                });
                console.log(`👀 [RescueRequest] Provider ${providerId} is now viewing request ${requestId}`);
            }
        }

        // Calculate quote window status for response
        const now = new Date();
        let quoteWindowOpen = false;
        let quoteWindowTimeRemaining = 0;

        if (request.status === 'MATCHING' && !request.quoteWindowClosedAt && request.quoteWindowExpiresAt) {
            if (now < request.quoteWindowExpiresAt) {
                quoteWindowOpen = true;
                quoteWindowTimeRemaining = Math.max(0, Math.floor((request.quoteWindowExpiresAt.getTime() - now.getTime()) / 1000));
            }
        }

        // Check if slots are full
        if (request.quoteCount >= request.maxQuotes) {
            quoteWindowOpen = false;
        }

        // Return request with quote window info
        return {
            ...request,
            quoteWindowOpen,
            quoteWindowTimeRemaining,
        };
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

    async declineRequest(requestId: string, providerId: string) {
        // Validate request exists and is in MATCHING status
        const request = await this.prisma.rescueRequest.findUnique({
            where: { id: requestId },
        });

        if (!request) {
            throw new NotFoundException('Rescue request not found');
        }

        if (request.status !== 'MATCHING') {
            // Already assigned or cancelled - no need to decline
            return { success: true, message: 'Request no longer available' };
        }

        // Add provider to declined list to prevent spam
        const currentDeclinedProviders = request.declinedProviders || [];

        if (!currentDeclinedProviders.includes(providerId)) {
            await this.prisma.rescueRequest.update({
                where: { id: requestId },
                data: {
                    declinedProviders: {
                        push: providerId,
                    },
                },
            });
            console.log(`🚫 [RescueRequest] Provider ${providerId} declined request ${requestId}`);
        }

        return { success: true, message: 'Request declined successfully' };
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

        console.log(` [RescueRequest] Created retry request: ${newRequest.id}`);

        return newRequest;
    }

    async getRequestStatus(requestId: string, userId: string) {
        const request = await this.getRescueRequestById(requestId, userId);

        // Clean up stale viewing providers (older than 5 minutes)
        let viewingProvidersCount = 0;
        if (request.status === 'MATCHING' && request.viewingProviders && request.viewingProviders.length > 0) {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            if (request.viewingUpdatedAt && request.viewingUpdatedAt < fiveMinutesAgo) {
                // Clear stale viewing providers
                await this.prisma.rescueRequest.update({
                    where: { id: requestId },
                    data: {
                        viewingProviders: [],
                        viewingUpdatedAt: null,
                    },
                });
                viewingProvidersCount = 0;
            } else {
                viewingProvidersCount = request.viewingProviders.length;
            }
        }

        // Count actual quotes from database (for backward compatibility with old requests)
        const actualQuoteCount = await this.prisma.quote.count({
            where: {
                rescueRequestId: requestId,
                status: 'PENDING',
            },
        });

        // Use the actual count from database (more reliable than cached field)
        const quoteCount = actualQuoteCount;

        // Calculate quote window status
        const now = new Date();
        let quoteWindowOpen = false;
        let quoteWindowTimeRemaining = 0;

        if (request.status === 'MATCHING' && !request.quoteWindowClosedAt) {
            if (request.quoteWindowExpiresAt) {
                // Has quote window configured
                if (now < request.quoteWindowExpiresAt) {
                    quoteWindowOpen = true;
                    quoteWindowTimeRemaining = Math.max(0, Math.floor((request.quoteWindowExpiresAt.getTime() - now.getTime()) / 1000));
                }
            } else {
                // Old request without quote window - use phase expiration as fallback
                if (request.expiresAt && now < request.expiresAt) {
                    quoteWindowOpen = true;
                    quoteWindowTimeRemaining = Math.max(0, Math.floor((request.expiresAt.getTime() - now.getTime()) / 1000));
                }
            }
        }

        const statusResponse = {
            id: request.id,
            status: request.status,
            createdAt: request.createdAt,
            incidentType: request.incidentType,
            pickupLocation: request.pickupLocation,
            matchingStartedAt: request.matchingStartedAt,
            assignedAt: request.assignedAt,
            expiresAt: request.expiresAt,
            matchAttempts: request.matchAttempts,
            searchPhase: request.searchPhase,
            matchedDistance: request.matchedDistance,
            matchedEta: request.matchedEta,
            assignedProvider: request.assignedProvider,
            viewingProvidersCount,
            // Quote window info
            quoteCount,
            maxQuotes: request.maxQuotes || 3, // Default to 3 if undefined
            quoteWindowOpen,
            quoteWindowTimeRemaining,
            quoteWindowExpiresAt: request.quoteWindowExpiresAt,
            quoteWindowClosedAt: request.quoteWindowClosedAt,
        };

        console.log(`📊 [Request ${requestId}] Status response:`, {
            status: statusResponse.status,
            matchedDistance: statusResponse.matchedDistance,
            matchedEta: statusResponse.matchedEta,
            hasProvider: !!statusResponse.assignedProvider,
            viewingProvidersCount,
            quoteWindow: {
                open: quoteWindowOpen,
                timeRemaining: quoteWindowTimeRemaining,
                count: `${quoteCount}/${request.maxQuotes || 3}`,
                actualCountFromDB: actualQuoteCount,
                cachedCount: request.quoteCount,
            },
        });

        console.log(`🔍 [DEBUG] Full status response:`, JSON.stringify(statusResponse, null, 2));

        return statusResponse;
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
                // Phase 2 → EXPIRED only if there are NO pending quotes waiting for user selection
                // If there are quotes, the request stays MATCHING and user will be prompted to choose
                const pendingQuoteCount = await this.prisma.quote.count({
                    where: {
                        rescueRequestId: request.id,
                        status: 'PENDING',
                    },
                });

                if (pendingQuoteCount > 0) {
                    // Has quotes waiting → do NOT expire, let user select
                    console.log(`⏸️ [RescueRequest] ${request.id} has ${pendingQuoteCount} pending quote(s) — skipping EXPIRED, waiting for user to select`);
                } else {
                    // No quotes → expire as normal
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

    /**
     * Check and close quote windows that have expired (Case 2)
     */
    async checkAndCloseQuoteWindows() {
        const now = new Date();

        // Find MATCHING requests with expired quote windows that haven't been closed yet
        const expiredWindows = await this.prisma.rescueRequest.findMany({
            where: {
                status: 'MATCHING',
                quoteWindowExpiresAt: {
                    lte: now,
                },
                quoteWindowClosedAt: null, // Not yet closed
            },
        });

        let closedCount = 0;

        for (const request of expiredWindows) {
            await this.prisma.rescueRequest.update({
                where: { id: request.id },
                data: {
                    quoteWindowClosedAt: now,
                },
            });

            console.log(`🔒 [Quote Window] Closed for request ${request.id} - time expired (received ${request.quoteCount}/${request.maxQuotes} quotes)`);
            closedCount++;
        }

        return {
            closed: closedCount,
        };
    }

    // ==================== QUOTE METHODS ====================

    /**
     * P2: Provider gửi báo giá cho rescue request
     */
    async createQuote(
        rescueRequestId: string,
        providerId: string,
        dto: CreateQuoteDto,
    ) {
        console.log('💰 [Quote] Creating quote for request:', rescueRequestId);

        // Validate rescue request exists and is in MATCHING state
        const rescueRequest = await this.prisma.rescueRequest.findUnique({
            where: { id: rescueRequestId },
            include: { user: true },
        });

        if (!rescueRequest) {
            throw new NotFoundException('Rescue request not found');
        }

        if (rescueRequest.status !== 'MATCHING') {
            throw new BadRequestException('Request is not available for quotes');
        }

        // Check if quote window is still open
        const now = new Date();

        // Check 1: Window was explicitly closed
        if (rescueRequest.quoteWindowClosedAt) {
            console.log(`❌ [Quote] Window closed at ${rescueRequest.quoteWindowClosedAt.toISOString()}`);
            throw new BadRequestException('QUOTE_WINDOW_CLOSED');
        }

        // Check 2: Window expiration time has passed
        if (!rescueRequest.quoteWindowExpiresAt) {
            // Old request without quote window configured - reject to be safe
            console.log(`❌ [Quote] Request has no quote window configured (old request)`);
            throw new BadRequestException('QUOTE_WINDOW_CLOSED');
        }

        if (now > rescueRequest.quoteWindowExpiresAt) {
            console.log(`❌ [Quote] Window expired at ${rescueRequest.quoteWindowExpiresAt.toISOString()}, now is ${now.toISOString()}`);
            throw new BadRequestException('QUOTE_WINDOW_CLOSED');
        }

        // Check 3: Slots are full
        if (rescueRequest.quoteCount >= rescueRequest.maxQuotes) {
            console.log(`❌ [Quote] Slots full: ${rescueRequest.quoteCount}/${rescueRequest.maxQuotes}`);
            throw new BadRequestException('SLOTS_FULL');
        }

        console.log(` [Quote] Window check passed. Expires at: ${rescueRequest.quoteWindowExpiresAt.toISOString()}, now: ${now.toISOString()}, remaining: ${Math.floor((rescueRequest.quoteWindowExpiresAt.getTime() - now.getTime()) / 1000)}s`);

        // Validate provider
        const provider = await this.prisma.user.findUnique({
            where: { id: providerId },
        });

        if (!provider || provider.role !== 'PROVIDER') {
            throw new ForbiddenException('Invalid provider');
        }

        // Check if provider already sent a quote for this request
        const existingQuote = await this.prisma.quote.findFirst({
            where: {
                rescueRequestId,
                providerId,
                status: 'PENDING',
            },
        });

        if (existingQuote) {
            throw new BadRequestException('You already sent a quote for this request');
        }

        // Individual Quote TTL: 2 minutes from now (quotes sent early expire sooner)
        const quoteTTL = 2 * 60 * 1000; // 2 minutes
        const quoteExpiresAt = new Date(now.getTime() + quoteTTL);

        // Create quote and increment quote count in a transaction
        const result = await this.prisma.$transaction(async (tx) => {
            // Create the quote
            const quote = await tx.quote.create({
                data: {
                    rescueRequestId,
                    providerId,
                    price: dto.price,
                    estimatedArrivalMinutes: dto.estimatedArrivalMinutes,
                    message: dto.message,
                    providerLocation: dto.providerLocation ? (dto.providerLocation as any) : undefined,
                    status: 'PENDING',
                    expiresAt: quoteExpiresAt,
                },
                include: {
                    provider: {
                        select: {
                            id: true,
                            name: true,
                            avatar: true,
                            serviceName: true,
                            phoneNumber: true,
                        },
                    },
                },
            });

            // Increment quote count
            const newQuoteCount = rescueRequest.quoteCount + 1;
            const updateData: any = {
                quoteCount: newQuoteCount,
            };

            // If this reaches maxQuotes, close the quote window immediately (Case 1)
            if (newQuoteCount >= rescueRequest.maxQuotes) {
                updateData.quoteWindowClosedAt = now;
                console.log(`🔒 [Quote] Quote window closed for request ${rescueRequestId} - maxQuotes (${rescueRequest.maxQuotes}) reached`);
            }

            await tx.rescueRequest.update({
                where: { id: rescueRequestId },
                data: updateData,
            });

            return quote;
        });

        console.log(` [Quote] Quote created: ${result.id}, expires at ${quoteExpiresAt.toISOString()}, count: ${rescueRequest.quoteCount + 1}/${rescueRequest.maxQuotes}`);
        return result;
    }

    /**
     * U3: User xem danh sách báo giá cho rescue request
     */
    async getQuotesByRequest(rescueRequestId: string, callerId: string) {
        // Validate request exists
        const rescueRequest = await this.prisma.rescueRequest.findUnique({
            where: { id: rescueRequestId },
        });

        if (!rescueRequest) {
            throw new NotFoundException('Rescue request not found');
        }

        // Allow access if:
        // 1. Caller is the request owner (user), OR
        // 2. Caller is a provider who has submitted a quote for this request
        const isOwner = rescueRequest.userId === callerId;
        const isProvider = await this.prisma.quote.findFirst({
            where: { rescueRequestId, providerId: callerId },
        });

        if (!isOwner && !isProvider) {
            throw new ForbiddenException('Access denied');
        }

        // Get all quotes for this request
        const quotes = await this.prisma.quote.findMany({
            where: { rescueRequestId },
            include: {
                provider: {
                    select: {
                        id: true,
                        name: true,
                        avatar: true,
                        serviceName: true,
                        phoneNumber: true,
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });

        return quotes;
    }

    /**
     * U3: User accept/reject báo giá
     */
    async respondQuote(
        rescueRequestId: string,
        quoteId: string,
        userId: string,
        action: 'ACCEPT' | 'REJECT',
        rejectionReason?: string,
    ) {
        console.log(`💬 [Quote] User ${action} quote:`, quoteId);

        // Validate rescue request
        const rescueRequest = await this.prisma.rescueRequest.findUnique({
            where: { id: rescueRequestId },
        });

        if (!rescueRequest) {
            throw new NotFoundException('Rescue request not found');
        }

        if (rescueRequest.userId !== userId) {
            throw new ForbiddenException('You can only respond to quotes for your own request');
        }

        if (rescueRequest.status !== 'MATCHING') {
            throw new BadRequestException('Request is not available for quote response');
        }

        // Validate quote
        const quote = await this.prisma.quote.findUnique({
            where: { id: quoteId },
            include: { provider: true },
        });

        if (!quote) {
            throw new NotFoundException('Quote not found');
        }

        if (quote.rescueRequestId !== rescueRequestId) {
            throw new Error('Quote does not belong to this request');
        }

        if (quote.status !== 'PENDING') {
            throw new Error('Quote is not available for response');
        }

        const now = new Date();

        if (action === 'ACCEPT') {
            // Accept quote: Update quote status and assign provider to request
            await this.prisma.$transaction(async (tx) => {
                // Update quote status to ACCEPTED
                await tx.quote.update({
                    where: { id: quoteId },
                    data: {
                        status: 'ACCEPTED',
                        userRespondedAt: now,
                    },
                });

                // Update rescue request: MATCHING → ASSIGNED
                await tx.rescueRequest.update({
                    where: { id: rescueRequestId },
                    data: {
                        status: 'ASSIGNED',
                        assignedProviderId: quote.providerId,
                        assignedAt: now,
                        // Calculate distance/ETA from provider location
                        matchedDistance: null, // TODO: Calculate from providerLocation
                        matchedEta: quote.estimatedArrivalMinutes,
                    },
                });

                // Cancel other pending quotes for this request
                await tx.quote.updateMany({
                    where: {
                        rescueRequestId,
                        id: { not: quoteId },
                        status: 'PENDING',
                    },
                    data: {
                        status: 'CANCELLED',
                    },
                });
            });

            console.log(' [Quote] Quote accepted, request ASSIGNED to provider');
        } else {
            // Reject quote
            await this.prisma.quote.update({
                where: { id: quoteId },
                data: {
                    status: 'REJECTED',
                    rejectionReason,
                    userRespondedAt: now,
                },
            });

            console.log('❌ [Quote] Quote rejected');
        }

        // Return updated quote
        const updatedQuote = await this.prisma.quote.findUnique({
            where: { id: quoteId },
            include: {
                provider: {
                    select: {
                        id: true,
                        name: true,
                        avatar: true,
                        serviceName: true,
                        phoneNumber: true,
                    },
                },
            },
        });

        return updatedQuote;
    }

    /**
     * Provider bắt đầu di chuyển: ASSIGNED → IN_PROGRESS
     */
    async startNavigation(requestId: string, providerId: string) {
        const request = await this.prisma.rescueRequest.findUnique({ where: { id: requestId } });
        if (!request) throw new NotFoundException('Rescue request not found');
        if (request.assignedProviderId !== providerId) throw new ForbiddenException('Not assigned to this request');
        if (request.status === 'IN_PROGRESS') return { success: true, status: 'IN_PROGRESS' };
        if (request.status !== 'ASSIGNED') throw new BadRequestException(`Cannot start from status: ${request.status}`);
        await this.prisma.rescueRequest.update({ where: { id: requestId }, data: { status: 'IN_PROGRESS' } });
        console.log(`🚗 [RescueRequest] Provider ${providerId} started navigation → IN_PROGRESS`);
        return { success: true, status: 'IN_PROGRESS' };
    }

    /**
     * Provider đã đến nơi: IN_PROGRESS → ARRIVED (chờ user xác nhận)
     * PATCH /rescue-requests/:id/mark-arrived
     */
    async markArrived(requestId: string, providerId: string) {
        const request = await this.prisma.rescueRequest.findUnique({ where: { id: requestId } });
        if (!request) throw new NotFoundException('Rescue request not found');
        if (request.assignedProviderId !== providerId) throw new ForbiddenException('Not assigned to this request');
        if (request.status === 'ARRIVED') return { success: true, status: 'ARRIVED' };
        if (request.status !== 'IN_PROGRESS') throw new BadRequestException(`Cannot mark arrived from status: ${request.status}`);
        await this.prisma.rescueRequest.update({ where: { id: requestId }, data: { status: 'ARRIVED' } });
        console.log(`📍 [RescueRequest] Provider ${providerId} marked arrived → ARRIVED (awaiting user confirmation)`);
        return { success: true, status: 'ARRIVED' };
    }

    /**
     * User xác nhận provider đã đến: ARRIVED → WORKING
     * PATCH /rescue-requests/:id/confirm-arrival
     */
    async confirmArrival(requestId: string, userId: string) {
        const request = await this.prisma.rescueRequest.findUnique({ where: { id: requestId } });
        if (!request) throw new NotFoundException('Rescue request not found');
        if (request.userId !== userId) throw new ForbiddenException('Not your request');
        if (request.status === 'WORKING') return { success: true, status: 'WORKING' };
        if (request.status !== 'ARRIVED') throw new BadRequestException(`Cannot confirm arrival from status: ${request.status}`);
        await this.prisma.rescueRequest.update({ where: { id: requestId }, data: { status: 'WORKING' } });
        console.log(` [RescueRequest] User ${userId} confirmed arrival → WORKING`);
        return { success: true, status: 'WORKING' };
    }

    /**
     * User từ chối xác nhận: ARRIVED → IN_PROGRESS (provider chưa đến nơi thực sự)
     * PATCH /rescue-requests/:id/deny-arrival
     */
    async denyArrival(requestId: string, userId: string) {
        const request = await this.prisma.rescueRequest.findUnique({ where: { id: requestId } });
        if (!request) throw new NotFoundException('Rescue request not found');
        if (request.userId !== userId) throw new ForbiddenException('Not your request');
        if (request.status !== 'ARRIVED') throw new BadRequestException(`Cannot deny arrival from status: ${request.status}`);
        await this.prisma.rescueRequest.update({ where: { id: requestId }, data: { status: 'IN_PROGRESS' } });
        console.log(`❌ [RescueRequest] User ${userId} denied arrival → back to IN_PROGRESS`);
        return { success: true, status: 'IN_PROGRESS' };
    }

    /**
     * Provider hoàn thành công việc: WORKING → COMPLETED
     * PATCH /rescue-requests/:id/complete-service
     */
    async completeService(requestId: string, providerId: string) {
        const request = await this.prisma.rescueRequest.findUnique({ where: { id: requestId } });
        if (!request) throw new NotFoundException('Rescue request not found');
        if (request.assignedProviderId !== providerId) throw new ForbiddenException('Not assigned to this request');
        if (request.status === 'COMPLETED') return { success: true, status: 'COMPLETED' };
        if (!['IN_PROGRESS', 'ARRIVED', 'WORKING'].includes(request.status)) throw new BadRequestException(`Cannot complete from status: ${request.status}`);
        await this.prisma.rescueRequest.update({
            where: { id: requestId },
            data: { status: 'COMPLETED', completedAt: new Date() },
        });
        console.log(` [RescueRequest] Provider ${providerId} completed service → COMPLETED`);

        // Deduct platform commission for CASH payments (fire-and-forget, non-blocking)
        // The commission service will create a DEBIT transaction and reduce availableBalance.
        // If balance goes negative the provider is blocked from receiving new jobs.
        setImmediate(async () => {
            try {
                const payment = await this.prisma.payment.findUnique({
                    where: { requestId },
                });
                if (payment && payment.paymentMethod === 'CASH') {
                    const result = await this.commissionService.handleCashJobCompletion(requestId);
                    console.log(
                        `💰 [Commission] Cash commission deducted for job ${requestId}: ` +
                        `${result.commissionAmount} VND (${result.commissionRate * 100}%). ` +
                        `New balance: ${result.walletSnapshot.availableBalance} VND`,
                    );
                }
            } catch (err) {
                console.error(`❌ [Commission] Failed to deduct commission for job ${requestId}:`, err.message);
            }
        });

        return { success: true, status: 'COMPLETED' };
    }

    /**
     * Provider xem danh sách quotes đã gửi
     */
    async getProviderQuotes(providerId: string) {
        const quotes = await this.prisma.quote.findMany({
            where: { providerId },
            include: {
                rescueRequest: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                phoneNumber: true,
                            },
                        },
                        media: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return quotes;
    }

    /**
     * Auto-expire PENDING quotes that exceeded expiresAt
     */
    async checkAndExpireQuotes() {
        const now = new Date();

        // Find PENDING quotes that have expired
        const expiredQuotes = await this.prisma.quote.findMany({
            where: {
                status: 'PENDING',
                expiresAt: {
                    lte: now,
                },
            },
        });

        let expiredCount = 0;

        for (const quote of expiredQuotes) {
            await this.prisma.quote.update({
                where: { id: quote.id },
                data: {
                    status: 'EXPIRED',
                },
            });
            expiredCount++;
        }

        if (expiredCount > 0) {
            console.log(`📊 [Quote] Expired ${expiredCount} pending quotes`);
        }

        return {
            expired: expiredCount,
        };
    }

    // ==================== PAYMENT METHODS ====================

    /**
     * Provider tạo yêu cầu thanh toán: WORKING/ARRIVED/IN_PROGRESS → PAYMENT_PENDING
     * POST /rescue-requests/:id/payment
     */
    async createPayment(requestId: string, providerId: string, dto: {
        totalAmount: number;
        baseFee?: number;
        distanceFee?: number;
        overtimeFee?: number;
        otherFee?: number;
        paymentMethod?: 'CASH' | 'QR';
        surchargeNote?: string;
        note?: string;
        photoUrls?: string[];
    }) {
        const request = await this.prisma.rescueRequest.findUnique({
            where: { id: requestId },
        });
        if (!request) throw new NotFoundException('Rescue request not found');
        if (request.assignedProviderId !== providerId) throw new ForbiddenException('Not assigned to this request');
        if (!['WORKING', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'].includes(request.status)) {
            throw new BadRequestException(`Cannot create payment from status: ${request.status}`);
        }

        // Upsert payment (allow re-submission to update amount)
        const payment = await this.prisma.payment.upsert({
            where: { requestId },
            create: {
                requestId,
                providerId,
                userId: request.userId,
                totalAmount: dto.totalAmount,
                baseFee: dto.baseFee ?? dto.totalAmount,
                distanceFee: dto.distanceFee ?? 0,
                overtimeFee: dto.overtimeFee ?? 0,
                otherFee: dto.otherFee ?? 0,
                paymentMethod: (dto.paymentMethod ?? 'CASH') as any,
                surchargeNote: dto.surchargeNote,
                note: dto.note,
                photoUrls: dto.photoUrls ?? [],
                status: 'PENDING',
            },
            update: {
                totalAmount: dto.totalAmount,
                baseFee: dto.baseFee ?? dto.totalAmount,
                distanceFee: dto.distanceFee ?? 0,
                overtimeFee: dto.overtimeFee ?? 0,
                otherFee: dto.otherFee ?? 0,
                paymentMethod: (dto.paymentMethod ?? 'CASH') as any,
                surchargeNote: dto.surchargeNote,
                note: dto.note,
                photoUrls: dto.photoUrls ?? [],
                status: 'PENDING',
            },
        });

        // Advance status to PAYMENT_PENDING (skip if already past that)
        if (['WORKING', 'ARRIVED', 'IN_PROGRESS'].includes(request.status)) {
            await this.prisma.rescueRequest.update({
                where: { id: requestId },
                data: { status: 'PAYMENT_PENDING' },
            });
        }

        console.log(`💳 [Payment] Provider ${providerId} created payment for request ${requestId}: ${dto.totalAmount} VND`);
        return payment;
    }

    /**
     * User xác nhận đã chuyển tiền / trả tiền mặt
     * PATCH /rescue-requests/:id/payment/confirm-sent
     */
    async confirmPaymentSent(requestId: string, userId: string) {
        const request = await this.prisma.rescueRequest.findUnique({
            where: { id: requestId },
        });
        if (!request) throw new NotFoundException('Rescue request not found');
        if (request.userId !== userId) throw new ForbiddenException('Not your request');

        const payment = await this.prisma.payment.findUnique({
            where: { requestId },
        });
        if (!payment) throw new NotFoundException('Payment not found for this request');
        if (payment.userConfirmedAt) {
            return payment; // Already confirmed — idempotent
        }

        const updated = await this.prisma.payment.update({
            where: { requestId },
            data: {
                userConfirmedAt: new Date(),
                status: 'USER_CONFIRMED',
            },
        });

        console.log(`✅ [Payment] User ${userId} confirmed payment sent for request ${requestId}`);
        return updated;
    }

    /**
     * User báo sự cố thanh toán
     * POST /rescue-requests/:id/payment/dispute
     */
    async disputePayment(requestId: string, userId: string, reason: string) {
        const request = await this.prisma.rescueRequest.findUnique({
            where: { id: requestId },
        });
        if (!request) throw new NotFoundException('Rescue request not found');
        if (request.userId !== userId) throw new ForbiddenException('Not your request');

        const payment = await this.prisma.payment.findUnique({
            where: { requestId },
        });
        if (!payment) throw new NotFoundException('Payment not found for this request');

        const updated = await this.prisma.payment.update({
            where: { requestId },
            data: {
                status: 'DISPUTED',
                disputeReason: reason,
                disputedAt: new Date(),
            },
        });

        console.log(`⚠️ [Payment] User ${userId} disputed payment for request ${requestId}: ${reason}`);
        return updated;
    }

    /**
     * Provider xác nhận đã nhận được tiền
     * PATCH /rescue-requests/:id/payment/confirm-received
     */
    async confirmPaymentReceived(requestId: string, providerId: string) {
        const request = await this.prisma.rescueRequest.findUnique({
            where: { id: requestId },
        });
        if (!request) throw new NotFoundException('Rescue request not found');
        if (request.assignedProviderId !== providerId) throw new ForbiddenException('Not assigned to this request');

        const payment = await this.prisma.payment.findUnique({
            where: { requestId },
        });
        if (!payment) throw new NotFoundException('Payment not found for this request');
        if (payment.providerConfirmedAt) {
            return payment; // Already confirmed — idempotent
        }

        const updated = await this.prisma.payment.update({
            where: { requestId },
            data: {
                providerConfirmedAt: new Date(),
                status: 'PROVIDER_CONFIRMED',
            },
        });

        // Mark the rescue request as COMPLETED once both sides confirm
        await this.prisma.rescueRequest.update({
            where: { id: requestId },
            data: { status: 'COMPLETED', completedAt: new Date() },
        });

        // Deduct CASH commission now that provider confirmed receipt
        setImmediate(async () => {
            try {
                if (payment.paymentMethod === 'CASH') {
                    const result = await this.commissionService.handleCashJobCompletion(requestId);
                    console.log(
                        `💰 [Commission] Cash commission deducted on confirm-received for job ${requestId}: ` +
                        `${result.commissionAmount} VND. New balance: ${result.walletSnapshot.availableBalance} VND`,
                    );
                }
            } catch (err) {
                console.error(`❌ [Commission] Failed to deduct commission for job ${requestId}:`, err.message);
            }
        });

        console.log(`✅ [Payment] Provider ${providerId} confirmed payment received for request ${requestId}`);
        return updated;
    }

    /**
     * Lấy thông tin payment của request (dùng cho real-time polling từ cả hai phía)
     * GET /rescue-requests/:id/payment
     */
    async getPayment(requestId: string, callerId: string) {
        const request = await this.prisma.rescueRequest.findUnique({
            where: { id: requestId },
        });
        if (!request) throw new NotFoundException('Rescue request not found');
        if (request.userId !== callerId && request.assignedProviderId !== callerId) {
            throw new ForbiddenException('Access denied');
        }

        const payment = await this.prisma.payment.findUnique({
            where: { requestId },
        });
        return payment;
    }

    // ==================== REVIEW METHODS ====================

    /**
     * User submits a star rating + optional comment for the provider
     * after the rescue request is COMPLETED.
     */
    async submitReview(
        requestId: string,
        userId: string,
        dto: { rating: number; comment?: string; tags?: string[] },
    ) {
        // Validate rating range
        if (dto.rating < 1 || dto.rating > 5 || !Number.isInteger(dto.rating)) {
            throw new BadRequestException('Rating must be an integer between 1 and 5');
        }

        // Fetch the request (must belong to this user and be COMPLETED)
        const request = await this.prisma.rescueRequest.findFirst({
            where: { id: requestId, userId },
        });

        if (!request) {
            throw new NotFoundException('Rescue request not found');
        }

        if (request.status !== 'COMPLETED') {
            throw new BadRequestException('Can only review completed service requests');
        }

        if (!request.assignedProviderId) {
            throw new BadRequestException('No provider assigned to this request');
        }

        // Prevent duplicate reviews
        const existing = await this.prisma.review.findUnique({
            where: { rescueRequestId: requestId },
        });

        if (existing) {
            throw new BadRequestException('You have already reviewed this service');
        }

        const providerId = request.assignedProviderId;

        // Create review + update provider stats in a transaction
        const review = await this.prisma.$transaction(async (tx) => {
            const created = await tx.review.create({
                data: {
                    rescueRequestId: requestId,
                    userId,
                    providerId,
                    rating: dto.rating,
                    comment: dto.comment?.trim() || null,
                    tags: dto.tags || [],
                },
            });

            // Recompute provider average rating
            const agg = await tx.review.aggregate({
                where: { providerId },
                _avg: { rating: true },
                _count: { rating: true },
            });

            await tx.user.update({
                where: { id: providerId },
                data: {
                    averageRating: agg._avg.rating ?? dto.rating,
                    reviewCount: agg._count.rating,
                },
            });

            return created;
        });

        console.log(`⭐ [Review] User ${userId} rated provider ${providerId} — ${dto.rating} stars`);

        return review;
    }
}

