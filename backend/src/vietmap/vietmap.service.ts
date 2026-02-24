import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
            this.logger.warn('⚠️ VIETMAP_API_KEY not configured. Route calculation will fail.');
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

            this.logger.debug(`🗺️ Calling VietMap Route API: ${fromLat},${fromLng} → ${toLat},${toLng}`);

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
                `✅ Route: ${distanceKm.toFixed(3)}km (${route.distance}m), ETA: ${durationMinutes.toFixed(1)} minutes`,
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
}
