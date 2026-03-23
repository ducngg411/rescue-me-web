import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
    DisputeCaseStatus,
    DisputeResolutionType,
    DisputeSenderRole,
    DisputeMessageType,
    DisputeVisibility,
    Prisma,
    VerificationStatus,
    WalletTransactionStatus,
    WalletTransactionType,
    UserWalletReferenceType,
    WalletReferenceType,
} from '@prisma/client';
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

    // ── Dispute Center ─────────────────────────────────────────────────────────

    async getDisputes(query?: { status?: DisputeCaseStatus; skip?: number; take?: number }) {
        const skip = query?.skip ?? 0;
        const take = Math.min(query?.take ?? 20, 100);
        const where = query?.status ? { status: query.status } : {};

        const now = new Date();
        const [items, total] = await this.prisma.$transaction([
            this.prisma.disputeCase.findMany({
                where,
                orderBy: [{ firstResponseDueAt: 'asc' }, { createdAt: 'desc' }],
                skip,
                take,
                include: {
                    payment: {
                        select: {
                            id: true,
                            requestId: true,
                            totalAmount: true,
                            status: true,
                            paymentMethod: true,
                            disputeReason: true,
                            disputedAt: true,
                        },
                    },
                    request: {
                        select: {
                            id: true,
                            status: true,
                            incidentType: true,
                            createdAt: true,
                        },
                    },
                    openedBy: { select: { id: true, fullName: true, email: true } },
                },
            }),
            this.prisma.disputeCase.count({ where }),
        ]);

        // Annotate overdue flag
        const annotated = items.map((item) => ({
            ...item,
            isOverdue:
                item.firstResponseDueAt != null &&
                !item.firstRespondedAt &&
                item.firstResponseDueAt < now,
        }));

        return { items: annotated, total, skip, take };
    }


    async getDisputeDetail(caseId: string) {
        const row = await this.prisma.disputeCase.findUnique({
            where: { id: caseId },
            include: {
                payment: true,
                request: {
                    include: {
                        user: { select: { id: true, fullName: true, email: true, phoneNumber: true } },
                        assignedProvider: {
                            select: { id: true, fullName: true, email: true, phoneNumber: true },
                        },
                    },
                },
                messages: { orderBy: { createdAt: 'asc' } },
                evidence: { orderBy: { createdAt: 'asc' } },
                openedBy: { select: { id: true, fullName: true, email: true } },
                resolvedBy: { select: { id: true, fullName: true, email: true } },
                assignedTo: { select: { id: true, fullName: true, email: true } },
            },
        });
        if (!row) throw new NotFoundException('Dispute case not found');
        return row;
    }

    async updateDisputeStatus(caseId: string, adminId: string, status: DisputeCaseStatus) {
        const c = await this.prisma.disputeCase.findUnique({ where: { id: caseId } });
        if (!c) throw new NotFoundException('Dispute case not found');
        if (c.status === 'RESOLVED' || c.status === 'REJECTED') {
            throw new BadRequestException('Cannot change status of a closed dispute');
        }
        // Admins can move to INVESTIGATING from any open state
        const allowedTargets: DisputeCaseStatus[] = [
            DisputeCaseStatus.WAITING_FOR_CUSTOMER,
            DisputeCaseStatus.WAITING_FOR_PROVIDER,
            DisputeCaseStatus.INVESTIGATING,
        ];
        if (!allowedTargets.includes(status)) {
            throw new BadRequestException(
                `Use /resolve or /reject to close a dispute. Allowed: ${allowedTargets.join(', ')}`,
            );
        }

        return this.prisma.$transaction(async (tx) => {
            const updatedData: Prisma.DisputeCaseUpdateInput = { status };
            if (!c.firstRespondedAt && status === DisputeCaseStatus.INVESTIGATING) {
                updatedData.firstRespondedAt = new Date();
            }

            const updated = await tx.disputeCase.update({
                where: { id: caseId },
                data: updatedData,
            });

            await tx.disputeMessage.create({
                data: {
                    caseId,
                    senderRole: DisputeSenderRole.ADMIN,
                    messageType: DisputeMessageType.SYSTEM,
                    body: `Status changed to ${status}`,
                    userId: adminId,
                    visibility: DisputeVisibility.PUBLIC,
                },
            });

            return updated;
        });
    }


    async requestDisputeEvidence(
        caseId: string,
        adminId: string,
        message: string,
        targetRole?: DisputeSenderRole,
    ) {
        const c = await this.prisma.disputeCase.findUnique({ where: { id: caseId } });
        if (!c) throw new NotFoundException('Dispute case not found');
        if (c.status === 'RESOLVED' || c.status === 'REJECTED') {
            throw new BadRequestException('Dispute is already closed');
        }

        const normalizedTarget =
            targetRole === DisputeSenderRole.PROVIDER || targetRole === DisputeSenderRole.CUSTOMER
                ? targetRole
                : DisputeSenderRole.PROVIDER;

        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.disputeCase.update({
                where: { id: caseId },
                data: {
                    status:
                        normalizedTarget === DisputeSenderRole.PROVIDER
                            ? DisputeCaseStatus.WAITING_FOR_PROVIDER
                            : DisputeCaseStatus.WAITING_FOR_CUSTOMER,
                    providerReplyAllowed: normalizedTarget === DisputeSenderRole.PROVIDER,
                    customerReplyAllowed: normalizedTarget === DisputeSenderRole.CUSTOMER,
                    lastCoordinatorNote: message,
                    firstRespondedAt: c.firstRespondedAt ?? new Date(),
                },
            });

            await tx.disputeMessage.create({
                data: {
                    caseId,
                    senderRole: DisputeSenderRole.ADMIN,
                    messageType: DisputeMessageType.SYSTEM,
                    body: `Admin yêu cầu ${normalizedTarget === DisputeSenderRole.PROVIDER ? 'cứu hộ viên' : 'khách hàng'} bổ sung bằng chứng: ${message}`,
                    userId: adminId,
                    visibility: DisputeVisibility.PUBLIC,
                },
            });

            return updated;
        });
    }

    async addDisputeEvidence(caseId: string, adminId: string, url: string, note?: string) {
        const c = await this.prisma.disputeCase.findUnique({ where: { id: caseId } });
        if (!c) throw new NotFoundException('Dispute case not found');
        if (c.status === 'RESOLVED' || c.status === 'REJECTED') {
            throw new BadRequestException('Dispute is already closed');
        }

        return this.prisma.disputeEvidence.create({
            data: {
                caseId,
                url,
                note,
                uploadedByUserId: adminId,
            },
        });
    }


    async resolveDispute(
        caseId: string,
        adminId: string,
        resolutionType: DisputeResolutionType,
        resolutionAmountCustomer?: number,
        resolutionAmountProvider?: number,
        resolutionNote?: string,
    ) {
        const c = await this.prisma.disputeCase.findUnique({
            where: { id: caseId },
            include: { payment: true },
        });
        if (!c) throw new NotFoundException('Dispute case not found');
        if (c.status === 'RESOLVED' || c.status === 'REJECTED') {
            throw new BadRequestException('Dispute is already closed');
        }

        if (resolutionType === 'PARTIAL_REFUND' || resolutionType === 'SPLIT') {
            if (resolutionAmountCustomer == null || resolutionAmountCustomer < 0) {
                throw new BadRequestException('resolutionAmountCustomer is required for PARTIAL_REFUND/SPLIT');
            }
            if (resolutionAmountCustomer > c.payment.totalAmount) {
                throw new BadRequestException('resolutionAmountCustomer cannot exceed payment total');
            }
        }

        if (resolutionType === 'FULL_REFUND') {
            resolutionAmountCustomer = c.payment.totalAmount;
            resolutionAmountProvider = 0;
        } else if (resolutionType === 'NO_REFUND') {
            resolutionAmountCustomer = 0;
            resolutionAmountProvider = c.payment.totalAmount;
        }

        await this.prisma.$transaction(async (tx) => {
            // Wallet adjustments for WALLET payments
            if (
                c.payment.paymentMethod === 'WALLET' &&
                c.payment.userId &&
                resolutionAmountCustomer != null &&
                resolutionAmountCustomer > 0
            ) {
                const userDebit = await tx.userWalletTransaction.findFirst({
                    where: {
                        referenceType: UserWalletReferenceType.JOB_PAYMENT,
                        referenceId: c.payment.requestId,
                        type: WalletTransactionType.DEBIT,
                    },
                });

                const providerCredit = await tx.walletTransaction.findFirst({
                    where: {
                        referenceType: WalletReferenceType.JOB_PAYMENT,
                        referenceId: c.payment.requestId,
                        type: WalletTransactionType.CREDIT,
                    },
                });

                const payToUser = resolutionAmountCustomer;

                if (userDebit && payToUser > 0) {
                    const ratio = payToUser / c.payment.totalAmount;
                    const debitProvider =
                        providerCredit && providerCredit.amount > 0
                            ? Math.min(
                                  providerCredit.amount,
                                  Math.round(providerCredit.amount * ratio),
                              )
                            : 0;

                    if (debitProvider > 0) {
                        const pw = await tx.providerWallet.findUnique({
                            where: { providerId: c.payment.providerId },
                        });
                        if (!pw || pw.availableBalance < debitProvider) {
                            throw new BadRequestException(
                                'Provider wallet has insufficient balance to process this refund.',
                            );
                        }
                        await tx.walletTransaction.create({
                            data: {
                                walletId: pw.id,
                                type: WalletTransactionType.DEBIT,
                                amount: debitProvider,
                                status: WalletTransactionStatus.COMPLETED,
                                referenceType: WalletReferenceType.ADJUSTMENT,
                                referenceId: caseId,
                                description: `Điều chỉnh hoàn tiền tranh chấp — job #${c.payment.requestId.slice(0, 8).toUpperCase()}`,
                            },
                        });
                        await tx.providerWallet.update({
                            where: { id: pw.id },
                            data: { availableBalance: { decrement: debitProvider } },
                        });
                    }

                    const uw = await tx.userWallet.findUnique({
                        where: { userId: c.payment.userId },
                    });
                    if (uw) {
                        await tx.userWalletTransaction.create({
                            data: {
                                walletId: uw.id,
                                type: WalletTransactionType.CREDIT,
                                amount: payToUser,
                                status: WalletTransactionStatus.COMPLETED,
                                referenceType: UserWalletReferenceType.REFUND,
                                referenceId: caseId,
                                description: `Hoàn tiền tranh chấp — yêu cầu #${c.payment.requestId.slice(0, 8).toUpperCase()}`,
                            },
                        });
                        await tx.userWallet.update({
                            where: { id: uw.id },
                            data: { availableBalance: { increment: payToUser } },
                        });
                    }
                }
            }

            await tx.disputeCase.update({
                where: { id: caseId },
                data: {
                    status: DisputeCaseStatus.RESOLVED,
                    resolutionType,
                    resolutionAmountCustomer: resolutionAmountCustomer ?? null,
                    resolutionAmountProvider: resolutionAmountProvider ?? null,
                    resolutionNote: resolutionNote ?? null,
                    resolvedAt: new Date(),
                    resolvedByUserId: adminId,
                    firstRespondedAt: c.firstRespondedAt ?? new Date(),
                },
            });

            await tx.payment.update({
                where: { id: c.paymentId },
                data: { status: 'COMPLETED' },
            });

            const summary =
                resolutionNote?.trim() ||
                `Resolution: ${resolutionType}` +
                    (resolutionAmountCustomer != null
                        ? ` — Customer: ${resolutionAmountCustomer.toLocaleString('vi-VN')}₫`
                        : '');

            await tx.disputeMessage.create({
                data: {
                    caseId,
                    senderRole: DisputeSenderRole.ADMIN,
                    messageType: DisputeMessageType.SYSTEM,
                    body: summary,
                    userId: adminId,
                    visibility: DisputeVisibility.PUBLIC,
                },
            });
        });

        return this.getDisputeDetail(caseId);
    }

    async rejectDispute(caseId: string, adminId: string, resolutionNote?: string) {
        const c = await this.prisma.disputeCase.findUnique({ where: { id: caseId } });
        if (!c) throw new NotFoundException('Dispute case not found');
        if (c.status === 'RESOLVED' || c.status === 'REJECTED') {
            throw new BadRequestException('Dispute is already closed');
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.disputeCase.update({
                where: { id: caseId },
                data: {
                    status: DisputeCaseStatus.REJECTED,
                    resolutionNote: resolutionNote ?? null,
                    resolvedAt: new Date(),
                    resolvedByUserId: adminId,
                },
            });

            await tx.payment.update({
                where: { id: c.paymentId },
                data: { status: 'COMPLETED' },
            });

            await tx.disputeMessage.create({
                data: {
                    caseId,
                    senderRole: DisputeSenderRole.ADMIN,
                    messageType: DisputeMessageType.SYSTEM,
                    body: resolutionNote?.trim() || 'Dispute rejected. Payment stands.',
                    userId: adminId,
                    visibility: DisputeVisibility.PUBLIC,
                },
            });
        });

        return this.getDisputeDetail(caseId);
    }
}

