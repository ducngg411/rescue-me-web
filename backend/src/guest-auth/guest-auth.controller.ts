import {
    Controller,
    Post,
    Delete,
    Body,
    UseGuards,
    Request,
    HttpCode,
    HttpStatus,
    Ip,
} from '@nestjs/common';
import { GuestAuthService } from './guest-auth.service';
import { GuestJwtGuard } from './guards/guest-jwt.guard';
import { VerifyPhoneDto, ConvertGuestDto } from './dto/guest-auth.dto';

@Controller('guest/auth')
export class GuestAuthController {
    constructor(private guestAuthService: GuestAuthService) {}

    @Post('verify-phone')
    @HttpCode(HttpStatus.OK)
    async verifyPhone(@Body() dto: VerifyPhoneDto, @Ip() ip: string) {
        return this.guestAuthService.verifyPhone(dto, ip);
    }

    @Post('refresh')
    @UseGuards(GuestJwtGuard)
    @HttpCode(HttpStatus.OK)
    async refresh(@Request() req) {
        return this.guestAuthService.refreshToken(req.user.guestSessionId);
    }

    @Delete('logout')
    @UseGuards(GuestJwtGuard)
    @HttpCode(HttpStatus.OK)
    async logout(@Request() req) {
        return this.guestAuthService.logout(req.user.guestSessionId);
    }

    @Post('convert')
    @UseGuards(GuestJwtGuard)
    @HttpCode(HttpStatus.OK)
    async convert(@Request() req, @Body() dto: ConvertGuestDto) {
        return this.guestAuthService.convertToUser(req.user.guestSessionId, dto.userAccessToken);
    }
}
