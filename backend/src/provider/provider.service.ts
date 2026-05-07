import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VietMapService } from '../vietmap/vietmap.service';
import { UpdateProviderProfileDto } from '../auth/dto/auth.dto';
import { Prisma, UserRole, VerificationStatus, ProviderType, DocumentType } from '@prisma/client';
import { SubmitVerificationResponseDto } from './dto/submit-verification.dto';
import { MailService } from '../mail/mail.service';
import { CommissionService } from '../wallet/commission.service';
import {
    grossRevenueFromCompletedRequest,
    whereCompletedJobsInLocalDay,
} from '../stats/provider-job-stats.util';

@Injectable()
export class ProviderService {
    private readonly logger = new Logger(ProviderService.name);
    private static readonly MIN_PROVIDER_DEPOSIT_VND = 100_000;

    constructor(
        private prisma: PrismaService,
        private vietMapService: VietMapService,
        private mailService: MailService,
        private commissionService: CommissionService,
    ) { }

    async updateProfile(userId: string, dto: UpdateProviderProfileDto, userRole: UserRole) {
        // Kiểm tra role phải là PROVIDER
        if (userRole !== UserRole.PROVIDER) {
            throw new ForbiddenException('Chỉ người dùng với role PROVIDER mới có thể cập nhật profile này');
        }

        // Validation logic dựa trên providerType
        if (dto.providerType === ProviderType.BUSINESS) {
            if (!dto.businessName) {
                throw new ForbiddenException('Tên doanh nghiệp là bắt buộc đối với loại BUSINESS');
            }
            if (!dto.businessAddress) {
                throw new ForbiddenException('Địa chỉ doanh nghiệp là bắt buộc đối với loại BUSINESS');
            }
        } else if (dto.providerType === ProviderType.INDIVIDUAL) {
            if (!dto.permanentAddress) {
                throw new ForbiddenException('Địa chỉ thường trú là bắt buộc đối với loại INDIVIDUAL');
            }
        }

        // Validation rescueVehicles
        if (!dto.rescueVehicles || dto.rescueVehicles.length === 0) {
            throw new ForbiddenException('Phải có ít nhất một phương tiện cứu hộ');
        }

        // Validate each rescue vehicle's plate number
        for (const vehicle of dto.rescueVehicles) {
            if (!vehicle.plateNumber || !vehicle.plateNumber.trim()) {
                throw new ForbiddenException(`Biển số xe ${vehicle.type === 'CAR' ? 'ô tô' : 'xe máy'} không được để trống`);
            }
        }

        // Tìm user
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('Người dùng không tồn tại');
        }

        // Cập nhật provider profile với trạng thái DRAFT
        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: {
                fullName: dto.fullName,
                phoneNumber: dto.phoneNumber,
                providerType: dto.providerType,
                businessName: dto.providerType === ProviderType.BUSINESS ? dto.businessName : null,
                serviceTypes: dto.serviceTypes,
                supportedVehicleTypes: dto.supportedVehicleTypes,
                serviceRadiusKm: dto.serviceRadiusKm,
                permanentAddress: dto.providerType === ProviderType.INDIVIDUAL ? dto.permanentAddress as any : null,
                businessAddress: dto.providerType === ProviderType.BUSINESS ? dto.businessAddress as any : null,
                rescueVehicles: dto.rescueVehicles as any,
                verificationStatus: VerificationStatus.DRAFT,
                isActive: false,
                profileCompleted: true, // Đánh dấu hoàn thành profile
            },
        });

        // Loại bỏ hashedPassword
        const { hashedPassword, ...sanitized } = updatedUser;
        return sanitized;
    }

    async getProfile(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('Người dùng không tồn tại');
        }

        const { hashedPassword, ...sanitized } = user;
        return sanitized;
    }

    async submitVerification(userId: string): Promise<SubmitVerificationResponseDto> {
        // Get user with provider profile
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (user.role !== UserRole.PROVIDER) {
            throw new ForbiddenException('Only providers can submit verification');
        }

        if (user.verificationStatus !== VerificationStatus.DRAFT && user.verificationStatus !== VerificationStatus.REJECTED) {
            throw new BadRequestException('Can only submit verification when status is DRAFT or REJECTED');
        }

        const missingFields: string[] = [];
        const missingDocs: string[] = [];

        // Validate required profile fields
        if (!user.fullName) missingFields.push('fullName');
        if (!user.phoneNumber) missingFields.push('phoneNumber');
        if (!user.providerType) missingFields.push('providerType');
        if (!user.serviceTypes || user.serviceTypes.length === 0) missingFields.push('serviceTypes');
        if (!user.supportedVehicleTypes || user.supportedVehicleTypes.length === 0) {
            missingFields.push('supportedVehicleTypes');
        }
        if (!user.serviceRadiusKm) missingFields.push('serviceRadiusKm');

        // Validate address based on provider type
        if (user.providerType === ProviderType.INDIVIDUAL) {
            if (!user.permanentAddress) missingFields.push('permanentAddress');
        } else if (user.providerType === ProviderType.BUSINESS) {
            if (!user.businessName) missingFields.push('businessName');
            if (!user.businessAddress) missingFields.push('businessAddress');
        }

        // Validate rescue vehicles
        const rescueVehicles = user.rescueVehicles as any[];
        if (!rescueVehicles || rescueVehicles.length === 0) {
            missingFields.push('rescueVehicles');
        } else {
            // Validate each vehicle has plate number
            for (const vehicle of rescueVehicles) {
                if (!vehicle.plateNumber || !vehicle.plateNumber.trim()) {
                    missingFields.push(`rescueVehicles.${vehicle.type}.plateNumber`);
                }
            }
        }

        // Validate required documents (Tier 1)
        const uploads = await this.prisma.upload.findMany({
            where: {
                userId,
                confirmed: true,
                purpose: 'PROVIDER_VERIFICATION',
            },
        });

        const uploadedDocTypes = new Set(
            uploads.map(u => u.docType).filter(Boolean)
        );

        // Required docs for all providers (Tier 1)
        const requiredDocs: DocumentType[] = [
            DocumentType.CITIZEN_ID_FRONT,
            DocumentType.CITIZEN_ID_BACK,
            DocumentType.SELFIE,
        ];

        // Add vehicle photo based on rescue vehicles (not supportedVehicleTypes)
        if (rescueVehicles && rescueVehicles.some(v => v.type === 'CAR')) {
            requiredDocs.push(DocumentType.CAR_PHOTO);
        }
        if (rescueVehicles && rescueVehicles.some(v => v.type === 'MOTORCYCLE')) {
            requiredDocs.push(DocumentType.MOTORBIKE_PHOTO);
        }

        // Add business registration if BUSINESS type
        if (user.providerType === ProviderType.BUSINESS) {
            requiredDocs.push(DocumentType.BUSINESS_REGISTRATION);
        }

        // Check missing docs
        for (const docType of requiredDocs) {
            if (!uploadedDocTypes.has(docType)) {
                missingDocs.push(docType);
            }
        }

        // If validation fails, return errors
        if (missingFields.length > 0 || missingDocs.length > 0) {
            return {
                success: false,
                message: 'Please complete all required fields and upload all required documents',
                missingFields: missingFields.length > 0 ? missingFields : undefined,
                missingDocs: missingDocs.length > 0 ? missingDocs : undefined,
            };
        }

        // All validation passed, update status to PENDING
        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: {
                verificationStatus: VerificationStatus.PENDING,
                submittedAt: new Date(),
                isActive: false, // Ensure offline during verification
            },
        });

        // Send confirmation email (fire-and-forget)
        setImmediate(() => {
            this.mailService.sendVerificationSubmitted(
                user.email,
                user.fullName || user.email,
                updatedUser.submittedAt ?? new Date(),
            );
        });

        return {
            success: true,
            message: 'Verification request submitted successfully',
            verificationStatus: updatedUser.verificationStatus,
            submittedAt: updatedUser.submittedAt ?? undefined,
        };
    }

    // Provider Active Mode Methods
    async updateOnlineStatus(userId: string, isOnline: boolean) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (user.role !== UserRole.PROVIDER) {
            throw new ForbiddenException('Only providers can update online status');
        }

        // Chỉ cho phép online nếu đã verified
        if (isOnline && user.verificationStatus !== VerificationStatus.APPROVED) {
            throw new ForbiddenException('Provider must be verified (APPROVED) to go online');
        }

        // Chỉ cho phép online khi đã nạp đủ ký quỹ tối thiểu
        if (isOnline) {
            const wallet = await this.prisma.providerWallet.findUnique({
                where: { providerId: userId },
                select: {
                    availableBalance: true,
                    topupTransactions: { where: { status: 'COMPLETED' }, take: 1, select: { id: true } },
                },
            });
            const availableBalance = wallet?.availableBalance ?? 0;
            if (availableBalance < ProviderService.MIN_PROVIDER_DEPOSIT_VND) {
                const isReturning = (wallet?.topupTransactions?.length ?? 0) > 0;
                throw new ForbiddenException(
                    isReturning
                        ? `Số dư ví đang dưới ngưỡng tối thiểu ${ProviderService.MIN_PROVIDER_DEPOSIT_VND.toLocaleString('vi-VN')} VND. Vui lòng nạp thêm để tiếp tục hoạt động`
                        : `Cần nạp tối thiểu ${ProviderService.MIN_PROVIDER_DEPOSIT_VND.toLocaleString('vi-VN')} VND lần đầu để kích hoạt tài khoản`,
                );
            }
        }

        // Clear currentLocation when going offline
        const updateData: any = { isOnline };
        if (!isOnline) {
            updateData.currentLocation = null;
            updateData.lastLocationUpdate = null;
        }

        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: updateData,
        });

        return {
            success: true,
            isOnline: updatedUser.isOnline,
            message: isOnline ? 'Bạn đang online, sẵn sàng nhận requests' : 'Bạn đã offline',
        };
    }

    async updateCurrentLocation(userId: string, lat: number, lng: number) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (user.role !== UserRole.PROVIDER) {
            throw new ForbiddenException('Only providers can update location');
        }

        if (!user.isOnline) {
            // Provider is offline — silently ignore instead of throwing.
            // Throwing 403 on a high-frequency poll endpoint can race with
            // concurrent requests and cause ERR_HTTP_HEADERS_SENT.
            return { success: false, message: 'Provider is offline, location not updated' };
        }

        const now = new Date();
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                currentLocation: {
                    lat,
                    lng,
                    timestamp: now.toISOString(),
                } as any,
                lastLocationUpdate: now,
            },
        });

        console.log(` [Provider ${userId}] Location updated: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);

        return {
            success: true,
            message: 'Location updated',
        };
    }

    async updateFcmToken(userId: string, fcmToken: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        await this.prisma.user.update({
            where: { id: userId },
            data: { fcmToken },
        });

        this.logger.log(`[Provider ${userId}] FCM token registered`);
        return { success: true };
    }

    async getPendingRequests(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                role: true,
                isOnline: true,
                verificationStatus: true,
                currentLocation: true,
                lastLocationUpdate: true,
                permanentAddress: true,
                businessAddress: true,
                serviceRadiusKm: true,
                supportedVehicleTypes: true,
                serviceTypes: true,
                baseFee: true,
                pricePerKm: true,
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (user.role !== UserRole.PROVIDER) {
            throw new ForbiddenException('Only providers can view pending requests');
        }

        if (!user.isOnline) {
            return { requests: [], activeJobId: null };
        }

        if (user.verificationStatus !== VerificationStatus.APPROVED) {
            return { requests: [], activeJobId: null };
        }

        // Block provider if wallet is below minimum deposit requirement
        const wallet = await this.prisma.providerWallet.findUnique({
            where: { providerId: userId },
            select: { availableBalance: true },
        });
        const availableBalance = wallet?.availableBalance ?? 0;
        if (availableBalance < ProviderService.MIN_PROVIDER_DEPOSIT_VND) {
            // Force offline to keep provider state consistent with deposit policy
            await this.prisma.user.update({
                where: { id: userId },
                data: {
                    isOnline: false,
                    currentLocation: Prisma.JsonNull,
                    lastLocationUpdate: null,
                },
            });
            console.warn(
                `[Provider ${userId}] Blocked from receiving jobs — insufficient deposit (${availableBalance} VND, required >= ${ProviderService.MIN_PROVIDER_DEPOSIT_VND} VND)`,
            );
            return { requests: [], activeJobId: null };
        }

        // Guard: Provider đang có job active → ẩn inbox (tối đa 1 job tại 1 thời điểm)
        const PROVIDER_BUSY_STATUSES = ['ASSIGNED', 'IN_PROGRESS', 'ARRIVED', 'WORKING', 'PAYMENT_PENDING'];
        const activeJob = await this.prisma.rescueRequest.findFirst({
            where: {
                assignedProviderId: userId,
                status: { in: PROVIDER_BUSY_STATUSES as any },
            },
            select: { id: true, status: true },
        });

        if (activeJob) {
            console.log(`[Provider ${userId}] Has active job ${activeJob.id} (${activeJob.status}) — hiding pending request inbox`);
            return { requests: [], activeJobId: activeJob.id };
        }

        // Get provider current location (GPS) - fallback to default address
        let providerLocation = user.currentLocation as any;

        // If no current location, try default addresses (for backward compatibility)
        if (!providerLocation || !providerLocation.lat || !providerLocation.lng) {
            providerLocation = (user.permanentAddress || user.businessAddress) as any;
        }

        if (!providerLocation || !providerLocation.lat || !providerLocation.lng) {
            console.warn(`[Provider ${userId}] No location set (neither current nor default), cannot match requests`);
            return { requests: [], activeJobId: null };
        }

        const providerLat = providerLocation.lat;
        const providerLng = providerLocation.lng;
        const radiusKm = user.serviceRadiusKm || 15;

        // Find MATCHING requests in radius (exclude declined)
        const allMatchingRequests = await this.prisma.rescueRequest.findMany({
            where: {
                status: 'MATCHING',
                assignedProviderId: null,
                // Exclude requests this provider declined
                NOT: {
                    declinedProviders: {
                        has: userId,
                    },
                },
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        phoneNumber: true,
                        fullName: true,
                        avatar: true,
                    },
                },
                media: {
                    select: {
                        mediaType: true,
                        publicUrl: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'asc',
            },
        });

        // Step 1: Pre-filter by Haversine distance (fast, cheap) to reduce VietMap API calls
        const candidateRequests: any[] = [];
        for (const request of allMatchingRequests) {
            const pickupLocation = request.pickupLocation as any;
            if (!pickupLocation || !pickupLocation.lat || !pickupLocation.lng) {
                continue;
            }

            // Use Haversine for initial filtering (straight-line distance)
            const straightLineDistance = this.vietMapService.calculateHaversineDistance(
                providerLat,
                providerLng,
                pickupLocation.lat,
                pickupLocation.lng,
            );

            // Pre-filter: only consider if straight-line distance <= radiusKm * 1.5
            // (actual road distance is usually 1.2-1.8x straight-line)
            if (straightLineDistance <= radiusKm * 1.5) {
                candidateRequests.push(request);
            }
        }

        console.log(` [Provider ${userId}] Found ${candidateRequests.length}/${allMatchingRequests.length} candidates within ${radiusKm * 1.5}km straight-line`);

        if (candidateRequests.length === 0) {
            return { requests: [], activeJobId: null };
        }

        const candidateIds = candidateRequests.map((r) => r.id);
        const pendingQuoteGroups = await this.prisma.quote.groupBy({
            by: ['rescueRequestId'],
            where: {
                rescueRequestId: { in: candidateIds },
                status: 'PENDING',
            },
            _count: { id: true },
        });
        const pendingQuoteCountByRequest: Record<string, number> = {};
        for (const row of pendingQuoteGroups) {
            pendingQuoteCountByRequest[row.rescueRequestId] = row._count.id;
        }

        // Step 2: Calculate REAL routes using VietMap API (with ETA!) — parallel to avoid N×latency
        const routeMap = await this.vietMapService.calculateRoutesParallel(
            providerLat,
            providerLng,
            candidateRequests.map((r) => {
                const loc = r.pickupLocation as any;
                return { lat: loc.lat, lng: loc.lng, id: r.id };
            }),
            'car',
        );

        const matchedRequests: any[] = [];
        for (const request of candidateRequests) {
            const pickupLocation = request.pickupLocation as any;
            const routeInfo = routeMap.get(request.id);
            if (!routeInfo) continue;

            // Check if route is successful and within service radius
            if (routeInfo.success && routeInfo.distance <= radiusKm) {
                const now = new Date();
                const timeRemaining = request.expiresAt
                    ? Math.max(0, Math.floor((request.expiresAt.getTime() - now.getTime()) / 1000))
                    : 0;

                // Calculate quote window status
                let quoteWindowOpen = false;
                let quoteWindowTimeRemaining = 0;
                if (!request.quoteWindowClosedAt && request.quoteWindowExpiresAt) {
                    if (now < request.quoteWindowExpiresAt) {
                        quoteWindowOpen = true;
                        quoteWindowTimeRemaining = Math.max(0, Math.floor((request.quoteWindowExpiresAt.getTime() - now.getTime()) / 1000));
                    }
                }

                const actualQuoteCount = pendingQuoteCountByRequest[request.id] ?? 0;
                const maxQuotes = request.maxQuotes ?? 3;
                if (actualQuoteCount >= maxQuotes) {
                    quoteWindowOpen = false;
                }

                const estimatedEarnings = this.calculateEstimatedEarnings(
                    routeInfo.distance,
                    user.baseFee || 50000,
                    user.pricePerKm || 10000,
                );

                matchedRequests.push({
                    id: request.id,
                    requesterType: request.requesterType ?? 'USER',
                    user: request.user
                        ? {
                            name: request.user.fullName || request.user.name,
                            phone: request.user.phoneNumber,
                        }
                        : {
                            name: 'Khách vãng lai',
                            phone: request.contactPhone,
                        },
                    incidentType: request.incidentType,
                    vehicleType: request.vehicleType,
                    description: request.description,
                    contactPhone: request.contactPhone,
                    pickupLocation: {
                        lat: pickupLocation.lat,
                        lng: pickupLocation.lng,
                        address: pickupLocation.addressText || pickupLocation.address,
                    },
                    dropoffLocation: request.dropoffLocation,
                    media: request.media.map(m => ({
                        type: m.mediaType,
                        url: m.publicUrl,
                    })),
                    distance: routeInfo.distance, // Real road distance (km)
                    eta: routeInfo.duration, // ETA in minutes ⭐ KEY METRIC
                    etaSeconds: routeInfo.durationSeconds, // ETA in seconds for countdown
                    estimatedEarnings,
                    searchPhase: request.searchPhase,
                    expiresAt: request.expiresAt,
                    timeRemaining,
                    // Quote window info
                    quoteWindowOpen,
                    quoteWindowTimeRemaining,
                    quoteWindowExpiresAt: request.quoteWindowExpiresAt,
                    quoteCount: actualQuoteCount,
                    maxQuotes,
                    createdAt: request.createdAt,
                });
            } else if (!routeInfo.success) {
                console.warn(`VietMap route failed for request ${request.id}: ${routeInfo.error}`);
            }
        }

        // Step 3: Sort by ETA (MOST IMPORTANT) - providers closest in TIME, not distance
        matchedRequests.sort((a, b) => a.eta - b.eta);

        console.log(` [Provider ${userId}] Matched ${matchedRequests.length} requests with real ETA`);
        if (matchedRequests.length > 0) {
            console.log(`   → Best match: ${matchedRequests[0].distance}km, ETA: ${matchedRequests[0].eta} minutes`);
        }

        return { requests: matchedRequests, activeJobId: null };
    }

    private calculateEstimatedEarnings(distanceKm: number, baseFee: number, pricePerKm: number): number {
        return baseFee + Math.ceil(distanceKm) * pricePerKm;
    }

    async updateSettings(userId: string, settings: {
        serviceRadiusKm?: number;
        phoneNumber?: string;
        emergencyAvailable?: boolean;
        fullName?: string;
        serviceName?: string;
    }) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (user.role !== UserRole.PROVIDER) {
            throw new ForbiddenException('Only providers can update settings');
        }

        // Validate serviceRadiusKm range (5-50 km)
        if (settings.serviceRadiusKm !== undefined) {
            if (settings.serviceRadiusKm < 5 || settings.serviceRadiusKm > 50) {
                throw new BadRequestException('Service radius must be between 5 and 50 km');
            }
        }

        const updateData: any = {};
        if (settings.serviceRadiusKm !== undefined) updateData.serviceRadiusKm = settings.serviceRadiusKm;
        if (settings.phoneNumber !== undefined) updateData.phoneNumber = settings.phoneNumber;
        if (settings.emergencyAvailable !== undefined) updateData.emergencyAvailable = settings.emergencyAvailable;
        if (settings.fullName !== undefined) updateData.fullName = settings.fullName;
        if (settings.serviceName !== undefined) updateData.serviceName = settings.serviceName;

        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: updateData,
        });

        return {
            success: true,
            message: 'Settings updated successfully',
            data: {
                serviceRadiusKm: updatedUser.serviceRadiusKm,
                phoneNumber: updatedUser.phoneNumber,
                emergencyAvailable: updatedUser.emergencyAvailable,
                fullName: updatedUser.fullName,
                serviceName: updatedUser.serviceName,
            },
        };
    }

    async getSettings(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                role: true,
                serviceName: true,
                serviceRadiusKm: true,
                pricePerKm: true,
                baseFee: true,
                emergencyAvailable: true,
                phoneNumber: true,
                contactEmail: true,
                email: true,
                name: true,
                avatar: true,
                providerType: true,
                businessName: true,
                serviceTypes: true,
                supportedVehicleTypes: true,
                address: true,
                permanentAddress: true,
                businessAddress: true,
                rescueVehicles: true,
                verificationStatus: true,
                rejectReasonDetail: true,
                rejectReasonCode: true,
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (user.role !== UserRole.PROVIDER) {
            throw new ForbiddenException('Only providers can access settings');
        }

        return {
            success: true,
            data: user,
        };
    }

    async changePassword(userId: string, currentPassword: string, newPassword: string) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const bcrypt = require('bcryptjs') as typeof import('bcryptjs');

        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        if (user.authProvider !== 'EMAIL') {
            throw new BadRequestException('Tài khoản đăng nhập bằng Google không thể đổi mật khẩu tại đây');
        }

        if (!user.hashedPassword) {
            throw new BadRequestException('Tài khoản chưa có mật khẩu');
        }

        const isValid = await bcrypt.compare(currentPassword, user.hashedPassword);
        if (!isValid) throw new BadRequestException('Mật khẩu hiện tại không đúng');

        if (newPassword.length < 6) {
            throw new BadRequestException('Mật khẩu mới phải có ít nhất 6 ký tự');
        }

        const hashed = await bcrypt.hash(newPassword, 12);
        await this.prisma.user.update({ where: { id: userId }, data: { hashedPassword: hashed } });

        return { success: true, message: 'Đổi mật khẩu thành công' };
    }

    /** Returns platform config values relevant to providers (commission rate, etc.). */
    async getProviderConfig() {
        const commissionRate = await this.commissionService.getEffectiveCommissionRate();
        return { commissionRate };
    }

    /**
     * GET /me/provider/history-stats?days=7
     * Returns revenue/profit stats, success rate, and avg rating for the history dashboard.
     */
    async getHistoryStats(providerId: string, days = 7) {
        const now = new Date();
        const commissionRate = await this.commissionService.getEffectiveCommissionRate();

        // ── 7-day daily revenue totals (by completion day, not request creation) ──
        const weeklyRevenue: { date: string; revenue: number; profit: number }[] = [];
        for (let i = days - 1; i >= 0; i--) {
            const dayStart = new Date(now);
            dayStart.setHours(0, 0, 0, 0);
            dayStart.setDate(dayStart.getDate() - i);
            const dayEnd = new Date(dayStart);
            dayEnd.setDate(dayEnd.getDate() + 1);

            const requests = await this.prisma.rescueRequest.findMany({
                where: whereCompletedJobsInLocalDay(providerId, dayStart, dayEnd),
                include: {
                    payment: { select: { totalAmount: true } },
                    quotes: {
                        where: { status: 'ACCEPTED' },
                        select: { price: true }
                    }
                },
            });

            const revenue = requests.reduce((sum, req) => sum + grossRevenueFromCompletedRequest(req), 0);
            // Use local date string (not UTC) to avoid timezone offset bug (e.g. UTC+7)
            const localDateStr = `${dayStart.getFullYear()}-${String(dayStart.getMonth() + 1).padStart(2, '0')}-${String(dayStart.getDate()).padStart(2, '0')}`;
            weeklyRevenue.push({
                date: localDateStr,
                revenue,
                profit: Math.round(revenue * (1 - commissionRate)),
            });
        }

        // ── Today profit ──────────────────────────────────────────────
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);

        const todayRequests = await this.prisma.rescueRequest.findMany({
            where: whereCompletedJobsInLocalDay(providerId, todayStart, tomorrowStart),
            include: {
                payment: { select: { totalAmount: true } },
                quotes: { where: { status: 'ACCEPTED' }, select: { price: true } }
            },
        });
        const yesterdayRequests = await this.prisma.rescueRequest.findMany({
            where: whereCompletedJobsInLocalDay(providerId, yesterdayStart, todayStart),
            include: {
                payment: { select: { totalAmount: true } },
                quotes: { where: { status: 'ACCEPTED' }, select: { price: true } }
            },
        });

        const todayRevenue = todayRequests.reduce((s, req) => s + grossRevenueFromCompletedRequest(req), 0);
        const yesterdayRevenue = yesterdayRequests.reduce((s, req) => s + grossRevenueFromCompletedRequest(req), 0);
        const todayProfit = Math.round(todayRevenue * (1 - commissionRate));
        const yesterdayProfit = Math.round(yesterdayRevenue * (1 - commissionRate));
        const profitChangePercent = yesterdayProfit === 0
            ? (todayProfit > 0 ? 100 : 0)
            : Math.round(((todayProfit - yesterdayProfit) / yesterdayProfit) * 100);

        // ── Success rate ──────────────────────────────────────────────
        const totalAccepted = await this.prisma.rescueRequest.count({
            where: {
                assignedProviderId: providerId,
                status: { notIn: ['MATCHING', 'CREATED'] },
            },
        });
        const totalCompleted = await this.prisma.rescueRequest.count({
            where: {
                assignedProviderId: providerId,
                status: { in: ['COMPLETED', 'PAID'] },
            },
        });
        const successRate = totalAccepted === 0 ? 0 : Math.round((totalCompleted / totalAccepted) * 1000) / 10;

        // ── Average rating ────────────────────────────────────────────
        const reviews = await this.prisma.review.findMany({
            where: { providerId },
            select: { rating: true },
        });
        const avgRating = reviews.length === 0
            ? null
            : Math.round((reviews.reduce((s: number, r: { rating: number }) => s + r.rating, 0) / reviews.length) * 10) / 10;

        return {
            weeklyRevenue,
            todayProfit,
            yesterdayProfit,
            profitChangePercent,
            successRate,
            totalCompleted,
            totalAccepted,
            avgRating,
            reviewCount: reviews.length,
            commissionRate,
        };
    }
}
