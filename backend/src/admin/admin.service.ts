import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VerificationStatus } from '@prisma/client';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AdminService {
    constructor(
        private prisma: PrismaService,
        private mailService: MailService,
    ) { }

    async getProviders(filters?: {
        status?: string;
        search?: string;
        page?: number;
        limit?: number;
    }) {
        const where: any = {};

        // Filter by status - Default to PENDING, exclude DRAFT
        if (filters?.status && filters.status !== 'ALL') {
            where.verificationStatus = filters.status as VerificationStatus;
        } else if (!filters?.status) {
            // By default, only show PENDING providers (exclude DRAFT)
            where.verificationStatus = 'PENDING';
        }

        // Search
        if (filters?.search) {
            where.OR = [
                { fullName: { contains: filters.search, mode: 'insensitive' } },
                { phoneNumber: { contains: filters.search } },
                { email: { contains: filters.search, mode: 'insensitive' } },
                { businessName: { contains: filters.search, mode: 'insensitive' } },
            ];
        }

        const providers = await this.prisma.user.findMany({
            where: {
                role: 'PROVIDER',
                ...where,
            },
            select: {
                id: true,
                fullName: true,
                phoneNumber: true,
                email: true,
                avatar: true,
                providerType: true,
                businessName: true,
                serviceTypes: true,
                supportedVehicleTypes: true,
                verificationStatus: true,
                submittedAt: true,
                isActive: true,
                rescueVehicles: true,
            },
            orderBy: [
                { submittedAt: 'desc' },
                { createdAt: 'desc' },
            ],
        });

        return providers;
    }

    async getProviderDetail(providerId: string) {
        const provider = await this.prisma.user.findUnique({
            where: { id: providerId },
            include: {
                uploads: {
                    select: {
                        id: true,
                        docType: true,
                        publicUrl: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        if (!provider) {
            throw new NotFoundException(`Provider with ID ${providerId} not found`);
        }

        if (provider.role !== 'PROVIDER') {
            throw new NotFoundException(`User ${providerId} is not a provider (role: ${provider.role})`);
        }

        return provider;
    }

    async approveProvider(providerId: string, adminId: string) {
        const provider = await this.prisma.user.findUnique({
            where: { id: providerId },
        });

        if (!provider || provider.role !== 'PROVIDER') {
            throw new NotFoundException('Provider not found');
        }

        if (provider.verificationStatus !== 'PENDING') {
            throw new ForbiddenException('Only PENDING providers can be approved');
        }

        // Update provider status
        const updated = await this.prisma.user.update({
            where: { id: providerId },
            data: {
                verificationStatus: 'APPROVED',
                approvedAt: new Date(),
            },
        });

        // Send approval notification (fire-and-forget)
        setImmediate(() => {
            this.mailService.sendProviderApproved(
                updated.email,
                updated.fullName || updated.email,
            );
        });

        return updated;
    }

    async rejectProvider(
        providerId: string,
        adminId: string,
        rejectReasonCode: string,
        rejectReasonDetail: string,
    ) {
        const provider = await this.prisma.user.findUnique({
            where: { id: providerId },
        });

        if (!provider || provider.role !== 'PROVIDER') {
            throw new NotFoundException('Provider not found');
        }

        if (provider.verificationStatus !== 'PENDING') {
            throw new ForbiddenException('Only PENDING providers can be rejected');
        }

        // Update provider status
        const updated = await this.prisma.user.update({
            where: { id: providerId },
            data: {
                verificationStatus: 'REJECTED',
                rejectedAt: new Date(),
                rejectReasonCode,
                rejectReasonDetail,
            },
        });

        // TODO: Create history entry

        // Send rejection notification (fire-and-forget)
        setImmediate(() => {
            this.mailService.sendProviderRejected(
                updated.email,
                updated.fullName || updated.email,
                rejectReasonCode,
                rejectReasonDetail,
            );
        });

        return updated;
    }

    async suspendProvider(providerId: string, adminId: string, reason?: string) {
        const provider = await this.prisma.user.findUnique({
            where: { id: providerId },
        });

        if (!provider || provider.role !== 'PROVIDER') {
            throw new NotFoundException('Provider not found');
        }

        if (provider.verificationStatus !== 'APPROVED') {
            throw new ForbiddenException('Only APPROVED providers can be suspended');
        }

        // Update provider status
        const updated = await this.prisma.user.update({
            where: { id: providerId },
            data: {
                verificationStatus: 'SUSPENDED',
                isActive: false, // Force offline
            },
        });

        // TODO: Create history entry with reason

        // Send suspension notification (fire-and-forget)
        setImmediate(() => {
            this.mailService.sendProviderSuspended(
                updated.email,
                updated.fullName || updated.email,
                reason,
            );
        });

        return updated;
    }

    async unsuspendProvider(providerId: string, adminId: string) {
        const provider = await this.prisma.user.findUnique({
            where: { id: providerId },
        });

        if (!provider || provider.role !== 'PROVIDER') {
            throw new NotFoundException('Provider not found');
        }

        if (provider.verificationStatus !== 'SUSPENDED') {
            throw new ForbiddenException('Only SUSPENDED providers can be unsuspended');
        }

        // Update provider status
        const updated = await this.prisma.user.update({
            where: { id: providerId },
            data: {
                verificationStatus: 'APPROVED',
            },
        });

        // TODO: Create history entry

        // Send unsuspension notification (fire-and-forget)
        setImmediate(() => {
            this.mailService.sendProviderUnsuspended(
                updated.email,
                updated.fullName || updated.email,
            );
        });

        return updated;
    }

    async getProviderHistory(providerId: string) {
        // TODO: Implement when VerificationHistory model is created
        // For now, return empty array
        return [];
    }
}
