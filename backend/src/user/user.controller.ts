import { Controller, Put, Get, Body, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserProfileDto } from '../auth/dto/auth.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('me')
export class UserController {
    constructor(private userService: UserService) { }

    @Put('profile')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async updateProfile(@Request() req, @Body() dto: UpdateUserProfileDto) {
        return this.userService.updateProfile(req.user.id, dto, req.user.role);
    }

    @Get('profile')
    @UseGuards(JwtAuthGuard)
    async getProfile(@Request() req) {
        return this.userService.getProfile(req.user.id);
    }
}
