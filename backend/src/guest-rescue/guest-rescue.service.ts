import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRescueRequestDto } from '../rescue-request/dto/create-rescue-request.dto';
import { RescueRequestService } from '../rescue-request/rescue-request.service';
import { allocateUniqueOrderCode } from '../common/business-codes';

@Injectable()
export class GuestRescueService {
    private readonly logger = new Logger(GuestRescueService.name);

    constructor(
        private prisma: PrismaService,
        private rescueRequestService: RescueRequestService,
    ) {}

    // ==================== OWNERSHIP HELPER ====================

    private async getGuestRequest(requestId: string, guestSessionId: string) {
        const request = await this.prisma.rescueRequest.findFirst({
            where: { id: requestId, guestSessionId },
            include: {
                media: true,
                assignedProvider: {
                    select: {
                        id: true,
                        name: true,
                        fullName: true,
                        serviceName: true,
                        phoneNumber: true,
                        avatar: true,
                        licensePlate: true,
                        vehicleColor: true,
                        vehicleType: true,
                        averageRating: true,
                        reviewCount: true,
                        pricePerKm: true,
                        baseFee: true,
                        isOnline: true,
                    },
                },
                payment: true,
                quotes: true,
            },
        });

        if (!request) {
            throw new NotFoundException('Rescue request not found or access denied');
        }

        return request;
    }

    // ==================== CREATE REQUEST ====================

    async createRescueRequest(guestSessionId: string, dto: CreateRescueRequestDto) {
        this.logger.log(`Guest ${guestSessionId} creating rescue request`);

        const session = await this.prisma.guestSession.findUnique({
            where: { id: guestSessionId },
        });

        if (!session || session.expiresAt < new Date() || session.isConverted) {
            throw new ForbiddenException('Guest session invalid or expired');
        }

        const now = new Date();
        const phase1Timeout = 60;
        const phaseExpiresAt = new Date(now.getTime() + phase1Timeout * 1000);
        const quoteWindowDuration = 180;
        const quoteWindowExpiresAt = new Date(now.getTime() + quoteWindowDuration * 1000);

        const mediaItems: Array<{
            mediaType: string;
            objectKey: string | null;
            fileName: string;
            fileSize: number;
            contentType: string;
            publicUrl: string;
            cloudinaryPublicId: string | null;
        }> = [];

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

        if (dto.videoUrls && dto.videoUrls.length > 0) {
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

        const orderCode = await allocateUniqueOrderCode(this.prisma);
        const rescueRequest = await this.prisma.rescueRequest.create({
            data: {
                orderCode,
                guestSessionId,
                requesterType: 'GUEST',
                incidentType: dto.incidentType,
                vehicleType: dto.vehicleType,
                licensePlate: dto.licensePlate?.trim() || null,
                vehicleColor: dto.vehicleColor?.trim() || null,
                description: dto.description,
                contactPhone: dto.contactPhone || session.phoneNormalized,
                pickupLocation: dto.pickupLocation as any,
                dropoffLocation: dto.dropoffLocation as any,
                videoUrls: dto.videoUrls || [],
                status: 'MATCHING',
                matchingStartedAt: now,
                expiresAt: phaseExpiresAt,
                matchAttempts: 1,
                searchPhase: 1,
                quoteWindowDuration,
                quoteWindowExpiresAt,
                maxQuotes: 3,
                quoteCount: 0,
                media: mediaItems.length > 0 ? { create: mediaItems } : undefined,
            },
            include: { media: true },
        });

        this.logger.log(`Guest request created: ${rescueRequest.id}`);
        return rescueRequest;
    }

    // ==================== STATUS ====================

    async getRequestStatus(requestId: string, guestSessionId: string) {
        const request = await this.getGuestRequest(requestId, guestSessionId);

        let viewingProvidersCount = 0;
        if (request.status === 'MATCHING' && request.viewingProviders?.length > 0) {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            if (request.viewingUpdatedAt && request.viewingUpdatedAt < fiveMinutesAgo) {
                await this.prisma.rescueRequest.update({
                    where: { id: requestId },
                    data: { viewingProviders: [], viewingUpdatedAt: null },
                });
                viewingProvidersCount = 0;
            } else {
                viewingProvidersCount = request.viewingProviders.length;
            }
        }

        const actualQuoteCount = await this.prisma.quote.count({
            where: { rescueRequestId: requestId, status: 'PENDING' },
        });

        const now = new Date();
        let quoteWindowOpen = false;
        let quoteWindowTimeRemaining = 0;

        if (request.status === 'MATCHING' && !request.quoteWindowClosedAt) {
            if (request.quoteWindowExpiresAt && now < request.quoteWindowExpiresAt) {
                quoteWindowOpen = true;
                quoteWindowTimeRemaining = Math.max(
                    0,
                    Math.floor((request.quoteWindowExpiresAt.getTime() - now.getTime()) / 1000),
                );
            }
        }

        return {
            id: request.id,
            orderCode: request.orderCode ?? null,
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
            quoteCount: actualQuoteCount,
            maxQuotes: request.maxQuotes || 3,
            quoteWindowOpen,
            quoteWindowTimeRemaining,
            quoteWindowExpiresAt: request.quoteWindowExpiresAt,
            quoteWindowClosedAt: request.quoteWindowClosedAt,
            requesterType: 'GUEST',
        };
    }

    // ==================== CANCEL ====================

    async cancelRequest(requestId: string, guestSessionId: string) {
        const request = await this.getGuestRequest(requestId, guestSessionId);

        if (!['CREATED', 'MATCHING', 'SEARCHING'].includes(request.status)) {
            throw new BadRequestException('Cannot cancel request in current status');
        }

        return this.prisma.rescueRequest.update({
            where: { id: requestId },
            data: { status: 'CANCELLED' },
            include: { media: true },
        });
    }

    // ==================== QUOTES ====================

    async getQuotes(requestId: string, guestSessionId: string) {
        const request = await this.prisma.rescueRequest.findFirst({
            where: { id: requestId, guestSessionId },
        });

        if (!request) throw new NotFoundException('Rescue request not found or access denied');

        return this.prisma.quote.findMany({
            where: { rescueRequestId: requestId },
            include: {
                provider: {
                    select: {
                        id: true,
                        name: true,
                        avatar: true,
                        serviceName: true,
                        phoneNumber: true,
                        averageRating: true,
                        reviewCount: true,
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
    }

    async respondToQuote(
        requestId: string,
        quoteId: string,
        guestSessionId: string,
        action: 'ACCEPT' | 'REJECT',
        rejectionReason?: string,
    ) {
        const rescueRequest = await this.prisma.rescueRequest.findFirst({
            where: { id: requestId, guestSessionId },
        });

        if (!rescueRequest) throw new NotFoundException('Rescue request not found or access denied');

        if (rescueRequest.status !== 'MATCHING') {
            throw new BadRequestException('Request is not available for quote response');
        }

        const quote = await this.prisma.quote.findUnique({
            where: { id: quoteId },
            include: { provider: true },
        });

        if (!quote) throw new NotFoundException('Quote not found');
        if (quote.rescueRequestId !== requestId) throw new BadRequestException('Quote does not belong to this request');
        if (quote.status !== 'PENDING') throw new BadRequestException('Quote is not available for response');

        const now = new Date();

        if (action === 'ACCEPT') {
            let matchedDistance: number | null = null;
            const pickupLoc = rescueRequest.pickupLocation as { lat?: number; lng?: number } | null;
            if (pickupLoc?.lat != null && pickupLoc?.lng != null) {
                const km = await this.rescueRequestService.getRoadDistanceKmProviderToPickup(
                    quote.providerId,
                    pickupLoc.lat,
                    pickupLoc.lng,
                );
                matchedDistance = km ?? null;
            }

            await this.prisma.$transaction(async (tx) => {
                await tx.quote.update({
                    where: { id: quoteId },
                    data: { status: 'ACCEPTED', userRespondedAt: now },
                });

                await tx.rescueRequest.update({
                    where: { id: requestId },
                    data: {
                        status: 'ASSIGNED',
                        assignedProviderId: quote.providerId,
                        assignedAt: now,
                        matchedDistance,
                        matchedEta: quote.estimatedArrivalMinutes,
                        quoteWindowClosedAt: now,
                    },
                });

                await tx.quote.updateMany({
                    where: { rescueRequestId: requestId, id: { not: quoteId }, status: 'PENDING' },
                    data: { status: 'CANCELLED' },
                });
            });

            return { success: true, action: 'ACCEPT', quoteId, providerId: quote.providerId };
        } else {
            await this.prisma.quote.update({
                where: { id: quoteId },
                data: { status: 'REJECTED', rejectionReason: rejectionReason ?? null, userRespondedAt: now },
            });
            return { success: true, action: 'REJECT', quoteId };
        }
    }

    // ==================== PAYMENT ====================

    async getPayment(requestId: string, guestSessionId: string) {
        const request = await this.prisma.rescueRequest.findFirst({
            where: { id: requestId, guestSessionId },
        });

        if (!request) throw new NotFoundException('Rescue request not found or access denied');

        const payment = await this.prisma.payment.findUnique({ where: { requestId } });
        if (!payment) return null;

        const qrTx = await (this.prisma as any).jobPaymentTransaction.findUnique({
            where: { requestId },
        });

        return {
            ...payment,
            qrTransferCode: qrTx?.transferCode ?? null,
            qrUrl: qrTx
                ? `https://qr.sepay.vn/img?acc=${process.env.SEPAY_BANK_ACCOUNT ?? '07729096901'}&bank=${process.env.SEPAY_BANK_CODE ?? 'TPBank'}&amount=${payment.totalAmount}&des=${encodeURIComponent(qrTx.transferCode)}&template=compact`
                : null,
            qrExpireAt: qrTx?.expireAt ?? null,
            qrStatus: qrTx?.status ?? null,
        };
    }

    async confirmPaymentSent(requestId: string, guestSessionId: string) {
        const request = await this.prisma.rescueRequest.findFirst({
            where: { id: requestId, guestSessionId },
        });

        if (!request) throw new NotFoundException('Rescue request not found or access denied');

        const payment = await this.prisma.payment.findUnique({ where: { requestId } });
        if (!payment) throw new NotFoundException('Payment not found');

        if ((payment.paymentMethod as string) === 'WALLET') {
            throw new ForbiddenException('Wallet payment not allowed for guest users');
        }

        if (payment.userConfirmedAt) {
            return payment;
        }

        return this.prisma.payment.update({
            where: { requestId },
            data: { userConfirmedAt: new Date(), status: 'USER_CONFIRMED' },
        });
    }

    async getQrPaymentStatus(requestId: string, guestSessionId: string) {
        const request = await this.prisma.rescueRequest.findFirst({
            where: { id: requestId, guestSessionId },
        });

        if (!request) throw new NotFoundException('Rescue request not found or access denied');

        return this.rescueRequestService.getQrPaymentStatus(requestId);
    }

    // ==================== ARRIVAL CONFIRMATION ====================

    async confirmArrival(requestId: string, guestSessionId: string) {
        const request = await this.prisma.rescueRequest.findFirst({
            where: { id: requestId, guestSessionId },
        });

        if (!request) throw new NotFoundException('Rescue request not found or access denied');
        if (request.status === 'WORKING') return { success: true, status: 'WORKING' };
        if (request.status !== 'ARRIVED') {
            throw new BadRequestException(`Cannot confirm arrival from status: ${request.status}`);
        }

        await this.prisma.rescueRequest.update({
            where: { id: requestId },
            data: { status: 'WORKING' },
        });

        this.logger.log(`Guest ${guestSessionId} confirmed arrival → WORKING`);
        return { success: true, status: 'WORKING' };
    }

    async denyArrival(requestId: string, guestSessionId: string) {
        const request = await this.prisma.rescueRequest.findFirst({
            where: { id: requestId, guestSessionId },
        });

        if (!request) throw new NotFoundException('Rescue request not found or access denied');
        if (request.status !== 'ARRIVED') {
            throw new BadRequestException(`Cannot deny arrival from status: ${request.status}`);
        }

        await this.prisma.rescueRequest.update({
            where: { id: requestId },
            data: { status: 'IN_PROGRESS' },
        });

        this.logger.log(`Guest ${guestSessionId} denied arrival → IN_PROGRESS`);
        return { success: true, status: 'IN_PROGRESS' };
    }
}
