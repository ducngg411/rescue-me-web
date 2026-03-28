import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VietMapService, NearbyShopResult } from '../vietmap/vietmap.service';
import { VerificationStatus, ProviderType } from '@prisma/client';

@Injectable()
export class NearbyShopsService {
    private readonly logger = new Logger(NearbyShopsService.name);

    constructor(
        private prisma: PrismaService,
        private vietMapService: VietMapService,
    ) {}

    async findNearby(
        lat: number,
        lng: number,
        radiusKm: number = 2,
    ): Promise<NearbyShopResult[]> {
        const radiusMeters = radiusKm * 1000;

        // Run both sources in parallel
        const [platformShops, vietmapShops] = await Promise.all([
            this.getPlatformShops(lat, lng, radiusKm),
            this.getVietMapShops(lat, lng, radiusMeters),
        ]);

        // Merge, then sort by distance
        const merged = [...platformShops, ...vietmapShops];
        merged.sort((a, b) => a.distanceKm - b.distanceKm);

        this.logger.log(
            `Nearby shops: ${platformShops.length} platform + ${vietmapShops.length} VietMap = ${merged.length} total (radius ${radiusKm}km)`,
        );

        return merged;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Source 1: Platform BUSINESS providers registered in our DB
    // ──────────────────────────────────────────────────────────────────────────
    private async getPlatformShops(
        lat: number,
        lng: number,
        radiusKm: number,
    ): Promise<NearbyShopResult[]> {
        try {
            // Fetch all approved BUSINESS providers with a filled businessAddress
            // Prisma Json filter: NOT equals DbNull/JsonNull means field has a value
            const providers = await this.prisma.user.findMany({
                where: {
                    providerType: ProviderType.BUSINESS,
                    verificationStatus: VerificationStatus.APPROVED,
                },
                select: {
                    id: true,
                    businessName: true,
                    businessAddress: true,
                    phoneNumber: true,
                    averageRating: true,
                    reviewCount: true,
                },
            });

            const results: NearbyShopResult[] = [];

            for (const p of providers) {
                const addr = p.businessAddress as any;
                if (!addr?.lat || !addr?.lng) continue;

                const distanceKm = this.vietMapService.calculateHaversineDistance(
                    lat,
                    lng,
                    addr.lat,
                    addr.lng,
                );

                if (distanceKm > radiusKm) continue;

                results.push({
                    id: `platform_${p.id}`,
                    name: p.businessName || 'Cửa hàng sửa xe',
                    address: addr.addressText || addr.address || '',
                    phone: p.phoneNumber || undefined,
                    lat: addr.lat,
                    lng: addr.lng,
                    distanceKm: Math.round(distanceKm * 100) / 100,
                    source: 'PLATFORM',
                    isVerified: true,
                    averageRating: p.averageRating ?? undefined,
                    reviewCount: p.reviewCount ?? 0,
                });
            }

            return results;
        } catch (error: any) {
            this.logger.error(`Failed to fetch platform shops: ${error.message}`);
            return [];
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Source 2: VietMap Place API POI
    // ──────────────────────────────────────────────────────────────────────────
    private async getVietMapShops(
        lat: number,
        lng: number,
        radiusMeters: number,
    ): Promise<NearbyShopResult[]> {
        try {
            const poiList = await this.vietMapService.searchNearbyRepairShops(lat, lng, radiusMeters);

            return poiList
                .filter((poi) => poi.lat && poi.lng)
                .map((poi) => {
                    const distanceKm = poi.distance
                        ? poi.distance / 1000
                        : this.vietMapService.calculateHaversineDistance(lat, lng, poi.lat, poi.lng);

                    return {
                        id: `vietmap_${poi.ref_id}`,
                        name: poi.name,
                        address: poi.address,
                        phone: undefined,
                        lat: poi.lat,
                        lng: poi.lng,
                        distanceKm: Math.round(distanceKm * 100) / 100,
                        source: 'VIETMAP' as const,
                        isVerified: false,
                    };
                });
        } catch (error: any) {
            this.logger.error(`Failed to fetch VietMap POI: ${error.message}`);
            return [];
        }
    }
}
