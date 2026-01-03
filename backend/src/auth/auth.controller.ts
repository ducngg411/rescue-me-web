import {
    Controller,
    Post,
    Body,
    UseGuards,
    Request,
    Get,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
    RegisterEmailDto,
    LoginEmailDto,
    GoogleAuthDto,
    CompleteProfileDto,
    SelectRoleDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    // ==================== REGISTRATION ====================
    @Post('register/email')
    @HttpCode(HttpStatus.CREATED)
    async registerEmail(@Body() dto: RegisterEmailDto) {
        return this.authService.registerWithEmail(dto);
    }

    // ==================== LOGIN ====================
    @Post('login/email')
    @HttpCode(HttpStatus.OK)
    async loginEmail(@Body() dto: LoginEmailDto) {
        return this.authService.loginWithEmail(dto);
    }

    @Post('login/google')
    @HttpCode(HttpStatus.OK)
    async loginGoogle(@Body() dto: GoogleAuthDto) {
        return this.authService.loginWithGoogle(dto.idToken);
    }

    // ==================== PROFILE ====================
    @Post('profile/select-role')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async selectRole(@Request() req, @Body() dto: SelectRoleDto) {
        return this.authService.selectRole(req.user.id, dto);
    }

    @Post('profile/complete')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async completeProfile(@Request() req, @Body() dto: CompleteProfileDto) {
        return this.authService.completeProfile(req.user.id, dto);
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    async getCurrentUser(@Request() req) {
        return req.user;
    }

    // ==================== LOGOUT ====================
    @Post('logout')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async logout(@Request() req) {
        const token = req.headers.authorization?.replace('Bearer ', '');
        return this.authService.logout(req.user.id, token);
    }
}
