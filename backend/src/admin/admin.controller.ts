import {
    Controller,
    Get,
    Post,
    Patch,
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
import {
    RejectProviderDto,
    SuspendProviderDto,
    GetProvidersQueryDto,
    GetDisputesQueryDto,
    UpdateDisputeStatusDto,
    RequestEvidenceDto,
    ResolveDisputeDto,
    RejectDisputeDto,
    AddDisputeEvidenceDto,
} from './dto/admin.dto';


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
        return this.adminService.approveProvider(id, req.user.id);
    }

    @Post('providers/:id/reject')
    async rejectProvider(
        @Param('id') id: string,
        @Body() dto: RejectProviderDto,
        @Request() req,
    ) {
        return this.adminService.rejectProvider(
            id,
            req.user.id,
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
        return this.adminService.suspendProvider(id, req.user.id, dto.reason);
    }

    @Post('providers/:id/unsuspend')
    async unsuspendProvider(@Param('id') id: string, @Request() req) {
        return this.adminService.unsuspendProvider(id, req.user.id);
    }

    @Get('providers/:id/history')
    async getProviderHistory(@Param('id') id: string) {
        return this.adminService.getProviderHistory(id);
    }

    // ── Dispute Center ─────────────────────────────────────────────────────

    @Get('disputes')
    async getDisputes(@Query() query: GetDisputesQueryDto, @Request() req) {
        return this.adminService.getDisputes(query, req.user.id);
    }

    @Get('disputes/stats')
    async getDisputeStats() {
        return this.adminService.getDisputeStats();
    }

    @Get('disputes/:id')
    async getDisputeDetail(@Param('id') id: string, @Request() req) {
        return this.adminService.getDisputeDetail(id, req.user.id);
    }

    @Patch('disputes/:id/status')
    async updateDisputeStatus(
        @Param('id') id: string,
        @Body() dto: UpdateDisputeStatusDto,
        @Request() req: { user: { id: string } },
    ) {
        return this.adminService.updateDisputeStatus(id, req.user.id, dto.status);
    }

    @Post('disputes/:id/request-evidence')
    async requestDisputeEvidence(
        @Param('id') id: string,
        @Body() dto: RequestEvidenceDto,
        @Request() req,
    ) {
        return this.adminService.requestDisputeEvidence(id, req.user.id, dto.message, dto.targetRole);
    }

    @Post('disputes/:id/resolve')
    async resolveDispute(
        @Param('id') id: string,
        @Body() dto: ResolveDisputeDto,
        @Request() req,
    ) {
        return this.adminService.resolveDispute(
            id,
            req.user.id,
            dto.resolutionType,
            dto.resolutionAmountCustomer,
            dto.resolutionAmountProvider,
            dto.resolutionNote,
        );
    }

    @Post('disputes/:id/reject')
    async rejectDispute(
        @Param('id') id: string,
        @Body() dto: RejectDisputeDto,
        @Request() req,
    ) {
        return this.adminService.rejectDispute(id, req.user.id, dto.resolutionNote);
    }

    @Post('disputes/:id/evidence')
    async addDisputeEvidence(
        @Param('id') id: string,
        @Body() dto: AddDisputeEvidenceDto,
        @Request() req,
    ) {
        return this.adminService.addDisputeEvidence(id, req.user.id, dto.url, dto.note);
    }

    // ── Request Center ──────────────────────────────────────────────────────

    @Get('requests/:id')
    async getRequestDetail(@Param('id') id: string) {
        return this.adminService.getRequestDetail(id);
    }
}

