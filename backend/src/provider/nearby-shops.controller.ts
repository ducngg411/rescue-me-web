import { Controller, Get, Query, ParseFloatPipe, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { NearbyShopsService } from './nearby-shops.service';

/**
 * Public endpoint – no JWT required so users in distress (even unauthenticated)
 * can look up nearby repair shops.
 */
@Controller('nearby-shops')
export class NearbyShopsController {
    constructor(private readonly nearbyShopsService: NearbyShopsService) {}

    /**
     * GET /api/nearby-shops?lat=...&lng=...&radius=2
     *
     * @param lat  User latitude
     * @param lng  User longitude
     * @param radius Search radius in km (default 2, max 20)
     */
    @Get()
    async findNearby(
        @Query('lat', ParseFloatPipe) lat: number,
        @Query('lng', ParseFloatPipe) lng: number,
        @Query('radius', new DefaultValuePipe(2), ParseIntPipe) radius: number,
    ) {
        // Cap radius at 20 km to avoid excessive API usage
        const safeRadius = Math.min(Math.max(1, radius), 20);
        const shops = await this.nearbyShopsService.findNearby(lat, lng, safeRadius);
        return { shops, total: shops.length, radius: safeRadius };
    }
}
