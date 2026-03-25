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

    async getDisputes(query?: { status?: string; skip?: number; take?: number }, adminId?: string) {
        const skip = query?.skip ?? 0;
        const take = Math.min(query?.take ?? 20, 100);
        let where: any = {};
        if (query?.status) {
            const statuses = query.status.split(',').map(s => s.trim());
            where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
        }

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

        // Annotate overdue flag and unreadCount
        const annotated = await Promise.all(items.map(async (item) => {
            let unreadCount = 0;
            if (adminId) {
                const state = await this.prisma.disputeReadState.findUnique({
                    where: { caseId_userId: { caseId: item.id, userId: adminId } },
                    select: { lastReadAt: true },
                });
                unreadCount = await this.prisma.disputeMessage.count({
                    where: {
                        caseId: item.id,
                        senderRole: { not: 'ADMIN' },
                        ...(state?.lastReadAt ? { createdAt: { gt: state.lastReadAt } } : {}),
                    },
                });
            }
            return {
                ...item,
                unreadCount,
                isOverdue:
                    item.firstResponseDueAt != null &&
                    !item.firstRespondedAt &&
                    item.firstResponseDueAt < now,
            };
        }));

        return { items: annotated, total, skip, take };
    }

    async getDisputeStats() {
        const statuses = await this.prisma.disputeCase.groupBy({
            by: ['status'],
            _count: {
                _all: true,
            },
        });

        let newCount = 0;
        let inProgressCount = 0;
        let resolvedCount = 0;
        let totalCount = 0;

        for (const s of statuses) {
            const count = s._count._all;
            totalCount += count;
            
            if (s.status === 'WAITING_FOR_PROVIDER' || s.status === 'WAITING_FOR_CUSTOMER') {
                newCount += count;
                inProgressCount += count;
            } else if (s.status === 'INVESTIGATING') {
                inProgressCount += count;
            } else if (s.status === 'RESOLVED') {
                resolvedCount += count;
            }
        }

        return {
            new: newCount,
            inProgress: inProgressCount,
            resolved: resolvedCount,
            total: totalCount,
        };
    }

    private getCommissionRate(): number {
        const parsed = parseFloat(process.env.COMMISSION_RATE ?? '0.1');
        if (Number.isNaN(parsed) || parsed < 0 || parsed >= 1) return 0.1;
        return parsed;
    }

    private async getProviderNetPayout(requestId: string, paymentTotalAmount: number) {
        const netTx = await this.prisma.walletTransaction.findFirst({
            where: {
                referenceId: requestId,
                referenceType: { in: [WalletReferenceType.JOB_PAYMENT, WalletReferenceType.JOB] },
                type: WalletTransactionType.CREDIT,
            },
            orderBy: { createdAt: 'desc' },
        });

        if (netTx) {
            return { amount: netTx.amount, source: 'WALLET_TX' as const };
        }

        const commissionRate = this.getCommissionRate();
        const commissionAmount = Math.round(paymentTotalAmount * commissionRate);
        const fallback = Math.max(0, paymentTotalAmount - commissionAmount);
        return { amount: fallback, source: 'FALLBACK_BY_COMMISSION_RATE' as const };
    }

    private async consumeQrPendingHold(
        tx: Prisma.TransactionClient,
        walletId: string,
        requestId: string,
        amount: number,
    ) {
        if (amount <= 0) return 0;

        const pendingCredits = await tx.walletTransaction.findMany({
            where: {
                walletId,
                referenceId: requestId,
                referenceType: { in: [WalletReferenceType.JOB_PAYMENT, WalletReferenceType.JOB] },
                type: WalletTransactionType.CREDIT,
                status: WalletTransactionStatus.PENDING,
            },
            orderBy: { createdAt: 'asc' },
        });

        let remaining = amount;
        let consumed = 0;
        for (const pending of pendingCredits) {
            if (remaining <= 0) break;
            const take = Math.min(remaining, pending.amount);
            if (take <= 0) continue;

            if (take === pending.amount) {
                await tx.walletTransaction.update({
                    where: { id: pending.id },
                    data: {
                        status: WalletTransactionStatus.FAILED,
                        description: `${pending.description ?? ''} | Released by dispute refund ${requestId}`.trim(),
                    },
                });
            } else {
                await tx.walletTransaction.update({
                    where: { id: pending.id },
                    data: {
                        amount: { decrement: take },
                        description: `${pending.description ?? ''} | Reduced by dispute refund ${requestId} (${take.toLocaleString('vi-VN')} VND)`.trim(),
                    },
                });
            }

            remaining -= take;
            consumed += take;
        }

        if (consumed > 0) {
            await tx.providerWallet.update({
                where: { id: walletId },
                data: { pendingBalance: { decrement: consumed } },
            });
        }

        return consumed;
    }


    async getDisputeDetail(caseId: string, adminId?: string) {
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

        if (adminId) {
            await this.prisma.disputeReadState.upsert({
                where: { caseId_userId: { caseId, userId: adminId } },
                create: { caseId, userId: adminId, lastReadAt: new Date() },
                update: { lastReadAt: new Date() },
            });
        }

        const net = await this.getProviderNetPayout(row.requestId, row.payment.totalAmount);
        return { ...row, refundableCap: net.amount, refundableCapSource: net.source };
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

            const targetLabel = normalizedTarget === DisputeSenderRole.PROVIDER ? 'Provider' : 'Customer';
            await tx.disputeMessage.create({
                data: {
                    caseId,
                    senderRole: DisputeSenderRole.ADMIN,
                    messageType: DisputeMessageType.SYSTEM,
                    body: `Admin vừa yêu cầu ${targetLabel} cung cấp thêm chứng cứ: ${message}`,
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

        if (resolutionType === 'SPLIT') {
            throw new BadRequestException('SPLIT is no longer supported. Use PARTIAL_REFUND.');
        }

        const providerNet = await this.getProviderNetPayout(c.payment.requestId, c.payment.totalAmount);
        if (providerNet.source !== 'WALLET_TX') {
            console.warn(
                `[DisputeRefund] Net payout fallback used for case=${caseId}, request=${c.payment.requestId}. Computed from commission rate.`,
            );
        }
        const refundableCap = providerNet.amount;

        if (resolutionType === 'FULL_REFUND') {
            resolutionAmountCustomer = refundableCap;
            resolutionAmountProvider = 0;
        } else if (resolutionType === 'NO_REFUND') {
            resolutionAmountCustomer = 0;
            resolutionAmountProvider = refundableCap;
        } else if (resolutionType === 'PARTIAL_REFUND') {
            if (resolutionAmountCustomer == null || resolutionAmountCustomer < 0) {
                throw new BadRequestException('resolutionAmountCustomer is required for PARTIAL_REFUND');
            }
            if (resolutionAmountCustomer > refundableCap) {
                throw new BadRequestException(
                    `resolutionAmountCustomer cannot exceed provider net payout (${refundableCap.toLocaleString('vi-VN')} VND)`,
                );
            }
            resolutionAmountProvider = refundableCap - resolutionAmountCustomer;
        }

        await this.prisma.$transaction(async (tx) => {
            // Wallet adjustments for refund cases
            if (
                c.payment.userId &&
                resolutionAmountCustomer != null &&
                resolutionAmountCustomer > 0
            ) {
                const payToUser = resolutionAmountCustomer;

                const pw = await tx.providerWallet.findUnique({
                    where: { providerId: c.payment.providerId },
                });
                if (!pw) {
                    throw new BadRequestException('Provider wallet not found');
                }

                let fromPending = 0;
                if (c.payment.paymentMethod === 'QR') {
                    fromPending = await this.consumeQrPendingHold(
                        tx,
                        pw.id,
                        c.payment.requestId,
                        payToUser,
                    );
                }
                const remainingFromAvailable = Math.max(0, payToUser - fromPending);

                await tx.walletTransaction.create({
                    data: {
                        walletId: pw.id,
                        type: WalletTransactionType.DEBIT,
                        amount: payToUser,
                        status: WalletTransactionStatus.COMPLETED,
                        referenceType: WalletReferenceType.ADJUSTMENT,
                        referenceId: caseId,
                        description:
                            `Điều chỉnh hoàn tiền tranh chấp — job #${c.payment.requestId.slice(0, 8).toUpperCase()}` +
                            (fromPending > 0 ? ` (pending: ${fromPending.toLocaleString('vi-VN')} VND)` : ''),
                    },
                });

                if (remainingFromAvailable > 0) {
                    const updatedProviderWallet = await tx.providerWallet.update({
                        where: { id: pw.id },
                        data: { availableBalance: { decrement: remainingFromAvailable } },
                    });
                    if (updatedProviderWallet.availableBalance < 0) {
                        console.warn(
                            `[DisputeRefund] Provider ${c.payment.providerId} balance is negative (${updatedProviderWallet.availableBalance} VND) after refund case=${caseId}`,
                        );
                    }
                }

                const uw = await tx.userWallet.upsert({
                    where: { userId: c.payment.userId },
                    create: { userId: c.payment.userId, availableBalance: 0, pendingBalance: 0 },
                    update: {},
                });
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
                data: {
                    status:
                        resolutionAmountCustomer != null && resolutionAmountCustomer > 0
                            ? ('REFUNDED' as any)
                            : 'COMPLETED',
                },
            });

            const customerAmount = resolutionAmountCustomer ?? 0;
            const providerAmount = resolutionAmountProvider ?? 0;
            const handlingLine =
                resolutionType === 'NO_REFUND'
                    ? 'Hình thức xử lý: Không hoàn tiền, giữ nguyên nghĩa vụ thanh toán theo kết quả dịch vụ.'
                    : resolutionType === 'FULL_REFUND'
                        ? 'Hình thức xử lý: Hoàn tiền toàn phần cho khách hàng (User) theo mức đủ điều kiện.'
                        : 'Hình thức xử lý: Hoàn tiền một phần dựa trên mức độ vi phạm và thỏa thuận dịch vụ.';
            const additionalNote = resolutionNote?.trim()
                ? `\n\nGhi chú bổ sung từ Admin: ${resolutionNote.trim()}`
                : '';
            const summary = [
                'Thông báo kết quả giải quyết khiếu nại',
                '',
                'Sau quá trình kiểm tra hồ sơ và đối soát chứng cứ từ các bên liên quan, căn cứ theo bộ quy tắc hoạt động của nền tảng RescueMe, Ban Quản trị (Admin) xin thông báo quyết định xử lý cuối cùng như sau:',
                '',
                'Trạng thái: Khiếu nại đã đóng.',
                '',
                handlingLine,
                '',
                'Phân bổ ngân sách:',
                '',
                `Hoàn trả khách hàng (User): ${customerAmount.toLocaleString('vi-VN')}đ`,
                `Thanh toán cho đối tác (Provider): ${providerAmount.toLocaleString('vi-VN')}đ`,
                '',
                'Quyết định có hiệu lực ngay lập tức. Cảm ơn các bên đã phối hợp cùng RescueMe để xây dựng cộng đồng minh bạch.',
                '',
                `Admin đã kết thúc khiếu nại. Hoàn cho User: ${customerAmount.toLocaleString('vi-VN')}đ | Provider nhận: ${providerAmount.toLocaleString('vi-VN')}đ`,
            ].join('\n') + additionalNote;

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

    // ── Request Center ────────────────────────────────────────────────────────

    async getRequestDetail(requestId: string) {
        const req = await this.prisma.rescueRequest.findUnique({
            where: { id: requestId },
            include: {
                user: { select: { id: true, fullName: true, phoneNumber: true, email: true, avatar: true, licensePlate: true, vehicleColor: true } },
                assignedProvider: { select: { id: true, fullName: true, phoneNumber: true, email: true, avatar: true, businessName: true } },
                media: true,
                review: true,
            },
        });

        if (!req) {
            throw new NotFoundException('Request not found');
        }

        const quotes = await this.prisma.quote.findMany({
            where: { rescueRequestId: requestId },
        });

        const payment = await this.prisma.payment.findUnique({
            where: { requestId },
        });

        return {
            req,
            quote: null, // Admin usually sees all quotes, we can pass them in `quotes`
            quotes,
            payment,
            review: req.review,
        };
    }
}

