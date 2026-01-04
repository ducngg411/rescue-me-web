import { Controller, Put, Get, Body, UseGuards, Request } from '@nestjs/common';
import { ProviderService } from './provider.service';
import { UpdateProviderProfileDto } from '../auth/dto/auth.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
}
