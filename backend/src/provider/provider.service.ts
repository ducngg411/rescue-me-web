import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VietMapService } from '../vietmap/vietmap.service';
import { UpdateProviderProfileDto } from '../auth/dto/auth.dto';
import { UserRole, VerificationStatus, ProviderType, DocumentType } from '@prisma/client';
import { SubmitVerificationResponseDto } from './dto/submit-verification.dto';

@Injectable()
export class ProviderService {
    private readonly logger = new Logger(ProviderService.name);

    constructor(
        private prisma: PrismaService,
        private vietMapService: VietMapService,
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
            throw new ForbiddenException('Provider must be online to update location');
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

        console.log(`📍 [Provider ${userId}] Location updated: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);

        return {
            success: true,
            message: 'Location updated',
        };
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
            return []; // Provider offline, không trả request
        }

        if (user.verificationStatus !== VerificationStatus.APPROVED) {
            return []; // Chưa verified, không trả request
        }

        // Get provider current location (GPS) - fallback to default address
        let providerLocation = user.currentLocation as any;

        // If no current location, try default addresses (for backward compatibility)
        if (!providerLocation || !providerLocation.lat || !providerLocation.lng) {
            providerLocation = (user.permanentAddress || user.businessAddress) as any;
        }

        if (!providerLocation || !providerLocation.lat || !providerLocation.lng) {
            console.warn(`[Provider ${userId}] No location set (neither current nor default), cannot match requests`);
            return [];
        }

        const providerLat = providerLocation.lat;
        const providerLng = providerLocation.lng;
        const radiusKm = user.serviceRadiusKm || 15;

        // Find MATCHING requests in radius
        const allMatchingRequests = await this.prisma.rescueRequest.findMany({
            where: {
                status: 'MATCHING',
                assignedProviderId: null,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        phoneNumber: true,
                        fullName: true,
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

        console.log(`📊 [Provider ${userId}] Found ${candidateRequests.length}/${allMatchingRequests.length} candidates within ${radiusKm * 1.5}km straight-line`);

        if (candidateRequests.length === 0) {
            return [];
        }

        // Step 2: Calculate REAL routes using VietMap API (with ETA!)
        const matchedRequests: any[] = [];
        for (const request of candidateRequests) {
            const pickupLocation = request.pickupLocation as any;

            // Call VietMap Route API to get REAL distance and ETA
            const routeInfo = await this.vietMapService.calculateRoute(
                providerLat,
                providerLng,
                pickupLocation.lat,
                pickupLocation.lng,
                'car', // Default to car, could be dynamic based on provider vehicle
            );

            // Check if route is successful and within service radius
            if (routeInfo.success && routeInfo.distance <= radiusKm) {
                const now = new Date();
                const timeRemaining = request.expiresAt
                    ? Math.max(0, Math.floor((request.expiresAt.getTime() - now.getTime()) / 1000))
                    : 0;

                const estimatedEarnings = this.calculateEstimatedEarnings(
                    routeInfo.distance,
                    user.baseFee || 50000,
                    user.pricePerKm || 10000,
                );

                matchedRequests.push({
                    id: request.id,
                    user: {
                        name: request.user.fullName || request.user.name,
                        phone: request.user.phoneNumber,
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
                    createdAt: request.createdAt,
                });
            } else if (!routeInfo.success) {
                console.warn(`⚠️ VietMap route failed for request ${request.id}: ${routeInfo.error}`);
                // Could fallback to Haversine here if needed
            }
        }

        // Step 3: Sort by ETA (MOST IMPORTANT) - providers closest in TIME, not distance
        matchedRequests.sort((a, b) => a.eta - b.eta);

        console.log(`✅ [Provider ${userId}] Matched ${matchedRequests.length} requests with real ETA`);
        if (matchedRequests.length > 0) {
            console.log(`   → Best match: ${matchedRequests[0].distance}km, ETA: ${matchedRequests[0].eta} minutes`);
        }

        return matchedRequests;
    }

    private calculateEstimatedEarnings(distanceKm: number, baseFee: number, pricePerKm: number): number {
        return baseFee + Math.ceil(distanceKm) * pricePerKm;
    }

    async acceptRequest(providerId: string, requestId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: providerId },
        });

        if (!user) {
            throw new NotFoundException('Provider not found');
        }

        if (user.role !== UserRole.PROVIDER) {
            throw new ForbiddenException('Only providers can accept requests');
        }

        if (!user.isOnline) {
            throw new ForbiddenException('Provider must be online to accept requests');
        }

        if (user.verificationStatus !== VerificationStatus.APPROVED) {
            throw new ForbiddenException('Provider must be verified to accept requests');
        }

        const request = await this.prisma.rescueRequest.findUnique({
            where: { id: requestId },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        fullName: true,
                        phoneNumber: true,
                    },
                },
                media: true,
            },
        });

        if (!request) {
            throw new NotFoundException('Request not found');
        }

        if (request.status !== 'MATCHING') {
            throw new BadRequestException('Request is not in MATCHING state');
        }

        if (request.assignedProviderId) {
            throw new BadRequestException('Request already assigned to another provider');
        }

        // Calculate distance and ETA using VietMap API
        let matchedDistance: number | undefined;
        let matchedEta: number | undefined;

        try {
            // Get provider location (currentLocation or default address)
            let providerLat: number | undefined;
            let providerLng: number | undefined;

            if (user.currentLocation) {
                const location = user.currentLocation as any;
                providerLat = location.lat;
                providerLng = location.lng;
            } else if (user.permanentAddress) {
                const address = user.permanentAddress as any;
                providerLat = address?.lat;
                providerLng = address?.lng;
            } else if (user.businessAddress) {
                const address = user.businessAddress as any;
                providerLat = address?.lat;
                providerLng = address?.lng;
            }

            // Get customer pickup location
            const pickupLocation = request.pickupLocation as any;
            const customerLat = pickupLocation.lat;
            const customerLng = pickupLocation.lng;

            if (providerLat && providerLng && customerLat && customerLng) {
                const routeInfo = await this.vietMapService.calculateRoute(
                    providerLat,
                    providerLng,
                    customerLat,
                    customerLng,
                    'car',
                );

                if (routeInfo.success) {
                    matchedDistance = routeInfo.distance;
                    matchedEta = routeInfo.duration;
                    this.logger.log(
                        `📍 [Provider ${providerId}] Matched with distance: ${matchedDistance}km, ETA: ${matchedEta} minutes`,
                    );
                } else {
                    this.logger.warn(
                        `⚠️ VietMap route failed: ${routeInfo.error}`,
                    );
                }
            } else {
                this.logger.warn(
                    `⚠️ Cannot calculate route: Provider location (${providerLat}, ${providerLng}), Customer location (${customerLat}, ${customerLng})`,
                );
            }
        } catch (err) {
            this.logger.error(`Error calculating route: ${err.message}`);
        }

        this.logger.log(`💾 Saving matched data: distance=${matchedDistance}, eta=${matchedEta}`);

        // Update request: MATCHING → ASSIGNED
        const updatedRequest = await this.prisma.rescueRequest.update({
            where: { id: requestId },
            data: {
                status: 'ASSIGNED',
                assignedProviderId: providerId,
                assignedAt: new Date(),
                matchedDistance,
                matchedEta,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        fullName: true,
                        phoneNumber: true,
                    },
                },
                assignedProvider: {
                    select: {
                        id: true,
                        name: true,
                        fullName: true,
                        serviceName: true,
                        phoneNumber: true,
                        pricePerKm: true,
                        baseFee: true,
                    },
                },
                media: true,
            },
        });

        console.log(`✅ [Provider ${providerId}] Accepted request ${requestId}`);

        return {
            success: true,
            message: 'Request accepted successfully',
            request: updatedRequest,
        };
    }

    async declineRequest(providerId: string, requestId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: providerId },
        });

        if (!user) {
            throw new NotFoundException('Provider not found');
        }

        if (user.role !== UserRole.PROVIDER) {
            throw new ForbiddenException('Only providers can decline requests');
        }

        const request = await this.prisma.rescueRequest.findUnique({
            where: { id: requestId },
        });

        if (!request) {
            throw new NotFoundException('Request not found');
        }

        console.log(`❌ [Provider ${providerId}] Declined request ${requestId}`);

        // Just log decline, request remains MATCHING for other providers
        return {
            success: true,
            message: 'Request declined',
        };
    }

    async updateSettings(userId: string, settings: {
        serviceRadiusKm?: number;
        phoneNumber?: string;
        emergencyAvailable?: boolean;
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

        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: {
                serviceRadiusKm: settings.serviceRadiusKm,
                phoneNumber: settings.phoneNumber,
                emergencyAvailable: settings.emergencyAvailable,
            },
        });

        return {
            success: true,
            message: 'Settings updated successfully',
            data: {
                serviceRadiusKm: updatedUser.serviceRadiusKm,
                phoneNumber: updatedUser.phoneNumber,
                emergencyAvailable: updatedUser.emergencyAvailable,
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
}
