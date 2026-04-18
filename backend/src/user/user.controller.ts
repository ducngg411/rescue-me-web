import { Controller, Put, Patch, Get, Body, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserService } from './user.service';
import { UpdateUserProfileDto } from '../auth/dto/auth.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('User')
@ApiBearerAuth('JWT')
@Controller('me')
export class UserController {
    constructor(private userService: UserService) { }

    @ApiOperation({ summary: 'Update user profile' })
    @Put('profile')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async updateProfile(@Request() req, @Body() dto: UpdateUserProfileDto) {
        return this.userService.updateProfile(req.user.id, dto, req.user.role);
    }

    @ApiOperation({ summary: 'Update user avatar URL' })
    @Patch('avatar')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async updateAvatar(@Request() req, @Body('avatarUrl') avatarUrl: string) {
        return this.userService.updateAvatar(req.user.id, avatarUrl);
    }

    @ApiOperation({ summary: 'Get current user profile' })
    @Get('profile')
    @UseGuards(JwtAuthGuard)
    async getProfile(@Request() req) {
        return this.userService.getProfile(req.user.id);
    }
}
