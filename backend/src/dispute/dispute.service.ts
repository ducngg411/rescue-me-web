import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
    DisputeCaseStatus,
    DisputeOpenedByRole,
    DisputeSenderRole,
    DisputeMessageType,
    DisputeVisibility,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { formatOrderLabelForSupport } from '../common/business-codes';

const FIRST_RESPONSE_SLA_HOURS = 24;
const RESOLUTION_SLA_HOURS = 72;

export interface OpenDisputeDto {
    orderId: string;   // rescueRequestId
    paymentId: string;
    targetAmount: number;
    reason: string;
    description?: string;
    expectedOutcome?: string;
    attachmentUrls?: string[];
}

export interface SendMessageDto {
    body: string;
    messageType?: DisputeMessageType;
    visibility?: DisputeVisibility;
    attachmentUrls?: string[];
}

@Injectable()
export class DisputeService {
    private readonly logger = new Logger(DisputeService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly mailService: MailService,
    ) { }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async handleProviderNoResponseTimeout() {
        const now = new Date();
        const overdueCases = await this.prisma.disputeCase.findMany({
            where: {
                status: DisputeCaseStatus.WAITING_FOR_PROVIDER,
                providerReplyAllowed: true,
                firstRespondedAt: null,
                providerUnresponsiveAt: null,
                firstResponseDueAt: { lt: now },
            },
            select: {
                id: true,
            },
            take: 100,
        });
        for (const row of overdueCases) {
            await this.prisma.$transaction(async (tx) => {
                await tx.disputeCase.update({
                    where: { id: row.id },
                    data: {
                        status: DisputeCaseStatus.INVESTIGATING,
                        providerUnresponsiveAt: now,
                        providerReplyAllowed: false,
                        customerReplyAllowed: false,
                        lastCoordinatorNote: 'Provider did not respond within 24h.',
                    },
                });
                await tx.disputeMessage.create({
                    data: {
                        caseId: row.id,
                        senderRole: DisputeSenderRole.SYSTEM,
                        messageType: DisputeMessageType.SYSTEM,
                        body: 'Provider did not respond within 24 hours. Case escalated to admin for priority handling.',
                        visibility: DisputeVisibility.PUBLIC,
                    },
                });
            });
        }
    }

    // ── Open Dispute ────────────────────────────────────────────────────────

    async openDispute(
        userId: string,
        role: 'CUSTOMER' | 'PROVIDER',
        dto: OpenDisputeDto,
    ) {
        // Validate payment exists and belongs to user/provider
        const payment = await this.prisma.payment.findUnique({
            where: { id: dto.paymentId },
            include: { request: true },
        });

        if (!payment) throw new NotFoundException('Payment not found');
        if (payment.requestId !== dto.orderId) {
            throw new BadRequestException('orderId does not match payment');
        }

        if (role === 'CUSTOMER' && payment.userId !== userId) {
            throw new ForbiddenException('You do not own this payment');
        }
        if (role === 'PROVIDER' && payment.providerId !== userId) {
            throw new ForbiddenException('You are not the provider for this payment');
        }

        // Check for existing active dispute
        const existing = await this.prisma.disputeCase.findUnique({
            where: { paymentId: dto.paymentId },
        });
        if (existing) {
            throw new BadRequestException('A dispute already exists for this payment');
        }

        const commissionRateStr = process.env.COMMISSION_RATE;
        const commissionRate = commissionRateStr ? parseFloat(commissionRateStr) : 0.1;
        const maxTargetAmount = payment.totalAmount - Math.round(payment.totalAmount * commissionRate);
        const finalTargetAmount = Math.min(dto.targetAmount, maxTargetAmount);

        const now = new Date();
        const firstResponseDueAt = new Date(now.getTime() + FIRST_RESPONSE_SLA_HOURS * 3600_000);
        const resolutionDueAt = new Date(now.getTime() + RESOLUTION_SLA_HOURS * 3600_000);

        // Initial status: customer opens → waiting for provider; provider opens → waiting for customer
        const initialStatus: DisputeCaseStatus =
            role === 'CUSTOMER'
                ? DisputeCaseStatus.WAITING_FOR_PROVIDER
                : DisputeCaseStatus.WAITING_FOR_CUSTOMER;

        const reqLabelRow = await this.prisma.rescueRequest.findUnique({
            where: { id: dto.orderId },
            select: { orderCode: true },
        });
        const orderLabel = formatOrderLabelForSupport(reqLabelRow?.orderCode, dto.orderId);
        const openingBody =
            role === 'CUSTOMER'
                ? `Khách hàng khiếu nại đơn hàng ${orderLabel} với lý do: ${dto.reason}. Cứu hộ viên vui lòng phản hồi sớm.`
                : `Cứu hộ viên khiếu nại đơn hàng ${orderLabel} với lý do: ${dto.reason}. Khách hàng vui lòng phản hồi sớm.`;

        const disputeCase = await this.prisma.$transaction(async (tx) => {
            const dc = await tx.disputeCase.create({
                data: {
                    paymentId: dto.paymentId,
                    requestId: dto.orderId,
                    openedByUserId: userId,
                    openedByRole: role as DisputeOpenedByRole,
                    targetAmount: finalTargetAmount,
                    reason: dto.reason,
                    description: dto.description,
                    expectedOutcome: dto.expectedOutcome,
                    status: initialStatus,
                    firstResponseDueAt,
                    resolutionDueAt,
                    customerMessageCount: role === 'CUSTOMER' ? 1 : 0,
                    providerMessageCount: role === 'PROVIDER' ? 1 : 0,
                    customerReplyAllowed: role === 'PROVIDER',
                    providerReplyAllowed: role === 'CUSTOMER',
                },
            });

            // System rules message
            await tx.disputeMessage.create({
                data: {
                    caseId: dc.id,
                    senderRole: DisputeSenderRole.SYSTEM,
                    messageType: DisputeMessageType.SYSTEM,
                    body: 'RescueMe Dispute Center: Tranh chấp là điều không ai mong muốn, nhưng chúng tôi sẽ giúp bạn xử lý. Hãy cung cấp bằng chứng xác thực để bảo vệ quyền lợi của mình.',
                    visibility: DisputeVisibility.PUBLIC,
                },
            });

            // Opening packaged message
            await tx.disputeMessage.create({
                data: {
                    caseId: dc.id,
                    senderRole:
                        role === 'CUSTOMER' ? DisputeSenderRole.CUSTOMER : DisputeSenderRole.PROVIDER,
                    messageType: DisputeMessageType.TEXT,
                    body: openingBody,
                    userId,
                    visibility: DisputeVisibility.PUBLIC,
                    mediaUrls: dto.attachmentUrls ?? [],
                },
            });

            if (dto.attachmentUrls?.length) {
                await tx.disputeEvidence.createMany({
                    data: dto.attachmentUrls.map((url) => ({
                        caseId: dc.id,
                        url,
                        uploadedByUserId: userId,
                    })),
                });
            }

            // Mark payment as disputed
            await tx.payment.update({
                where: { id: dto.paymentId },
                data: { status: 'DISPUTED', disputedAt: now, disputeReason: dto.reason },
            });

            return dc;
        });

        const req = await this.prisma.rescueRequest.findUnique({
            where: { id: dto.orderId },
            include: {
                user: { select: { fullName: true, email: true } },
                assignedProvider: { select: { email: true, fullName: true } },
            },
        });
        setImmediate(async () => {
            try {
                const adminEmail = process.env.ADMIN_EMAIL;
                const disputedBy = req?.user?.fullName || req?.user?.email || userId;
                if (req?.assignedProvider?.email) {
                    await this.mailService.sendPaymentDispute({
                        email: req.assignedProvider.email,
                        name: req.assignedProvider.fullName || req.assignedProvider.email,
                        isAdmin: false,
                        requestId: dto.orderId,
                        orderCode: req?.orderCode,
                        reason: dto.reason,
                        disputedBy,
                    });
                }
                if (adminEmail) {
                    await this.mailService.sendPaymentDispute({
                        email: adminEmail,
                        name: 'Admin',
                        isAdmin: true,
                        requestId: dto.orderId,
                        orderCode: req?.orderCode,
                        reason: dto.reason,
                        disputedBy,
                    });
                }
            } catch { }
        });

        this.logger.log(`Dispute opened: case=${disputeCase.id} by ${role}=${userId}`);

        return {
            disputeId: disputeCase.id,
            status: disputeCase.status,
            firstResponseDueAt,
            resolutionDueAt,
        };
    }

    // ── List Disputes ───────────────────────────────────────────────────────

    async getMyDisputes(userId: string, role: 'CUSTOMER' | 'PROVIDER') {
        const where =
            role === 'CUSTOMER'
                ? {
                    OR: [
                        { openedByUserId: userId },
                        { payment: { userId } },
                    ],
                }
                : {
                    OR: [
                        { openedByUserId: userId },
                        { payment: { providerId: userId } },
                    ],
                };

        const [items, total] = await this.prisma.$transaction([
            this.prisma.disputeCase.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: 50,
                include: {
                    payment: {
                        select: {
                            id: true,
                            requestId: true,
                            totalAmount: true,
                            paymentMethod: true,
                        },
                    },
                    request: {
                        select: { id: true, orderCode: true, incidentType: true, status: true },
                    },
                },
            }),
            this.prisma.disputeCase.count({ where }),
        ]);

        const enriched = await Promise.all(
            items.map(async (item) => {
                const state = await this.prisma.disputeReadState.findUnique({
                    where: { caseId_userId: { caseId: item.id, userId } },
                    select: { lastReadAt: true },
                });
                const unreadCount = await this.prisma.disputeMessage.count({
                    where: {
                        caseId: item.id,
                        visibility: DisputeVisibility.PUBLIC,
                        userId: { not: userId },
                        ...(state?.lastReadAt ? { createdAt: { gt: state.lastReadAt } } : {}),
                    },
                });
                return { ...item, unreadCount };
            }),
        );

        return { items: enriched, total };
    }

    // ── Detail ──────────────────────────────────────────────────────────────

    async getDisputeDetail(caseId: string, userId: string, role: 'CUSTOMER' | 'PROVIDER' | 'ADMIN') {
        const dc = await this.prisma.disputeCase.findUnique({
            where: { id: caseId },
            include: {
                payment: {
                    include: {
                        request: {
                            include: {
                                user: { select: { id: true, fullName: true, email: true, phoneNumber: true } },
                                assignedProvider: { select: { id: true, fullName: true, email: true, phoneNumber: true } },
                            },
                        },
                    },
                },
                messages: {
                    where:
                        role === 'ADMIN'
                            ? undefined
                            : { visibility: DisputeVisibility.PUBLIC },
                    orderBy: { createdAt: 'asc' },
                    include: {
                        author: { select: { id: true, fullName: true, avatar: true } },
                    },
                },
                evidence: { orderBy: { createdAt: 'asc' } },
                readStates: {
                    include: {
                        user: { select: { id: true, fullName: true } },
                    },
                },
                openedBy: { select: { id: true, fullName: true, email: true } },
                resolvedBy: { select: { id: true, fullName: true } },
            },
        });

        if (!dc) throw new NotFoundException('Dispute case not found');

        // Permission check: non-admin can only see their own cases
        if (role !== 'ADMIN') {
            const isCustomer = dc.payment.userId === userId;
            const isProvider = dc.payment.providerId === userId;
            if (!isCustomer && !isProvider) {
                throw new ForbiddenException('You do not have access to this dispute');
            }
            await this.prisma.disputeReadState.upsert({
                where: { caseId_userId: { caseId, userId } },
                create: { caseId, userId, lastReadAt: new Date() },
                update: { lastReadAt: new Date() },
            });
        }

        const now = new Date();
        const isOverdue =
            dc.firstResponseDueAt != null &&
            !dc.firstRespondedAt &&
            dc.firstResponseDueAt < now;

        return {
            ...dc,
            isOverdue,
            isClosed: dc.status === 'RESOLVED' || dc.status === 'REJECTED',
            permissions: {
                canSendMessage:
                    dc.status !== 'RESOLVED' &&
                    dc.status !== 'REJECTED' &&
                    (role === 'ADMIN'
                        ? true
                        : role === 'CUSTOMER'
                            ? dc.customerReplyAllowed
                            : dc.providerReplyAllowed),
                canUploadEvidence:
                    dc.status !== 'RESOLVED' && dc.status !== 'REJECTED',
                canResolve: role === 'ADMIN',
                canReject: role === 'ADMIN',
                canChangeStatus: role === 'ADMIN',
                canSendInternal: role === 'ADMIN',
            },
        };
    }

    // ── Send Message ────────────────────────────────────────────────────────

    async sendMessage(
        caseId: string,
        userId: string,
        role: 'CUSTOMER' | 'PROVIDER' | 'ADMIN',
        dto: SendMessageDto,
    ) {
        const dc = await this.prisma.disputeCase.findUnique({
            where: { id: caseId },
            include: { payment: true },
        });
        if (!dc) throw new NotFoundException('Dispute case not found');

        const isClosed = dc.status === 'RESOLVED' || dc.status === 'REJECTED';
        if (isClosed && role !== 'ADMIN') {
            throw new BadRequestException('This dispute is closed and no longer accepts messages');
        }

        // Only admins can send INTERNAL messages
        const visibility: DisputeVisibility =
            role === 'ADMIN' && dto.visibility === 'INTERNAL'
                ? DisputeVisibility.INTERNAL
                : DisputeVisibility.PUBLIC;

        const senderRole: DisputeSenderRole =
            role === 'CUSTOMER'
                ? DisputeSenderRole.CUSTOMER
                : role === 'PROVIDER'
                    ? DisputeSenderRole.PROVIDER
                    : DisputeSenderRole.ADMIN;

        if (senderRole === DisputeSenderRole.CUSTOMER && dc.payment.userId !== userId) {
            throw new ForbiddenException('You do not have access to this dispute');
        }
        if (senderRole === DisputeSenderRole.PROVIDER && dc.payment.providerId !== userId) {
            throw new ForbiddenException('You do not have access to this dispute');
        }
        if (senderRole === DisputeSenderRole.CUSTOMER && !dc.customerReplyAllowed) {
            throw new BadRequestException('Customer message quota reached. Wait for admin to request more evidence.');
        }
        if (senderRole === DisputeSenderRole.PROVIDER && !dc.providerReplyAllowed) {
            throw new BadRequestException('Provider message quota reached. Wait for admin to request more evidence.');
        }
        if (!dto.body?.trim() && !(dto.attachmentUrls?.length)) {
            throw new BadRequestException('Message body or attachment is required');
        }

        return this.prisma.$transaction(async (tx) => {
            const msg = await tx.disputeMessage.create({
                data: {
                    caseId,
                    senderRole,
                    messageType: dto.messageType ?? DisputeMessageType.TEXT,
                    body: dto.body?.trim() || 'Đính kèm minh chứng',
                    visibility,
                    userId,
                    mediaUrls: dto.attachmentUrls ?? [],
                },
                include: {
                    author: { select: { id: true, fullName: true, avatar: true } },
                },
            });

            // Attach evidence URLs if provided
            if (dto.attachmentUrls?.length) {
                await tx.disputeEvidence.createMany({
                    data: dto.attachmentUrls.map((url) => ({
                        caseId,
                        url,
                        uploadedByUserId: userId,
                    })),
                });
            }

            const now = new Date();
            const updatedCase = await tx.disputeCase.update({
                where: { id: caseId },
                data: {
                    status:
                        senderRole === DisputeSenderRole.ADMIN
                            ? dc.status
                            : DisputeCaseStatus.INVESTIGATING,
                    customerReplyAllowed:
                        senderRole === DisputeSenderRole.ADMIN ? dc.customerReplyAllowed : false,
                    providerReplyAllowed:
                        senderRole === DisputeSenderRole.ADMIN ? dc.providerReplyAllowed : false,
                    ...(senderRole === DisputeSenderRole.CUSTOMER
                        ? { customerMessageCount: { increment: 1 } }
                        : {}),
                    ...(senderRole === DisputeSenderRole.PROVIDER
                        ? { providerMessageCount: { increment: 1 } }
                        : {}),
                    ...(!dc.firstRespondedAt &&
                        ((dc.status === DisputeCaseStatus.WAITING_FOR_PROVIDER && senderRole === DisputeSenderRole.PROVIDER) ||
                            (dc.status === DisputeCaseStatus.WAITING_FOR_CUSTOMER && senderRole === DisputeSenderRole.CUSTOMER))
                        ? { firstRespondedAt: now }
                        : {}),
                },
            });

            return { message: msg, updatedStatus: updatedCase.status };
        });
    }

    async openCustomerDisputeFromPayment(requestId: string, userId: string, reason: string) {
        const payment = await this.prisma.payment.findUnique({
            where: { requestId },
        });
        if (!payment) throw new NotFoundException('Payment not found for this request');

        const existing = await this.prisma.disputeCase.findUnique({
            where: { paymentId: payment.id },
        });
        if (existing) {
            if (existing.status === 'RESOLVED' || existing.status === 'REJECTED') {
                throw new BadRequestException('This dispute is already closed');
            }
            throw new BadRequestException('A dispute already exists for this payment');
        }

        const commissionRateStr = process.env.COMMISSION_RATE;
        const commissionRate = commissionRateStr ? parseFloat(commissionRateStr) : 0.1;
        const netAmount = payment.totalAmount - Math.round(payment.totalAmount * commissionRate);

        return this.openDispute(userId, 'CUSTOMER', {
            orderId: requestId,
            paymentId: payment.id,
            targetAmount: netAmount,
            reason,
        });
    }
}
