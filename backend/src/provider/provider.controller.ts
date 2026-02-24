import { Controller, Put, Get, Post, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ProviderService } from './provider.service';
import { UpdateProviderProfileDto } from '../auth/dto/auth.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubmitVerificationResponseDto } from './dto/submit-verification.dto';

@Controller('me/provider')
@UseGuards(JwtAuthGuard)
export class ProviderController {
    constructor(private providerService: ProviderService) { }

    @Put('profile')
    async updateProfile(@Request() req, @Body() dto: UpdateProviderProfileDto) {
        return this.providerService.updateProfile(req.user.id, dto, req.user.role);
    }

    @Get('profile')
    async getProfile(@Request() req) {
        return this.providerService.getProfile(req.user.id);
    }

    @Post('submit-verification')
    async submitVerification(@Request() req): Promise<SubmitVerificationResponseDto> {
        return this.providerService.submitVerification(req.user.id);
    }

    // Provider Active Mode APIs
    @Patch('status')
    async updateOnlineStatus(@Request() req, @Body() body: { isOnline: boolean }) {
        return this.providerService.updateOnlineStatus(req.user.id, body.isOnline);
    }

    @Patch('location')
    async updateCurrentLocation(@Request() req, @Body() body: { lat: number; lng: number }) {
        return this.providerService.updateCurrentLocation(req.user.id, body.lat, body.lng);
    }

    @Get('pending-requests')
    async getPendingRequests(@Request() req) {
        return this.providerService.getPendingRequests(req.user.id);
    }

    // DEPRECATED: Direct accept bypasses the quote system
    // Providers should navigate to request details and submit a quote instead
    // The quote system ensures proper price negotiation: Provider sends quote → User accepts → ASSIGNED
    /*
    @Post('requests/:id/accept')
    async acceptRequest(@Request() req, @Param('id') requestId: string) {
        return this.providerService.acceptRequest(req.user.id, requestId);
    }
    */

    // DEPRECATED: Decline is no longer needed since providers can simply skip viewing requests
    // The modal now shows "Skip" instead of "Decline" - no API call needed
    /*
    @Post('requests/:id/decline')
    async declineRequest(@Request() req, @Param('id') requestId: string) {
        return this.providerService.declineRequest(req.user.id, requestId);
    }
    */

    // Provider Settings API
    @Patch('settings')
    async updateSettings(@Request() req, @Body() body: {
        serviceRadiusKm?: number;
        phoneNumber?: string;
        emergencyAvailable?: boolean;
    }) {
        return this.providerService.updateSettings(req.user.id, body);
    }

    @Get('settings')
    async getSettings(@Request() req) {
        return this.providerService.getSettings(req.user.id);
    }
}
