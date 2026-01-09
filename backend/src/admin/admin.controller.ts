import {
    Controller,
    Get,
    Post,
    Param,
    Body,
    Query,
    UseGuards,
    Request,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RejectProviderDto, SuspendProviderDto, GetProvidersQueryDto } from './dto/admin.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
    constructor(private adminService: AdminService) { }

    @Get('providers')
    async getProviders(@Query() query: GetProvidersQueryDto) {
        return this.adminService.getProviders(query);
    }

    @Get('providers/:id')
    async getProviderDetail(@Param('id') id: string) {
        return this.adminService.getProviderDetail(id);
    }

    @Post('providers/:id/approve')
    async approveProvider(@Param('id') id: string, @Request() req) {
        return this.adminService.approveProvider(id, req.user.userId);
    }

    @Post('providers/:id/reject')
    async rejectProvider(
        @Param('id') id: string,
        @Body() dto: RejectProviderDto,
        @Request() req,
    ) {
        return this.adminService.rejectProvider(
            id,
            req.user.userId,
            dto.rejectReasonCode,
            dto.rejectReasonDetail,
        );
    }

    @Post('providers/:id/suspend')
    async suspendProvider(
        @Param('id') id: string,
        @Body() dto: SuspendProviderDto,
        @Request() req,
    ) {
        return this.adminService.suspendProvider(id, req.user.userId, dto.reason);
    }

    @Post('providers/:id/unsuspend')
    async unsuspendProvider(@Param('id') id: string, @Request() req) {
        return this.adminService.unsuspendProvider(id, req.user.userId);
    }

    @Get('providers/:id/history')
    async getProviderHistory(@Param('id') id: string) {
        return this.adminService.getProviderHistory(id);
    }
}
