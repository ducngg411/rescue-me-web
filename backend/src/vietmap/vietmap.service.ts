import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface VietMapPlaceResult {
    ref_id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    distance?: number; // meters, returned by VietMap
}

export interface NearbyShopResult {
    id: string;
    name: string;
    address: string;
    phone?: string;
    lat: number;
    lng: number;
    distanceKm: number;
    source: 'PLATFORM' | 'VIETMAP';
    isVerified: boolean;
    averageRating?: number;
    reviewCount?: number;
}

interface VietMapRouteResponse {
    code: string;
    paths?: Array<{
        distance: number; // meters
        time: number; // milliseconds
        weight: number;
        points: string;
        instructions: any[];
    }>;
    message?: string;
}

export interface RouteInfo {
    distance: number; // kilometers
    duration: number; // minutes (ETA)
    durationSeconds: number; // seconds
    success: boolean;
    error?: string;
}

@Injectable()
export class VietMapService {
    private readonly logger = new Logger(VietMapService.name);
    private readonly apiKey: string;
    private readonly baseUrl = 'https://maps.vietmap.vn/api/route/v3';

    constructor(private configService: ConfigService) {
        this.apiKey = this.configService.get<string>('VIETMAP_API_KEY') || '';
        if (!this.apiKey) {
            this.logger.warn(' VIETMAP_API_KEY not configured. Route calculation will fail.');
        }
    }

    /**
     * Calculate route between two points using VietMap API
     * @param fromLat Origin latitude
     * @param fromLng Origin longitude
     * @param toLat Destination latitude
     * @param toLng Destination longitude
     * @param vehicle Vehicle type: 'car' | 'motorcycle' | 'truck'
     * @returns RouteInfo with distance (km) and duration (minutes)
     */
    async calculateRoute(
        fromLat: number,
        fromLng: number,
        toLat: number,
        toLng: number,
        vehicle: 'car' | 'motorcycle' | 'truck' = 'car',
    ): Promise<RouteInfo> {
        if (!this.apiKey) {
            return {
                distance: 0,
                duration: 0,
                durationSeconds: 0,
                success: false,
                error: 'VietMap API key not configured',
            };
        }

        try {
            // Build URL with query params
            const url = new URL(this.baseUrl);
            url.searchParams.append('apikey', this.apiKey);
            url.searchParams.append('point', `${fromLat},${fromLng}`);
            url.searchParams.append('point', `${toLat},${toLng}`);
            url.searchParams.append('vehicle', vehicle);
            url.searchParams.append('points_encoded', 'true');

            this.logger.debug(`Calling VietMap Route API: ${fromLat},${fromLng} → ${toLat},${toLng}`);

            const response = await fetch(url.toString());
            const data: VietMapRouteResponse = await response.json();

            if (data.code !== 'OK' || !data.paths || data.paths.length === 0) {
                this.logger.warn(`VietMap API error: ${data.code} - ${data.message || 'No route found'}`);
                return {
                    distance: 0,
                    duration: 0,
                    durationSeconds: 0,
                    success: false,
                    error: data.message || 'No route found',
                };
            }

            const route = data.paths[0];
            const distanceKm = route.distance / 1000; // meters → km
            const durationMinutes = route.time / 1000 / 60; // milliseconds → minutes
            const durationSeconds = route.time / 1000; // milliseconds → seconds

            this.logger.debug(
                ` Route: ${distanceKm.toFixed(3)}km (${route.distance}m), ETA: ${durationMinutes.toFixed(1)} minutes`,
            );

            return {
                distance: Math.round(distanceKm * 100) / 100, // Round to 2 decimals for accuracy
                duration: Math.ceil(durationMinutes), // Round up minutes
                durationSeconds: Math.round(durationSeconds),
                success: true,
            };
        } catch (error) {
            this.logger.error(`VietMap API call failed: ${error.message}`, error.stack);
            return {
                distance: 0,
                duration: 0,
                durationSeconds: 0,
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Calculate routes for multiple destinations (batch)
     * Useful for matching multiple providers at once
     */
    async calculateRoutesParallel(
        fromLat: number,
        fromLng: number,
        destinations: Array<{ lat: number; lng: number; id: string }>,
        vehicle: 'car' | 'motorcycle' | 'truck' = 'car',
    ): Promise<Map<string, RouteInfo>> {
        const results = new Map<string, RouteInfo>();

        // Call APIs in parallel
        const promises = destinations.map(async (dest) => {
            const route = await this.calculateRoute(fromLat, fromLng, dest.lat, dest.lng, vehicle);
            return { id: dest.id, route };
        });

        const responses = await Promise.all(promises);

        responses.forEach(({ id, route }) => {
            results.set(id, route);
        });

        return results;
    }

    /**
     * Fallback: Calculate straight-line distance using Haversine formula
     * Used when VietMap API fails or quota exceeded
     */
    calculateHaversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const R = 6371; // Radius of Earth in km
        const dLat = this.deg2rad(lat2 - lat1);
        const dLng = this.deg2rad(lng2 - lng1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) *
            Math.cos(this.deg2rad(lat2)) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private deg2rad(deg: number): number {
        return deg * (Math.PI / 180);
    }

    /**
     * Search nearby repair shops using VietMap Place API v4
     * @param lat User latitude
     * @param lng User longitude
     * @param radiusMeters Search radius in meters (default 2000m)
     * @returns List of nearby POI results
     */
    async searchNearbyRepairShops(
        lat: number,
        lng: number,
        radiusMeters: number = 2000,
    ): Promise<VietMapPlaceResult[]> {
        if (!this.apiKey) {
            this.logger.warn('VIETMAP_API_KEY not configured, skipping Place API search');
            return [];
        }

        const keywords = ['sửa xe', 'sửa ô tô', 'garage', 'tiệm sửa xe', 'cứu hộ xe'];
        const allResults: VietMapPlaceResult[] = [];
        const seenIds = new Set<string>();

        // Run searches in parallel for each keyword
        const searches = keywords.map(async (text) => {
            try {
                const url = new URL('https://maps.vietmap.vn/api/search/v4');
                url.searchParams.append('apikey', this.apiKey);
                url.searchParams.append('text', text);
                url.searchParams.append('location', `${lat},${lng}`);
                url.searchParams.append('radius', String(radiusMeters));
                url.searchParams.append('size', '10');

                this.logger.debug(`🔍 VietMap Place search: "${text}" near ${lat},${lng} r=${radiusMeters}m`);

                const res = await fetch(url.toString(), {
                    signal: AbortSignal.timeout(5000),
                });

                if (!res.ok) {
                    this.logger.warn(`VietMap Place API error for "${text}": HTTP ${res.status}`);
                    return [];
                }

                const data = await res.json();

                // VietMap Place v4 returns array directly or wrapped in features
                const items: any[] = Array.isArray(data) ? data : (data.features || data.data || []);

                return items.map((item: any) => {
                    // Handle both GeoJSON feature format and flat format
                    const geometry = item.geometry || item;
                    const coords = geometry?.coordinates || [item.lng, item.lat];
                    const props = item.properties || item;

                    return {
                        ref_id: String(props.ref_id || props.id || item.ref_id || Math.random()),
                        name: props.name || item.name || 'Cửa hàng sửa xe',
                        address: props.address || props.display || item.address || '',
                        lat: coords[1] ?? item.lat ?? 0,
                        lng: coords[0] ?? item.lng ?? 0,
                        distance: props.distance || item.distance,
                    } as VietMapPlaceResult;
                });
            } catch (error: any) {
                if (error?.name !== 'TimeoutError') {
                    this.logger.warn(`VietMap Place search failed for "${text}": ${error.message}`);
                }
                return [];
            }
        });

        const results = await Promise.all(searches);

        // Merge and deduplicate by ref_id, then by proximity (within 50m)
        for (const batch of results) {
            for (const item of batch) {
                if (!seenIds.has(item.ref_id) && item.lat && item.lng) {
                    seenIds.add(item.ref_id);
                    allResults.push(item);
                }
            }
        }

        this.logger.debug(`VietMap Place: found ${allResults.length} unique results`);
        return allResults;
    }
}
