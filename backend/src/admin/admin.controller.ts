import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
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
    GetTransactionsQueryDto,
    GetUsersQueryDto,
    UpdateFeeDto,
    UpdateSepayConfigDto,
    GetAuditLogQueryDto,
    SaveSettingsDto,
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

    // ── Rescue Requests ────────────────────────────────────────────────────────
    @Get('requests')
    async getRescueRequests(@Query() query: any) {
        return this.adminService.getRescueRequests(query);
    }

    @Get('requests/stats')
    async getRescueRequestStats() {
        return this.adminService.getRescueRequestStats();
    }

    @Get('requests/:id')
    async getRescueRequestDetail(@Param('id') id: string) {
        return this.adminService.getRescueRequestDetail(id);
    }

    @Get('providers/stats')
    async getProviderStats() {
        return this.adminService.getProviderStats();
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

    // ── Wallets ─────────────────────────────────────────────────────────────

    @Get('wallets/provider')
    async getProviderWallets(@Query() query: GetTransactionsQueryDto) {
        return this.adminService.getProviderWallets(query);
    }

    @Get('wallets/provider/:id')
    async getProviderWallet(@Param('id') id: string) {
        return this.adminService.getProviderWalletByProviderId(id);
    }

    @Get('wallets/user')
    async getUserWallets(@Query() query: GetTransactionsQueryDto) {
        return this.adminService.getUserWallets(query);
    }

    @Get('wallets/user/:id')
    async getUserWallet(@Param('id') id: string) {
        return this.adminService.getUserWalletByUserId(id);
    }

    // ── Transactions ────────────────────────────────────────────────────────

    @Get('transactions/summary')
    async getTransactionSummary() {
        return this.adminService.getTransactionSummary();
    }

    @Get('transactions/wallet')
    async getWalletTransactions(@Query() query: GetTransactionsQueryDto) {
        return this.adminService.getWalletTransactions(query.userType || 'PROVIDER', query);
    }

    @Get('transactions/topup')
    async getTopupTransactions(@Query() query: GetTransactionsQueryDto) {
        return this.adminService.getTopupTransactions(query.userType || 'PROVIDER', query);
    }

    @Get('transactions/job-payment')
    async getJobPaymentTransactions(@Query() query: GetTransactionsQueryDto) {
        return this.adminService.getJobPaymentTransactions(query);
    }

    @Get('payments')
    async getPayments(@Query() query: GetTransactionsQueryDto) {
        return this.adminService.getPayments(query);
    }

    // ── Users ───────────────────────────────────────────────────────────────

    @Get('users/stats')
    async getUserStats() {
        return this.adminService.getUserStats();
    }

    @Get('users/:id')
    async getUserDetail(@Param('id') id: string) {
        return this.adminService.getUserDetail(id);
    }

    @Post('users/:id/suspend')
    async suspendUser(@Param('id') id: string, @Body() body: { banReason?: string }) {
        return this.adminService.suspendUser(id, body.banReason || 'Vi phạm điều khoản sử dụng');
    }

    @Post('users/:id/activate')
    async activateUser(@Param('id') id: string) {
        return this.adminService.activateUser(id);
    }

    @Delete('users/:id')
    async deleteUser(@Param('id') id: string) {
        return this.adminService.deleteUser(id);
    }

    @Get('users')
    async getUsers(@Query() query: GetUsersQueryDto) {
        return this.adminService.getUsers(query);
    }

    // ── Withdrawals ─────────────────────────────────────────────────────────

    @Get('withdrawals')
    async getWithdrawals(@Query() query: any) {
        return this.adminService.getWithdrawals({
            status: query.status,
            userType: query.userType,
            skip: query.skip ? parseInt(query.skip, 10) : 0,
            take: query.take ? parseInt(query.take, 10) : 20,
        });
    }

    @Get('withdrawals/stats')
    async getWithdrawalStats() {
        return this.adminService.getWithdrawalStats();
    }

    @Post('withdrawals/:id/approve')
    async approveWithdrawal(@Param('id') id: string, @Body() body: { userType: string }) {
        return this.adminService.approveWithdrawal(id, body.userType);
    }

    @Post('withdrawals/:id/reject')
    async rejectWithdrawal(@Param('id') id: string, @Body() body: { userType: string; reason?: string }) {
        return this.adminService.rejectWithdrawal(id, body.userType, body.reason);
    }

    // ── Billing & Fee ──────────────────────────────────────────────────────────

    @Get('billing')
    async getBillingConfig() {
        return this.adminService.getBillingConfig();
    }

    // ── Settings ───────────────────────────────────────────────────────────────

    @Get('settings')
    async getSettings() {
        return this.adminService.getSettings();
    }

    @Patch('settings')
    async updateSettings(@Body() dto: SaveSettingsDto, @Request() req: any) {
        return this.adminService.updateSettings(req.user.id, 'Admin', dto);
    }

    @Patch('billing/fee')
    async updateFeeRate(@Body() dto: UpdateFeeDto, @Request() req) {
        const adminName = req.user?.fullName || req.user?.email || req.user?.name || 'Admin';
        return this.adminService.updateFeeRate(req.user.id, adminName, dto.commissionRate, dto.note);
    }

    @Patch('billing/account')
    async updateSepayConfig(@Body() dto: UpdateSepayConfigDto, @Request() req) {
        const adminName = req.user?.fullName || req.user?.email || req.user?.name || 'Admin';
        return this.adminService.updateSepayConfig(req.user.id, adminName, dto);
    }

    @Get('billing/audit-log')
    async getBillingAuditLog(@Query() query: GetAuditLogQueryDto) {
        return this.adminService.getBillingAuditLog(query.skip ?? 0, query.take ?? 20);
    }

    // ── Chart Data ─────────────────────────────────────────────────────────────

    @Get('charts/top-users-by-requests')
    async getTopUsersByRequests() {
        return this.adminService.getTopUsersByRequests();
    }

    @Get('charts/top-providers-by-commission')
    async getTopProvidersByCommission() {
        return this.adminService.getTopProvidersByCommission();
    }

    @Get('charts/provider-service-distribution')
    async getProviderServiceDistribution() {
        return this.adminService.getProviderServiceDistribution();
    }

    @Get('charts/provider-vehicle-distribution')
    async getProviderVehicleDistribution() {
        return this.adminService.getProviderVehicleDistribution();
    }

    @Get('charts/dispute-resolution-distribution')
    async getDisputeResolutionDistribution() {
        return this.adminService.getDisputeResolutionDistribution();
    }

    @Get('charts/request-status-trend')
    async getRequestStatusTrend() {
        return this.adminService.getRequestStatusTrend();
    }

    @Get('charts/top-users-by-spending')
    async getTopUsersBySpending() {
        return this.adminService.getTopUsersBySpending();
    }

    @Get('charts/withdrawal-trend')
    async getWithdrawalTrend() {
        return this.adminService.getWithdrawalTrend();
    }
}

