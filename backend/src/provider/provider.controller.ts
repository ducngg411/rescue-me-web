import { Controller, Put, Get, Post, Patch, Param, Body, UseGuards, Request, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
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

    @Patch('fcm-token')
    async updateFcmToken(@Request() req, @Body() body: { fcmToken: string }) {
        return this.providerService.updateFcmToken(req.user.id, body.fcmToken);
    }

    @Get('pending-requests')
    async getPendingRequests(@Request() req) {
        return this.providerService.getPendingRequests(req.user.id);
    }

    // Provider Settings API
    @Patch('settings')
    async updateSettings(@Request() req, @Body() body: {
        serviceRadiusKm?: number;
        phoneNumber?: string;
        emergencyAvailable?: boolean;
        fullName?: string;
        serviceName?: string;
    }) {
        return this.providerService.updateSettings(req.user.id, body);
    }

    @Get('settings')
    async getSettings(@Request() req) {
        return this.providerService.getSettings(req.user.id);
    }

    // Change password
    @Patch('change-password')
    async changePassword(@Request() req, @Body() body: {
        currentPassword: string;
        newPassword: string;
    }) {
        return this.providerService.changePassword(req.user.id, body.currentPassword, body.newPassword);
    }

    /**
     * GET /me/provider/history-stats?days=7
     * Returns dashboard stats: 7-day revenue, today profit, success rate, avg rating.
     */
    @Get('history-stats')
    async getHistoryStats(
        @Request() req,
        @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
    ) {
        return this.providerService.getHistoryStats(req.user.id, days);
    }
}
