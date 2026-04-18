import {
    Controller,
    Post,
    Put,
    Body,
    UseGuards,
    Request,
    Get,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
    RegisterEmailDto,
    LoginEmailDto,
    GoogleAuthDto,
    CompleteProfileDto,
    SelectRoleDto,
    ChangePasswordDto,
    ForgotPasswordEmailDto,
    ForgotPasswordPhoneDto,
    ResetPasswordDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    // ==================== REGISTRATION ====================
    @ApiOperation({ summary: 'Register with email and password' })
    @ApiResponse({ status: 201, description: 'User created, tokens returned' })
    @Post('register/email')
    @HttpCode(HttpStatus.CREATED)
    async registerEmail(@Body() dto: RegisterEmailDto) {
        return this.authService.registerWithEmail(dto);
    }

    // ==================== LOGIN ====================
    @ApiOperation({ summary: 'Login with email and password' })
    @Post('login/email')
    @HttpCode(HttpStatus.OK)
    async loginEmail(@Body() dto: LoginEmailDto) {
        return this.authService.loginWithEmail(dto);
    }

    @ApiOperation({ summary: 'Login or register with Google ID token' })
    @Post('login/google')
    @HttpCode(HttpStatus.OK)
    async loginGoogle(@Body() dto: GoogleAuthDto) {
        return this.authService.loginWithGoogle(dto.idToken);
    }

    // ==================== PROFILE ====================
    @ApiOperation({ summary: 'Select user role (USER or PROVIDER)' })
    @ApiBearerAuth('JWT')
    @Post('profile/select-role')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async selectRole(@Request() req, @Body() dto: SelectRoleDto) {
        return this.authService.selectRole(req.user.id, dto);
    }

    @ApiOperation({ summary: 'Complete user profile after registration' })
    @ApiBearerAuth('JWT')
    @Post('profile/complete')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async completeProfile(@Request() req, @Body() dto: CompleteProfileDto) {
        return this.authService.completeProfile(req.user.id, dto);
    }

    @ApiOperation({ summary: 'Get current authenticated user' })
    @ApiBearerAuth('JWT')
    @Get('me')
    @UseGuards(JwtAuthGuard)
    async getCurrentUser(@Request() req) {
        return req.user;
    }

    // ==================== CHANGE PASSWORD ====================
    @ApiOperation({ summary: 'Change password (email accounts only)' })
    @ApiBearerAuth('JWT')
    @Put('change-password')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async changePassword(@Request() req, @Body() dto: ChangePasswordDto) {
        return this.authService.changePassword(req.user.id, dto);
    }

    // ==================== FORGOT PASSWORD ====================
    @ApiOperation({ summary: 'Request password reset via email' })
    @Post('forgot-password/email')
    @HttpCode(HttpStatus.OK)
    async forgotPasswordEmail(@Body() dto: ForgotPasswordEmailDto) {
        return this.authService.forgotPasswordByEmail(dto);
    }

    @ApiOperation({ summary: 'Request password reset via Firebase phone OTP' })
    @Post('forgot-password/phone')
    @HttpCode(HttpStatus.OK)
    async forgotPasswordPhone(@Body() dto: ForgotPasswordPhoneDto) {
        return this.authService.forgotPasswordByPhone(dto);
    }

    @ApiOperation({ summary: 'Reset password using token from email/phone' })
    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    async resetPassword(@Body() dto: ResetPasswordDto) {
        return this.authService.resetPassword(dto);
    }

    // ==================== LOGOUT ====================
    @ApiOperation({ summary: 'Logout and invalidate session token' })
    @ApiBearerAuth('JWT')
    @Post('logout')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async logout(@Request() req) {
        const token = req.headers.authorization?.replace('Bearer ', '');
        return this.authService.logout(req.user.id, token);
    }
}
