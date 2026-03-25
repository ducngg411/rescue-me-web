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
import {
    allocateUniqueProviderWalletTxnCode,
    allocateUniqueUserWalletTxnCode,
    formatOrderLabelForSupport,
} from '../common/business-codes';


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

    async getProviderStats() {
        const statuses = await this.prisma.user.groupBy({
            where: { role: 'PROVIDER' },
            by: ['verificationStatus'],
            _count: {
                _all: true,
            },
        });

        let pending = 0;
        let approved = 0;
        let rejected = 0;
        let suspended = 0;
        let total = 0;

        for (const s of statuses) {
            const count = s._count._all;
            total += count;
            if (s.verificationStatus === 'PENDING') pending += count;
            else if (s.verificationStatus === 'APPROVED') approved += count;
            else if (s.verificationStatus === 'REJECTED') rejected += count;
            else if (s.verificationStatus === 'SUSPENDED') suspended += count;
        }

        return {
            total,
            pending,
            approved,
            rejected,
            suspended
        };
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
                            orderCode: true,
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
        } else         if (resolutionType === 'PARTIAL_REFUND') {
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

        const refundReqMeta = await this.prisma.rescueRequest.findUnique({
            where: { id: c.payment.requestId },
            select: { orderCode: true },
        });
        const refundOrderLabel = formatOrderLabelForSupport(refundReqMeta?.orderCode, c.payment.requestId);

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

                const adjProvTxn = await allocateUniqueProviderWalletTxnCode(tx);
                await tx.walletTransaction.create({
                    data: {
                        walletId: pw.id,
                        txnCode: adjProvTxn,
                        type: WalletTransactionType.DEBIT,
                        amount: payToUser,
                        status: WalletTransactionStatus.COMPLETED,
                        referenceType: WalletReferenceType.ADJUSTMENT,
                        referenceId: caseId,
                        description:
                            `Điều chỉnh hoàn tiền tranh chấp — đơn ${refundOrderLabel}` +
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
                const adjUserTxn = await allocateUniqueUserWalletTxnCode(tx);
                await tx.userWalletTransaction.create({
                    data: {
                        walletId: uw.id,
                        txnCode: adjUserTxn,
                        type: WalletTransactionType.CREDIT,
                        amount: payToUser,
                        status: WalletTransactionStatus.COMPLETED,
                        referenceType: UserWalletReferenceType.REFUND,
                        referenceId: caseId,
                        description: `Hoàn tiền tranh chấp — đơn ${refundOrderLabel}`,
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

    // ── Wallets ─────────────────────────────────────────────────────────────

    async getProviderWallets(query: any) {
        const where: any = {};
        if (query.search) {
            where.provider = {
                OR: [
                    { email: { contains: query.search, mode: 'insensitive' } },
                    { fullName: { contains: query.search, mode: 'insensitive' } },
                ]
            };
        }

        const skip = query.skip || 0;
        const take = Math.min(query.take || 20, 100);

        let orderBy: any = { availableBalance: 'desc' };
        if (query.sort === 'balance_asc') orderBy = { availableBalance: 'asc' };
        else if (query.sort === 'updated_desc') orderBy = { updatedAt: 'desc' };

        const [items, total] = await this.prisma.$transaction([
            this.prisma.providerWallet.findMany({
                where,
                skip,
                take,
                orderBy,
                include: {
                    provider: { select: { id: true, email: true, fullName: true, avatar: true, phoneNumber: true } },
                    _count: { select: { transactions: true, topupTransactions: true } }
                }
            }),
            this.prisma.providerWallet.count({ where })
        ]);

        // Aggregate total commission per wallet in a single batch query
        const walletIds = items.map((w: any) => w.id);
        const commAgg = walletIds.length > 0
            ? await this.prisma.walletTransaction.groupBy({
                by: ['walletId'],
                where: { walletId: { in: walletIds }, referenceType: 'COMMISSION' as any, type: 'DEBIT' },
                _sum: { amount: true },
              })
            : [];
        const commMap = new Map(commAgg.map((r: any) => [r.walletId, r._sum.amount ?? 0]));
        const itemsWithComm = items.map((w: any) => ({ ...w, totalCommission: commMap.get(w.id) ?? 0 }));

        return { items: itemsWithComm, total, skip, take };
    }

    async getUserWallets(query: any) {
        const where: any = {};
        if (query.search) {
            where.user = {
                OR: [
                    { email: { contains: query.search, mode: 'insensitive' } },
                    { fullName: { contains: query.search, mode: 'insensitive' } },
                ]
            };
        }

        const skip = query.skip || 0;
        const take = Math.min(query.take || 20, 100);

        let orderBy: any = { availableBalance: 'desc' };
        if (query.sort === 'balance_asc') orderBy = { availableBalance: 'asc' };
        else if (query.sort === 'updated_desc') orderBy = { updatedAt: 'desc' };

        const [items, total] = await this.prisma.$transaction([
            this.prisma.userWallet.findMany({
                where,
                skip,
                take,
                orderBy,
                include: {
                    user: { select: { id: true, email: true, fullName: true, avatar: true, phoneNumber: true } },
                    _count: { select: { transactions: true, topupTxs: true } }
                }
            }),
            this.prisma.userWallet.count({ where })
        ]);

        return { items, total, skip, take };
    }

    async getProviderWalletByProviderId(providerId: string) {
        const wallet = await this.prisma.providerWallet.findUnique({
            where: { providerId },
            include: { provider: { select: { id: true, email: true, fullName: true, avatar: true, phoneNumber: true } } }
        });
        if (!wallet) return null;

        const agg = await this.prisma.walletTransaction.groupBy({
            by: ['type'],
            where: { walletId: wallet.id, status: 'COMPLETED' },
            _sum: { amount: true },
        });

        let totalIncome = 0;
        let totalExpense = 0;
        for (const a of agg) {
            if (a.type === 'CREDIT') totalIncome = a._sum.amount || 0;
            if (a.type === 'DEBIT') totalExpense = a._sum.amount || 0;
        }

        return { ...wallet, totalIncome, totalExpense };
    }

    async getUserWalletByUserId(userId: string) {
        return this.prisma.userWallet.findUnique({
            where: { userId },
            include: { user: { select: { id: true, email: true, fullName: true, avatar: true, phoneNumber: true } } }
        });
    }

    // ── Transactions ─────────────────────────────────────────────────────────

    private buildTransactionWhere(query: any) {
        const where: any = {};
        if (query.startDate || query.endDate) {
            where.createdAt = {};
            if (query.startDate) where.createdAt.gte = new Date(query.startDate);
            if (query.endDate) where.createdAt.lte = new Date(query.endDate);
        }
        if (query.status) {
            if (query.status === 'EXPIRED_OR_CANCELLED') {
                where.status = { in: ['EXPIRED', 'CANCELLED'] };
            } else {
                where.status = query.status;
            }
        }
        return where;
    }

    async getTransactionSummary() {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const completedPayments = await this.prisma.payment.aggregate({
            where: { status: 'COMPLETED' },
            _sum: { totalAmount: true },
        });

        const commissions = await this.prisma.walletTransaction.aggregate({
            where: { referenceType: 'COMMISSION', status: 'COMPLETED' },
            _sum: { amount: true },
        });

        const qrwPayments = await this.prisma.payment.aggregate({
            where: { status: 'COMPLETED', paymentMethod: { in: ['QR', 'WALLET'] } },
            _sum: { totalAmount: true },
        });
        const qrwCommission = Math.round((qrwPayments._sum.totalAmount || 0) * this.getCommissionRate());
        const totalCommission = (commissions._sum.amount || 0) + qrwCommission;

        const providerTopups = await this.prisma.topupTransaction.aggregate({
            where: { status: 'COMPLETED', completedAt: { gte: startOfToday } },
            _sum: { amount: true },
        });
        const userTopups = await this.prisma.userTopupTransaction.aggregate({
            where: { status: 'COMPLETED', completedAt: { gte: startOfToday } },
            _sum: { amount: true },
        });

        const pendingWallets = await this.prisma.walletTransaction.count({ where: { status: 'PENDING' } });
        const pendingUserWallets = await this.prisma.userWalletTransaction.count({ where: { status: 'PENDING' } });
        const pendingWithdraws = await this.prisma.walletTransaction.count({ where: { status: 'PENDING', referenceType: 'WITHDRAW' } });
        const pendingUserWithdraws = await this.prisma.userWalletTransaction.count({ where: { status: 'PENDING', referenceType: 'WITHDRAW' } });

        return {
            totalRevenue: completedPayments._sum.totalAmount || 0,
            totalCommission: totalCommission,
            totalTopupToday: (providerTopups._sum.amount || 0) + (userTopups._sum.amount || 0),
            pendingTransactions: pendingWallets + pendingUserWallets,
            pendingWithdrawals: pendingWithdraws + pendingUserWithdraws,
        };
    }

    async getWalletTransactions(userType: 'PROVIDER' | 'USER', query: any) {
        const where: any = this.buildTransactionWhere(query);
        if (query.referenceType) where.referenceType = query.referenceType;
        if (query.type) where.type = query.type;

        const skip = query.skip || 0;
        const take = Math.min(query.take || 20, 100);

        const s = typeof query.search === 'string' ? query.search.trim() : '';
        if (s) {
            const codeOr = [
                { txnCode: { contains: s, mode: 'insensitive' } },
                { referenceId: { contains: s, mode: 'insensitive' } },
                { id: { contains: s, mode: 'insensitive' } },
                { description: { contains: s, mode: 'insensitive' } },
            ];
            if (query.userId) {
                if (userType === 'PROVIDER') {
                    where.wallet = { provider: { id: query.userId } };
                } else {
                    where.wallet = { user: { id: query.userId } };
                }
                where.OR = codeOr;
            } else {
                const walletUserOr =
                    userType === 'PROVIDER'
                        ? {
                              provider: {
                                  OR: [
                                      { email: { contains: s, mode: 'insensitive' } },
                                      { fullName: { contains: s, mode: 'insensitive' } },
                                  ],
                              },
                          }
                        : {
                              user: {
                                  OR: [
                                      { email: { contains: s, mode: 'insensitive' } },
                                      { fullName: { contains: s, mode: 'insensitive' } },
                                  ],
                              },
                          };
                where.OR = [...codeOr, { wallet: walletUserOr }];
            }
        } else if (query.userId) {
            if (userType === 'PROVIDER') {
                where.wallet = { provider: { id: query.userId } };
            } else {
                where.wallet = { user: { id: query.userId } };
            }
        }

        if (userType === 'PROVIDER') {
            const [items, total] = await this.prisma.$transaction([
                this.prisma.walletTransaction.findMany({
                    where,
                    skip,
                    take,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        wallet: {
                            include: { provider: { select: { id: true, email: true, fullName: true, avatar: true } } }
                        }
                    }
                }),
                this.prisma.walletTransaction.count({ where })
            ]);
            return { items, total, skip, take };
        } else {
            const [items, total] = await this.prisma.$transaction([
                this.prisma.userWalletTransaction.findMany({
                    where,
                    skip,
                    take,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        wallet: {
                            include: { user: { select: { id: true, email: true, fullName: true, avatar: true } } }
                        }
                    }
                }),
                this.prisma.userWalletTransaction.count({ where })
            ]);
            return { items, total, skip, take };
        }
    }

    async getTopupTransactions(userType: 'PROVIDER' | 'USER', query: any) {
        const where: any = this.buildTransactionWhere(query);

        const skip = query.skip || 0;
        const take = Math.min(query.take || 20, 100);

        const s = typeof query.search === 'string' ? query.search.trim() : '';
        if (s) {
            const codeOr = [
                { transferCode: { contains: s, mode: 'insensitive' } },
                { txnCode: { contains: s, mode: 'insensitive' } },
                { sepayReferenceCode: { contains: s, mode: 'insensitive' } },
                { id: { contains: s, mode: 'insensitive' } },
            ];
            if (query.userId) {
                if (userType === 'PROVIDER') {
                    where.wallet = { provider: { id: query.userId } };
                } else {
                    where.wallet = { user: { id: query.userId } };
                }
                where.OR = codeOr;
            } else {
                const walletUserOr =
                    userType === 'PROVIDER'
                        ? {
                              provider: {
                                  OR: [
                                      { email: { contains: s, mode: 'insensitive' } },
                                      { fullName: { contains: s, mode: 'insensitive' } },
                                  ],
                              },
                          }
                        : {
                              user: {
                                  OR: [
                                      { email: { contains: s, mode: 'insensitive' } },
                                      { fullName: { contains: s, mode: 'insensitive' } },
                                  ],
                              },
                          };
                where.OR = [...codeOr, { wallet: walletUserOr }];
            }
        } else if (query.userId) {
            if (userType === 'PROVIDER') {
                where.wallet = { provider: { id: query.userId } };
            } else {
                where.wallet = { user: { id: query.userId } };
            }
        }

        if (userType === 'PROVIDER') {
            const [items, total] = await this.prisma.$transaction([
                this.prisma.topupTransaction.findMany({
                    where,
                    skip,
                    take,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        wallet: {
                            include: { provider: { select: { id: true, email: true, fullName: true, avatar: true } } }
                        }
                    }
                }),
                this.prisma.topupTransaction.count({ where })
            ]);
            return { items, total, skip, take };
        } else {
            const [items, total] = await this.prisma.$transaction([
                this.prisma.userTopupTransaction.findMany({
                    where,
                    skip,
                    take,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        wallet: {
                            include: { user: { select: { id: true, email: true, fullName: true, avatar: true } } }
                        }
                    }
                }),
                this.prisma.userTopupTransaction.count({ where })
            ]);
            return { items, total, skip, take };
        }
    }

    async getJobPaymentTransactions(query: any) {
        const where = this.buildTransactionWhere(query);
        const skip = query.skip || 0;
        const take = Math.min(query.take || 20, 100);

        if (query.search) {
            const s = query.search.trim();
            where.OR = [
                { requestId: { contains: s } },
                { transferCode: { contains: s, mode: 'insensitive' } },
                { txnCode: { contains: s, mode: 'insensitive' } },
                { id: { contains: s, mode: 'insensitive' } },
            ];
        }

        const [items, total] = await this.prisma.$transaction([
            this.prisma.jobPaymentTransaction.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    request: { select: { id: true, orderCode: true } },
                },
            }),
            this.prisma.jobPaymentTransaction.count({ where })
        ]);
        return { items, total, skip, take };
    }

    async getPayments(query: any) {
        const where = this.buildTransactionWhere(query);
        if (query.paymentMethod) where.paymentMethod = query.paymentMethod;

        if (query.search) {
            const s = query.search.trim();
            where.OR = [
                { requestId: { contains: s } },
                { id: { contains: s, mode: 'insensitive' } },
                { request: { orderCode: { contains: s, mode: 'insensitive' } } },
            ];
        }

        const skip = query.skip || 0;
        const take = Math.min(query.take || 20, 100);

        const [items, total] = await this.prisma.$transaction([
            this.prisma.payment.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    request: {
                        select: { 
                            id: true, 
                            orderCode: true,
                            status: true, 
                            incidentType: true, 
                            user: { select: { id: true, fullName: true, email: true, avatar: true } }, 
                            assignedProvider: { select: { id: true, fullName: true, email: true, avatar: true } } 
                        }
                    },
                    disputeCase: {
                        select: {
                            id: true,
                            status: true,
                            resolutionType: true,
                            openedByRole: true,
                            createdAt: true,
                        }
                    }
                }
            }),
            this.prisma.payment.count({ where })
        ]);

        // Attach commission amount per payment (COMMISSION DEBIT on provider wallet, referenceId = requestId)
        const requestIds = items.map((p: any) => p.requestId);
        const commTxs = requestIds.length > 0
            ? await this.prisma.walletTransaction.findMany({
                where: { referenceId: { in: requestIds }, referenceType: 'COMMISSION' as any, type: 'DEBIT' },
                select: { referenceId: true, amount: true },
              })
            : [];
        const commByRequest = new Map(commTxs.map((t: any) => [t.referenceId, t.amount]));
        const commissionRate = this.getCommissionRate();
        const itemsWithComm = items.map((p: any) => {
            // Current system:
            // - CASH: commission is actually debited from provider wallet -> read from COMMISSION DEBIT tx
            // - QR/WALLET: commission is withheld when crediting provider payout (net credit), but no COMMISSION DEBIT tx is created
            // => fallback for QR/WALLET to keep admin UI consistent.
            const commissionFromTx = commByRequest.get(p.requestId);
            const commissionFallback =
                ['QR', 'WALLET'].includes(p.paymentMethod)
                    ? Math.round((p.totalAmount ?? 0) * commissionRate)
                    : null;

            return {
                ...p,
                commissionAmount: commissionFromTx ?? commissionFallback,
                commissionRate,
            };
        });

        return { items: itemsWithComm, total, skip, take };
    }

    // ── Rescue Requests ──────────────────────────────────────────────────────

    async getRescueRequests(query: {
        search?: string;
        status?: string;
        incidentType?: string;
        dateFrom?: string;
        dateTo?: string;
        hasDispute?: string;
        skip?: number;
        take?: number;
    }) {
        // Query params come in as strings from the client; coerce to numbers
        // to avoid Prisma "Expected Int, provided String" errors.
        const skip = Number(query.skip ?? 0);
        const take = Math.min(Number(query.take ?? 20), 100);

        const where: any = {};

        if (query.status) {
            if (query.status.includes(',')) {
                where.status = { in: query.status.split(',') };
            } else {
                where.status = query.status;
            }
        }
        if (query.incidentType) where.incidentType = query.incidentType;

        if (query.dateFrom || query.dateTo) {
            where.createdAt = {};
            if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
            if (query.dateTo) {
                const to = new Date(query.dateTo);
                to.setHours(23, 59, 59, 999);
                where.createdAt.lte = to;
            }
        }

        if (query.hasDispute === 'true') {
            where.disputeCases = { some: {} };
        }

        if (query.search) {
            const q = query.search;
            where.OR = [
                { orderCode: { contains: q, mode: 'insensitive' } },
                { user: { fullName: { contains: q, mode: 'insensitive' } } },
                { user: { email: { contains: q, mode: 'insensitive' } } },
                { user: { phoneNumber: { contains: q } } },
                { assignedProvider: { fullName: { contains: q, mode: 'insensitive' } } },
                { licensePlate: { contains: q, mode: 'insensitive' } },
            ];
        }

        const [items, total] = await Promise.all([
            this.prisma.rescueRequest.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    orderCode: true,
                    status: true,
                    incidentType: true,
                    vehicleType: true,
                    licensePlate: true,
                    createdAt: true,
                    completedAt: true,
                    requesterType: true,
                    pickupLocation: true,
                    user: { select: { id: true, fullName: true, email: true, avatar: true, phoneNumber: true } },
                    assignedProvider: { select: { id: true, fullName: true, avatar: true, phoneNumber: true } },
                    payment: { select: { id: true, totalAmount: true, paymentMethod: true, status: true } },
                    _count: { select: { quotes: true, disputeCases: true } },
                },
            }),
            this.prisma.rescueRequest.count({ where }),
        ]);

        return { items, total, skip, take };
    }

    async getRescueRequestStats() {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [total, completed, cancelled, newThisMonth, disputed] = await Promise.all([
            this.prisma.rescueRequest.count(),
            this.prisma.rescueRequest.count({ where: { status: { in: ['COMPLETED', 'PAID'] } } }),
            this.prisma.rescueRequest.count({ where: { status: 'CANCELLED' } }),
            this.prisma.rescueRequest.count({ where: { createdAt: { gte: startOfMonth } } }),
            // Count rescue requests that have at least one dispute case
            this.prisma.rescueRequest.count({ where: { disputeCases: { some: {} } } }),
        ]);

        return { total, completed, cancelled, newThisMonth, disputed };
    }

    async getRescueRequestDetail(id: string) {
        const req = await this.prisma.rescueRequest.findUnique({
            where: { id },
            include: {
                user: { select: { id: true, fullName: true, email: true, avatar: true, phoneNumber: true, licensePlate: true, vehicleColor: true } },
                assignedProvider: { select: { id: true, fullName: true, email: true, phoneNumber: true, avatar: true, businessName: true } },
                payment: true,
                quotes: {
                    orderBy: { createdAt: 'desc' },
                    include: { provider: { select: { id: true, fullName: true, avatar: true } } },
                },
                media: { select: { id: true, publicUrl: true, mediaType: true } },
                review: true,
                disputeCases: {
                    select: { id: true, status: true, reason: true, targetAmount: true, createdAt: true },
                },
            },
        });

        if (!req) throw new NotFoundException('Request not found');
        return { req, quotes: req.quotes, payment: req.payment };
    }

    // ── Users ────────────────────────────────────────────────────────────────


    async getUsers(query: {
        search?: string;
        role?: string;
        status?: string;
        dateFrom?: string;
        dateTo?: string;
        skip?: number;
        take?: number;
    }) {
        const skip = query.skip ?? 0;
        const take = Math.min(query.take ?? 20, 100);

        const where: any = {};
        // Default: show all account roles in Users list (USER + PROVIDER + ADMIN)
        if (query.role) {
            where.role = query.role;
        } else {
            where.role = { in: ['USER', 'PROVIDER', 'ADMIN'] as any };
        }

        if (query.search) {
            const q = query.search;
            where.OR = [
                { fullName: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { phoneNumber: { contains: q } },
            ];
        }

        if (query.status === 'ACTIVE') {
            where.profileCompleted = true;
        } else if (query.status === 'INACTIVE') {
            where.profileCompleted = false;
        }

        if (query.dateFrom || query.dateTo) {
            where.createdAt = {};
            if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
            if (query.dateTo) {
                const to = new Date(query.dateTo);
                to.setHours(23, 59, 59, 999);
                where.createdAt.lte = to;
            }
        }

        const [items, total] = await this.prisma.$transaction([
            this.prisma.user.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                    avatar: true,
                    phoneNumber: true,
                    authProvider: true,
                    profileCompleted: true,
                    role: true,
                    bannedAt: true,
                    banReason: true,
                    createdAt: true,
                    lastLogin: true,
                    _count: {
                        select: { rescueRequests: true },
                    },
                    userWallet: {
                        select: { availableBalance: true },
                    },
                    providerWallet: {
                        select: { availableBalance: true },
                    },
                },
            }),
            this.prisma.user.count({ where }),
        ]);

        return { items, total, skip, take };
    }

    async getUserStats() {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [total, active, inactive, newThisMonth] = await this.prisma.$transaction([
            this.prisma.user.count({ where: { role: 'USER' } }),
            this.prisma.user.count({ where: { role: 'USER', profileCompleted: true } }),
            this.prisma.user.count({ where: { role: 'USER', profileCompleted: false } }),
            this.prisma.user.count({ where: { role: 'USER', createdAt: { gte: startOfMonth } } }),
        ]);

        return { total, active, inactive, newThisMonth };
    }

    async getUserDetail(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                role: true,
                fullName: true,
                email: true,
                avatar: true,
                phoneNumber: true,
                authProvider: true,
                profileCompleted: true,
                createdAt: true,
                lastLogin: true,
                defaultAddress: true,
                licensePlate: true,
                vehicleColor: true,
                vehicleType: true,
                bannedAt: true,
                banReason: true,
                userWallet: {
                    select: { availableBalance: true, pendingBalance: true },
                },
                providerWallet: {
                    select: { availableBalance: true, pendingBalance: true },
                },
                _count: { select: { rescueRequests: true, reviewsGiven: true } },
                rescueRequests: {
                    take: 5,
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        orderCode: true,
                        incidentType: true,
                        status: true,
                        createdAt: true,
                        payment: { select: { totalAmount: true } },
                    },
                },
            },
        });
        if (!user) throw new NotFoundException('User not found');
        return user;
    }

    async suspendUser(userId: string, banReason: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');
        const updated = await this.prisma.user.update({
            where: { id: userId },
            data: { bannedAt: new Date(), banReason },
        });
        // Fire-and-forget notification email
        setImmediate(() => {
            this.mailService.sendUserSuspended(
                updated.email,
                updated.fullName || updated.email,
                banReason,
            );
        });
        return updated;
    }

    async activateUser(userId: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');
        const updated = await this.prisma.user.update({
            where: { id: userId },
            data: { bannedAt: null, banReason: null },
        });
        setImmediate(() => {
            this.mailService.sendUserUnsuspended(
                updated.email,
                updated.fullName || updated.email,
            );
        });
        return updated;
    }

    async deleteUser(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, fullName: true, role: true },
        });
        if (!user) throw new NotFoundException('User not found');

        const deleted = await this.prisma.user.delete({ where: { id: userId } });

        // Fire-and-forget notification email
        setImmediate(() => {
            this.mailService.sendUserDeleted(
                user.email,
                user.fullName || user.email,
            );
        });

        return deleted;
    }
}
