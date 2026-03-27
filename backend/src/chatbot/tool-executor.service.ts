import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAIService } from './openai.service';
import { allocateUniqueOrderCode } from '../common/business-codes';

interface ToolContext {
    userId?: string;
    guestSessionId?: string;
    userRole: 'USER' | 'PROVIDER' | 'GUEST';
    imageUrls?: string[];
}

@Injectable()
export class ToolExecutorService {
    private readonly logger = new Logger(ToolExecutorService.name);

    constructor(
        private prisma: PrismaService,
        private openaiService: OpenAIService,
    ) {}

    async executeTool(
        toolName: string,
        args: Record<string, unknown>,
        context: ToolContext,
    ): Promise<string> {
        this.logger.log(`Executing tool: ${toolName} with args: ${JSON.stringify(args)}`);

        try {
            switch (toolName) {
                case 'get_my_requests':
                    return await this.getMyRequests(args, context);
                case 'get_profile_defaults':
                    return await this.getProfileDefaults(context);
                case 'get_request_status':
                    return await this.getRequestStatus(args, context);
                case 'get_wallet_balance':
                    return await this.getWalletBalance(context);
                case 'analyze_vehicle_image':
                    return await this.analyzeVehicleImage(args, context);
                case 'get_incident_types':
                    return this.getIncidentTypes();
                case 'get_my_earnings':
                    return await this.getMyEarnings(args, context);
                case 'get_active_request':
                    return await this.getActiveRequest(context);
                case 'get_verification_guide':
                    return await this.getVerificationGuide(context);
                case 'create_rescue_request':
                    return await this.createRescueRequest(args, context);
                case 'estimate_price_range':
                    return this.estimatePriceRange(args);
                default:
                    return JSON.stringify({ error: `Unknown tool: ${toolName}` });
            }
        } catch (error) {
            this.logger.error(`Tool execution error: ${toolName}`, error);
            return JSON.stringify({
                error: 'Không thể thực hiện yêu cầu. Vui lòng thử lại.',
            });
        }
    }

    private async getMyRequests(
        args: Record<string, unknown>,
        context: ToolContext,
    ): Promise<string> {
        const where: Record<string, unknown> = {};

        if (context.userRole === 'PROVIDER') {
            where.assignedProviderId = context.userId;
        } else if (context.userRole === 'GUEST') {
            where.guestSessionId = context.guestSessionId;
        } else {
            where.userId = context.userId;
        }

        if (args.status) {
            where.status = args.status;
        }

        const requests = await this.prisma.rescueRequest.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
                id: true,
                orderCode: true,
                incidentType: true,
                vehicleType: true,
                status: true,
                createdAt: true,
                pickupLocation: true,
                contactPhone: true,
                assignedProvider: {
                    select: { name: true, phoneNumber: true },
                },
                payment: {
                    select: { totalAmount: true, status: true, paymentMethod: true },
                },
            },
        });

        if (requests.length === 0) {
            return JSON.stringify({ message: 'Không tìm thấy đơn cứu hộ nào.' });
        }

        return JSON.stringify(
            requests.map((r) => ({
                id: r.id,
                orderCode: r.orderCode,
                incidentType: r.incidentType,
                vehicleType: r.vehicleType,
                status: r.status,
                createdAt: r.createdAt,
                pickupAddress: (r.pickupLocation as { addressText?: string })?.addressText,
                provider: r.assignedProvider?.name || null,
                payment: r.payment
                    ? {
                          total: r.payment.totalAmount,
                          status: r.payment.status,
                          method: r.payment.paymentMethod,
                      }
                    : null,
            })),
        );
    }

    private async getProfileDefaults(context: ToolContext): Promise<string> {
        if (context.userRole !== 'USER' || !context.userId) {
            return JSON.stringify({
                error: 'Chỉ user đã đăng nhập mới dùng được profile defaults.',
            });
        }

        const user = await this.prisma.user.findUnique({
            where: { id: context.userId },
            select: {
                fullName: true,
                phoneNumber: true,
                vehicleType: true,
                licensePlate: true,
                vehicleColor: true,
                rescueVehicles: true,
                defaultAddress: true,
            },
        });

        if (!user) {
            return JSON.stringify({ error: 'Không tìm thấy thông tin người dùng.' });
        }

        let defaultVehicle: {
            type: string | null;
            licensePlate: string | null;
            color: string | null;
        } = {
            type: user.vehicleType || null,
            licensePlate: user.licensePlate || null,
            color: user.vehicleColor || null,
        };

        const vehicles = Array.isArray(user.rescueVehicles)
            ? user.rescueVehicles
            : [];
        if (!defaultVehicle.type && vehicles.length > 0) {
            const first = vehicles[0] as Record<string, unknown>;
            defaultVehicle = {
                type: (first.type as string) || null,
                licensePlate: (first.licensePlate as string) || null,
                color: (first.color as string) || null,
            };
        }

        return JSON.stringify({
            fullName: user.fullName || null,
            contactPhone: user.phoneNumber || null,
            defaultVehicle,
            rescueVehicles: vehicles,
            // Do not expose raw defaultAddress to the model to avoid it asserting
            // a specific location before user confirmation in chat flow.
            hasDefaultAddress: !!user.defaultAddress,
            note:
                'Thông tin này dùng để auto-fill tạo yêu cầu cứu hộ. Luôn hỏi xác nhận vị trí trước, không tự nêu địa chỉ cụ thể nếu chưa được user xác nhận.',
        });
    }

    private async getRequestStatus(
        args: Record<string, unknown>,
        context: ToolContext,
    ): Promise<string> {
        const requestId = args.requestId as string;

        const request = await this.prisma.rescueRequest.findFirst({
            where: {
                OR: [
                    { id: requestId },
                    { orderCode: requestId },
                ],
                ...(context.userRole === 'PROVIDER'
                    ? { assignedProviderId: context.userId }
                    : context.userRole === 'GUEST'
                      ? { guestSessionId: context.guestSessionId }
                      : { userId: context.userId }),
            },
            select: {
                id: true,
                orderCode: true,
                incidentType: true,
                vehicleType: true,
                status: true,
                createdAt: true,
                pickupLocation: true,
                dropoffLocation: true,
                description: true,
                assignedProvider: {
                    select: { name: true, phoneNumber: true },
                },
                payment: {
                    select: {
                        totalAmount: true,
                        status: true,
                        paymentMethod: true,
                        baseFee: true,
                        distanceFee: true,
                    },
                },
                quotes: {
                    select: {
                        price: true,
                        status: true,
                        estimatedArrivalMinutes: true,
                        provider: { select: { name: true } },
                    },
                },
            },
        });

        if (!request) {
            return JSON.stringify({ error: 'Không tìm thấy đơn cứu hộ này.' });
        }

        return JSON.stringify({
            id: request.id,
            orderCode: request.orderCode,
            incidentType: request.incidentType,
            vehicleType: request.vehicleType,
            status: request.status,
            createdAt: request.createdAt,
            pickupAddress: (request.pickupLocation as { addressText?: string })?.addressText,
            dropoffAddress: (request.dropoffLocation as { addressText?: string })?.addressText,
            description: request.description,
            provider: request.assignedProvider?.name || null,
            providerPhone: request.assignedProvider?.phoneNumber || null,
            payment: request.payment
                ? {
                      total: request.payment.totalAmount,
                      status: request.payment.status,
                      method: request.payment.paymentMethod,
                  }
                : null,
            quotesCount: request.quotes.length,
            quotes: request.quotes.map((q) => ({
                provider: q.provider.name,
                price: q.price,
                eta: q.estimatedArrivalMinutes,
                status: q.status,
            })),
        });
    }

    private async getWalletBalance(context: ToolContext): Promise<string> {
        if (context.userRole === 'GUEST') {
            return JSON.stringify({
                message: 'Tài khoản khách vãng lai không có ví. Đăng ký tài khoản để sử dụng ví.',
            });
        }

        if (context.userRole === 'PROVIDER') {
            const wallet = await this.prisma.providerWallet.findUnique({
                where: { providerId: context.userId },
                select: { availableBalance: true, pendingBalance: true },
            });
            if (!wallet) {
                return JSON.stringify({ message: 'Ví chưa được tạo.' });
            }
            return JSON.stringify({
                availableBalance: wallet.availableBalance,
                pendingBalance: wallet.pendingBalance,
                formatted: `Số dư khả dụng: ${wallet.availableBalance.toLocaleString('vi-VN')} VND, Số dư chờ: ${wallet.pendingBalance.toLocaleString('vi-VN')} VND`,
            });
        }

        const wallet = await this.prisma.userWallet.findUnique({
            where: { userId: context.userId },
            select: { availableBalance: true, pendingBalance: true },
        });
        if (!wallet) {
            return JSON.stringify({ message: 'Ví chưa được tạo.' });
        }
        return JSON.stringify({
            availableBalance: wallet.availableBalance,
            pendingBalance: wallet.pendingBalance,
            formatted: `Số dư khả dụng: ${wallet.availableBalance.toLocaleString('vi-VN')} VND, Số dư chờ: ${wallet.pendingBalance.toLocaleString('vi-VN')} VND`,
        });
    }

    private async analyzeVehicleImage(
        args: Record<string, unknown>,
        context: ToolContext,
    ): Promise<string> {
        if (!context.imageUrls || context.imageUrls.length === 0) {
            return JSON.stringify({
                error: 'Không có ảnh nào được gửi. Vui lòng gửi ảnh sự cố để phân tích.',
            });
        }

        const structuredPrompt = (args.analysisPrompt as string) ||
            `Bạn là chuyên gia phân tích sự cố xe của Rescue Me. Phân tích ảnh và trả lời CHÍNH XÁC theo JSON format sau (không thêm text ngoài JSON):

{
  "summary": "Mô tả ngắn gọn vấn đề trong 1-2 câu bằng tiếng Việt",
  "incidentType": "MỘT TRONG: BREAKDOWN | ACCIDENT | FLAT_TIRE | BATTERY_DEAD | OUT_OF_FUEL | LOCKED_OUT | OTHER",
  "confidence": "MỘT TRONG: high | medium | low",
  "riskLevel": "MỘT TRONG: safe | warning | critical",
  "needsRescueNow": true/false,
  "reasons": ["Lý do 1 cho nhận định", "Lý do 2"],
  "missingInfo": ["Thông tin cần thêm để chẩn đoán chính xác hơn, nếu có"],
  "vehicleType": "CAR hoặc MOTORCYCLE hoặc null nếu không xác định"
}

Quy tắc:
- confidence: "high" nếu rõ ràng nhìn thấy sự cố, "medium" nếu có dấu hiệu nhưng chưa chắc, "low" nếu ảnh mờ/không rõ
- riskLevel: "critical" cho tai nạn/ngập nước/cháy/chập điện, "warning" cho hỏng máy/xẹp lốp/hết bình, "safe" cho vấn đề nhỏ
- needsRescueNow: true nếu riskLevel là "critical" hoặc "warning" và xe không thể di chuyển
- Luôn trả lời bằng tiếng Việt cho summary và reasons`;

        const rawAnalysis = await this.openaiService.analyzeImage(
            context.imageUrls,
            structuredPrompt,
        );

        try {
            const jsonMatch = rawAnalysis.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return JSON.stringify({
                    structured: true,
                    ...parsed,
                });
            }
        } catch {
            // Fall back to unstructured
        }

        return JSON.stringify({
            structured: false,
            summary: rawAnalysis,
            incidentType: 'OTHER',
            confidence: 'low',
            riskLevel: 'warning',
            needsRescueNow: false,
            reasons: [],
            missingInfo: ['Không thể phân tích cấu trúc. Vui lòng mô tả thêm sự cố.'],
        });
    }

    private getIncidentTypes(): string {
        return JSON.stringify([
            { code: 'BREAKDOWN', name: 'Xe hỏng/chết máy', description: 'Xe không khởi động được hoặc dừng hoạt động giữa đường' },
            { code: 'ACCIDENT', name: 'Tai nạn giao thông', description: 'Xe bị va chạm, hư hỏng do tai nạn' },
            { code: 'FLAT_TIRE', name: 'Nổ/xẹp lốp', description: 'Lốp xe bị xẹp, nổ hoặc hỏng' },
            { code: 'BATTERY_DEAD', name: 'Hết bình ắc quy', description: 'Ắc quy hết điện, xe không đề được' },
            { code: 'OUT_OF_FUEL', name: 'Hết xăng/nhiên liệu', description: 'Xe hết nhiên liệu giữa đường' },
            { code: 'LOCKED_OUT', name: 'Khóa xe trong xe', description: 'Chìa khóa bị nhốt trong xe' },
            { code: 'OTHER', name: 'Sự cố khác', description: 'Các sự cố không thuộc danh mục trên' },
        ]);
    }

    private async getMyEarnings(
        args: Record<string, unknown>,
        context: ToolContext,
    ): Promise<string> {
        if (context.userRole !== 'PROVIDER') {
            return JSON.stringify({ error: 'Chỉ provider mới có thể xem thu nhập.' });
        }

        const wallet = await this.prisma.providerWallet.findUnique({
            where: { providerId: context.userId },
        });

        if (!wallet) {
            return JSON.stringify({ message: 'Ví chưa được tạo.' });
        }

        const period = (args.period as string) || 'today';
        const now = new Date();
        let startDate: Date;

        switch (period) {
            case 'this_week': {
                startDate = new Date(now);
                startDate.setDate(now.getDate() - now.getDay());
                startDate.setHours(0, 0, 0, 0);
                break;
            }
            case 'this_month': {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            }
            case 'all_time': {
                startDate = new Date(0);
                break;
            }
            default: {
                startDate = new Date(now);
                startDate.setHours(0, 0, 0, 0);
            }
        }

        const transactions = await this.prisma.walletTransaction.findMany({
            where: {
                walletId: wallet.id,
                type: 'CREDIT',
                referenceType: { in: ['JOB', 'JOB_PAYMENT'] },
                status: 'COMPLETED',
                createdAt: { gte: startDate },
            },
            select: { amount: true },
        });

        const commissions = await this.prisma.walletTransaction.findMany({
            where: {
                walletId: wallet.id,
                type: 'DEBIT',
                referenceType: 'COMMISSION',
                status: 'COMPLETED',
                createdAt: { gte: startDate },
            },
            select: { amount: true },
        });

        const totalEarnings = transactions.reduce((s, t) => s + t.amount, 0);
        const totalCommission = commissions.reduce((s, t) => s + t.amount, 0);

        const completedRequests = await this.prisma.rescueRequest.count({
            where: {
                assignedProviderId: context.userId,
                status: 'COMPLETED',
                completedAt: { gte: startDate },
            },
        });

        const periodLabel =
            period === 'today' ? 'Hôm nay'
            : period === 'this_week' ? 'Tuần này'
            : period === 'this_month' ? 'Tháng này'
            : 'Toàn bộ';

        return JSON.stringify({
            period: periodLabel,
            totalEarnings,
            totalCommission,
            netEarnings: totalEarnings - totalCommission,
            completedRequests,
            formatted: `${periodLabel}: Thu nhập ${totalEarnings.toLocaleString('vi-VN')} VND, Hoa hồng ${totalCommission.toLocaleString('vi-VN')} VND, Thực nhận ${(totalEarnings - totalCommission).toLocaleString('vi-VN')} VND. Số đơn hoàn thành: ${completedRequests}`,
        });
    }

    private async getActiveRequest(context: ToolContext): Promise<string> {
        if (context.userRole !== 'PROVIDER') {
            return JSON.stringify({ error: 'Chỉ provider mới có thể xem đơn đang xử lý.' });
        }

        const request = await this.prisma.rescueRequest.findFirst({
            where: {
                assignedProviderId: context.userId,
                status: { in: ['ASSIGNED', 'IN_PROGRESS', 'ARRIVED', 'WORKING', 'PAYMENT_PENDING'] },
            },
            orderBy: { updatedAt: 'desc' },
            select: {
                id: true,
                orderCode: true,
                incidentType: true,
                vehicleType: true,
                status: true,
                pickupLocation: true,
                dropoffLocation: true,
                contactPhone: true,
                description: true,
                user: { select: { name: true, phoneNumber: true } },
            },
        });

        if (!request) {
            return JSON.stringify({ message: 'Bạn không có đơn cứu hộ nào đang xử lý.' });
        }

        return JSON.stringify({
            id: request.id,
            orderCode: request.orderCode,
            incidentType: request.incidentType,
            vehicleType: request.vehicleType,
            status: request.status,
            pickupAddress: (request.pickupLocation as { addressText?: string })?.addressText,
            dropoffAddress: (request.dropoffLocation as { addressText?: string })?.addressText,
            contactPhone: request.contactPhone,
            description: request.description,
            customerName: request.user?.name || 'Khách vãng lai',
        });
    }

    private async createRescueRequest(
        args: Record<string, unknown>,
        context: ToolContext,
    ): Promise<string> {
        if (context.userRole === 'PROVIDER') {
            return JSON.stringify({ error: 'Provider không thể tạo yêu cầu cứu hộ.' });
        }

        const incidentType = args.incidentType as string;
        const vehicleType = args.vehicleType as string;
        const pickupAddress = args.pickupAddress as string;
        const pickupLocation =
            (args.pickupLocation as { addressText?: string; lat?: number; lng?: number } | undefined) ||
            null;
        const contactPhone = args.contactPhone as string;

        const resolvedPickupAddress = pickupLocation?.addressText || pickupAddress;
        const resolvedLat = typeof pickupLocation?.lat === 'number' ? pickupLocation.lat : 0;
        const resolvedLng = typeof pickupLocation?.lng === 'number' ? pickupLocation.lng : 0;

        // USER flow must use verified location object to avoid hallucinated addresses.
        if (context.userRole === 'USER') {
            const hasVerifiedLocation =
                !!pickupLocation?.addressText &&
                typeof pickupLocation?.lat === 'number' &&
                typeof pickupLocation?.lng === 'number';
            if (!hasVerifiedLocation) {
                return JSON.stringify({
                    error: 'Thiếu vị trí xác thực',
                    message:
                        'Vui lòng xác nhận vị trí bằng "Dùng vị trí hiện tại" hoặc chọn "Nhập vị trí khác" để lấy địa chỉ từ bản đồ.',
                    missingFields: ['pickupLocation.addressText', 'pickupLocation.lat', 'pickupLocation.lng'],
                });
            }
        }

        if (!incidentType || !vehicleType || !resolvedPickupAddress || !contactPhone) {
            const missing: string[] = [];
            if (!incidentType) missing.push('loại sự cố (incidentType)');
            if (!vehicleType) missing.push('loại xe (vehicleType)');
            if (!resolvedPickupAddress) missing.push('địa chỉ đón (pickupLocation/pickupAddress)');
            if (!contactPhone) missing.push('số điện thoại (contactPhone)');
            return JSON.stringify({
                error: 'Thiếu thông tin bắt buộc',
                missingFields: missing,
                message: `Cần bổ sung: ${missing.join(', ')}`,
            });
        }

        try {
            const now = new Date();
            const phase1TimeoutSec = 60;
            const quoteWindowDurationSec = 180;
            const phaseExpiresAt = new Date(now.getTime() + phase1TimeoutSec * 1000);
            const quoteWindowExpiresAt = new Date(
                now.getTime() + quoteWindowDurationSec * 1000,
            );
            const orderCode = await allocateUniqueOrderCode(this.prisma);

            const data: Record<string, unknown> = {
                orderCode,
                incidentType,
                vehicleType,
                pickupLocation: {
                    addressText: resolvedPickupAddress,
                    lat: resolvedLat,
                    lng: resolvedLng,
                },
                contactPhone,
                status: 'MATCHING',
                description: (args.description as string) || null,
                licensePlate: (args.licensePlate as string) || null,
                vehicleColor: (args.vehicleColor as string) || null,
                matchingStartedAt: now,
                expiresAt: phaseExpiresAt,
                matchAttempts: 1,
                searchPhase: 1,
                quoteWindowDuration: quoteWindowDurationSec,
                quoteWindowExpiresAt,
                maxQuotes: 3,
                quoteCount: 0,
            };

            if (context.userRole === 'GUEST' && context.guestSessionId) {
                data.guestSessionId = context.guestSessionId;
                data.requesterType = 'GUEST';
            } else if (context.userId) {
                data.userId = context.userId;
                data.requesterType = 'USER';
            }

            const request = await this.prisma.rescueRequest.create({
                data: data as any,
                select: {
                    id: true,
                    orderCode: true,
                    incidentType: true,
                    vehicleType: true,
                    status: true,
                    contactPhone: true,
                    createdAt: true,
                },
            });

            return JSON.stringify({
                success: true,
                message: 'Đã tạo yêu cầu cứu hộ thành công!',
                request: {
                    id: request.id,
                    orderCode: request.orderCode,
                    incidentType: request.incidentType,
                    vehicleType: request.vehicleType,
                    status: request.status,
                    contactPhone: request.contactPhone,
                    pickupAddress: resolvedPickupAddress,
                },
                nextStep: 'Hệ thống sẽ bắt đầu tìm kiếm provider gần nhất. Khách có thể theo dõi trạng thái đơn trên app.',
            });
        } catch (error) {
            this.logger.error('Failed to create rescue request via chatbot', error);
            return JSON.stringify({
                error: 'Không thể tạo yêu cầu cứu hộ. Vui lòng thử tạo trực tiếp trên ứng dụng.',
            });
        }
    }

    private estimatePriceRange(args: Record<string, unknown>): string {
        const incidentType = args.incidentType as string;
        const vehicleType = args.vehicleType as string;

        const priceMap: Record<string, { car: [number, number]; motorcycle: [number, number]; service: string }> = {
            BREAKDOWN: { car: [300000, 800000], motorcycle: [150000, 400000], service: 'Sửa chữa tại chỗ / Kéo xe' },
            ACCIDENT: { car: [500000, 1500000], motorcycle: [200000, 600000], service: 'Kéo xe về gara' },
            FLAT_TIRE: { car: [200000, 500000], motorcycle: [100000, 250000], service: 'Thay lốp tận nơi' },
            BATTERY_DEAD: { car: [200000, 400000], motorcycle: [100000, 200000], service: 'Câu bình / Kích bình' },
            OUT_OF_FUEL: { car: [150000, 300000], motorcycle: [80000, 150000], service: 'Giao xăng tận nơi' },
            LOCKED_OUT: { car: [200000, 500000], motorcycle: [100000, 300000], service: 'Mở khóa xe' },
            OTHER: { car: [200000, 800000], motorcycle: [100000, 400000], service: 'Cứu hộ tổng hợp' },
        };

        const prices = priceMap[incidentType] || priceMap['OTHER'];
        const range = vehicleType === 'MOTORCYCLE' ? prices.motorcycle : prices.car;

        return JSON.stringify({
            incidentType,
            vehicleType,
            service: prices.service,
            priceRange: {
                min: range[0],
                max: range[1],
                formatted: `${range[0].toLocaleString('vi-VN')} - ${range[1].toLocaleString('vi-VN')} VND`,
            },
            note: 'Đây là giá tham khảo. Giá thực tế phụ thuộc vào báo giá của provider, khoảng cách, và tình trạng cụ thể.',
        });
    }

    private async getVerificationGuide(context: ToolContext): Promise<string> {
        if (context.userRole !== 'PROVIDER') {
            return JSON.stringify({ error: 'Chỉ provider mới có hướng dẫn xác minh.' });
        }

        const user = await this.prisma.user.findUnique({
            where: { id: context.userId },
            select: {
                verificationStatus: true,
                providerType: true,
                serviceTypes: true,
                rejectReasonCode: true,
                rejectReasonDetail: true,
            },
        });

        if (!user) {
            return JSON.stringify({ error: 'Không tìm thấy thông tin.' });
        }

        const uploads = await this.prisma.upload.findMany({
            where: {
                userId: context.userId,
                purpose: 'PROVIDER_VERIFICATION',
                confirmed: true,
            },
            select: { docType: true },
        });

        const uploadedDocTypes = uploads.map((u) => u.docType);
        const requiredDocs = ['CITIZEN_ID_FRONT', 'CITIZEN_ID_BACK', 'SELFIE'];
        if (user.providerType === 'BUSINESS') {
            requiredDocs.push('BUSINESS_REGISTRATION');
        }

        const missingDocs = requiredDocs.filter((d) => !uploadedDocTypes.includes(d as never));

        return JSON.stringify({
            currentStatus: user.verificationStatus,
            providerType: user.providerType || 'Chưa chọn',
            serviceTypes: user.serviceTypes,
            uploadedDocuments: uploadedDocTypes,
            missingDocuments: missingDocs,
            rejectReason: user.rejectReasonDetail || user.rejectReasonCode || null,
            guide:
                user.verificationStatus === 'APPROVED'
                    ? 'Tài khoản đã được duyệt. Bạn có thể bắt đầu nhận đơn.'
                    : user.verificationStatus === 'PENDING'
                      ? 'Hồ sơ đang chờ admin duyệt. Vui lòng đợi.'
                      : user.verificationStatus === 'REJECTED'
                        ? `Hồ sơ bị từ chối. Lý do: ${user.rejectReasonDetail || user.rejectReasonCode || 'Không rõ'}. Vui lòng cập nhật và gửi lại.`
                        : `Cần hoàn thiện hồ sơ. Giấy tờ còn thiếu: ${missingDocs.join(', ') || 'Không'}. Sau khi đầy đủ, vào trang Xác minh để gửi hồ sơ.`,
        });
    }
}
