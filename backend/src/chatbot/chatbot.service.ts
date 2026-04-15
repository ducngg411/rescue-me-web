import {
    Injectable,
    Logger,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAIService } from './openai.service';
import { ToolExecutorService } from './tool-executor.service';
import { CustomerProfileDefaultsService } from './customer-profile-defaults.service';
import {
    buildCustomerKnownSnapshot,
    computeOrderedMissingFields,
    formatCustomerKnownDirective,
    formatMissingFieldsDirective,
} from './guided-missing-fields';
import { CUSTOMER_SYSTEM_PROMPT } from './prompts/customer-system-prompt';
import { PROVIDER_SYSTEM_PROMPT } from './prompts/provider-system-prompt';
import { GUEST_SYSTEM_PROMPT } from './prompts/guest-system-prompt';
import { CUSTOMER_TOOLS } from './tools/customer-tools';
import { PROVIDER_TOOLS } from './tools/provider-tools';
import {
    ChatCompletionMessageParam,
    ChatCompletionTool,
} from 'openai/resources/chat/completions';
import { Subject } from 'rxjs';
import {
    type CustomerCtaPhase,
    computeCustomerCtaPhase,
    inferPromptCtaPhaseForUserMessage,
    formatCtaStateDirective,
    assistantTextImpliesConfirmRecap,
    extractModelState,
    stripModelStateTag,
} from './customer-cta-phase';

export type { CustomerCtaPhase } from './customer-cta-phase';

export interface ChatbotStreamEvent {
    type: 'delta' | 'tool_start' | 'tool_end' | 'done' | 'error' | 'action';
    content?: string;
    toolName?: string;
    action?: string;
    payload?: Record<string, unknown>;
    ctaPhase?: CustomerCtaPhase;
}

interface CallerIdentity {
    userId?: string;
    guestSessionId?: string;
    userRole: 'USER' | 'PROVIDER' | 'GUEST';
}

interface GuidedDraftRequest {
    incidentType?: string;
    vehicleType?: string;
    licensePlate?: string;
    vehicleColor?: string;
    contactPhone?: string;
    pickupLocation?: {
        addressText: string;
        lat: number;
        lng: number;
    };
    description?: string;
    mediaUrls?: string[];
}

interface GuidedConversationState {
    profileLoaded: boolean;
    pendingAction?: 'confirm_location' | 'confirm_create' | 'edit_field' | 'describe_incident' | 'complaint_confirm' | 'wallet_withdrawal_confirm';
    draftRequest: GuidedDraftRequest;
    /** True immediately after create_rescue_request succeeds — suppresses guided-flow CTAs. */
    requestCreated?: boolean;
    /** Populated once lookup_order_for_complaint succeeds; suppresses rescue-request CTAs. */
    complaintDraft?: {
        requestId?: string;
        paymentId?: string;
        orderCode?: string;
        maxDisputeAmount?: number;
    };
    /** Set after initiate_topup — tracks the active top-up transaction. */
    walletTopup?: {
        topupTxId: string;
        amount: number;
    };
    /** Collects withdrawal info before confirmation. */
    withdrawalDraft?: {
        amount?: number;
        bankName?: string;
        accountNumber?: string;
        accountHolderName?: string;
        withdrawalAccountId?: string;
    };
}

const CTA_COOLDOWN_MESSAGES = 3;
const CTA_DECLINE_PHRASES = [
    'không cần', 'thôi', 'để sau', 'không', 'để tôi xem', 'chưa cần',
    'tôi tự xử lý', 'tự làm', 'không tạo', 'để xem đã', 'chưa',
    'ko cần', 'ko', 'khỏi', 'từ chối',
];

@Injectable()
export class ChatbotService {
    private readonly logger = new Logger(ChatbotService.name);
    private readonly guidedState = new Map<string, GuidedConversationState>();

    constructor(
        private prisma: PrismaService,
        private openaiService: OpenAIService,
        private toolExecutor: ToolExecutorService,
        private customerProfileDefaults: CustomerProfileDefaultsService,
    ) {}

    async createConversation(caller: CallerIdentity, title?: string) {
        const chatbotRole =
            caller.userRole === 'USER'
                ? 'USER'
                : caller.userRole === 'PROVIDER'
                  ? 'PROVIDER'
                  : 'GUEST';

        return this.prisma.chatbotConversation.create({
            data: {
                userId: caller.userId || null,
                guestSessionId: caller.guestSessionId || null,
                userRole: chatbotRole,
                title: title || null,
            },
        });
    }

    async listConversations(caller: CallerIdentity) {
        const where = caller.guestSessionId
            ? { guestSessionId: caller.guestSessionId }
            : { userId: caller.userId };

        return this.prisma.chatbotConversation.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            take: 20,
            select: {
                id: true,
                title: true,
                createdAt: true,
                updatedAt: true,
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { content: true, role: true, createdAt: true },
                },
            },
        });
    }

    async getConversation(caller: CallerIdentity, conversationId: string) {
        const conversation =
            await this.prisma.chatbotConversation.findUnique({
                where: { id: conversationId },
                include: {
                    messages: { orderBy: { createdAt: 'asc' } },
                },
            });

        if (!conversation) throw new NotFoundException('Conversation not found');
        this.assertOwnership(caller, conversation);

        return conversation;
    }

    async deleteConversation(caller: CallerIdentity, conversationId: string) {
        const conversation =
            await this.prisma.chatbotConversation.findUnique({
                where: { id: conversationId },
            });

        if (!conversation) throw new NotFoundException('Conversation not found');
        this.assertOwnership(caller, conversation);

        await this.prisma.chatbotConversation.delete({
            where: { id: conversationId },
        });
        this.guidedState.delete(conversationId);
        return { success: true };
    }

    async sendMessage(
        caller: CallerIdentity,
        conversationId: string,
        content: string,
        imageUrls?: string[],
        originalMediaUrls?: string[],
    ): Promise<Subject<ChatbotStreamEvent>> {
        const conversation =
            await this.prisma.chatbotConversation.findUnique({
                where: { id: conversationId },
                include: {
                    messages: {
                        orderBy: { createdAt: 'asc' },
                        take: 50,
                    },
                },
            });

        if (!conversation) throw new NotFoundException('Conversation not found');
        this.assertOwnership(caller, conversation);

        let normalizedContent: string;
        let aiImageUrls = imageUrls;

        if (caller.userRole === 'USER') {
            this.loadGuidedStateFromPersistence(conversationId, conversation.guidedState);
            const state = this.getOrCreateGuidedState(conversationId);
            
            // Block image pass-through to AI if responding to DESCRIBE_INCIDENT.
            // This prevents massive TPM bills from Gpt-4o re-analyzing images/videos
            // when we already have all state and just want it to invoke create_rescue_request.
            if (state.pendingAction === 'describe_incident') {
                aiImageUrls = [];
            }

            normalizedContent = this.normalizeUserContentForGuidedFlow(
                conversationId,
                content,
                imageUrls,
                originalMediaUrls,
            );
            if (caller.userId) {
                await this.eagerHydrateCustomerProfile(conversationId, caller.userId);
            }
            await this.persistGuidedStateToDb(conversationId);
        } else {
            normalizedContent = content.trim();
        }

        const dbImageUrls = originalMediaUrls?.length ? originalMediaUrls : (imageUrls || []);

        await this.prisma.chatbotMessage.create({
            data: {
                conversationId,
                role: 'USER',
                content: normalizedContent,
                imageUrls: dbImageUrls,
            },
        });

        if (!conversation.title && conversation.messages.length === 0) {
            const titleSnippet = normalizedContent.length > 40 ? normalizedContent.slice(0, 40) + '...' : normalizedContent;
            await this.prisma.chatbotConversation.update({
                where: { id: conversationId },
                data: { title: titleSnippet },
            });
        }

        const subject = new Subject<ChatbotStreamEvent>();

        this.processAIResponse(caller, conversationId, conversation.messages, normalizedContent, aiImageUrls, subject).catch(
            (err) => {
                this.logger.error('AI processing error', err);
                subject.next({ type: 'error', content: 'Có lỗi xảy ra. Vui lòng thử lại.' });
                subject.complete();
            },
        );

        return subject;
    }

    private buildCtaDirective(
        existingMessages: Array<{ role: string; content: string }>,
        userRole: string,
    ): string | null {
        if (userRole === 'PROVIDER' || userRole === 'GUEST') return null;

        const recentMessages = existingMessages.slice(-10);

        let lastCtaIndex = -1;
        let declineCount = 0;

        for (let i = recentMessages.length - 1; i >= 0; i--) {
            const msg = recentMessages[i];
            if (msg.role === 'ASSISTANT' && msg.content) {
                const lower = msg.content.toLowerCase();
                if (
                    lower.includes('tạo yêu cầu cứu hộ') ||
                    lower.includes('tạo đơn') ||
                    lower.includes('em tạo') ||
                    lower.includes('create_rescue_request')
                ) {
                    lastCtaIndex = i;
                    break;
                }
            }
        }

        if (lastCtaIndex >= 0) {
            for (let i = lastCtaIndex + 1; i < recentMessages.length; i++) {
                const msg = recentMessages[i];
                if (msg.role === 'USER' && msg.content) {
                    const lower = msg.content.toLowerCase();
                    if (CTA_DECLINE_PHRASES.some((p) => lower.includes(p))) {
                        declineCount++;
                    }
                }
            }

            const messagesSinceLastCta = recentMessages.length - 1 - lastCtaIndex;

            if (declineCount >= 2) {
                return `[CTA-POLICY] Khách đã từ chối tạo đơn ${declineCount} lần. KHÔNG đề xuất tạo đơn nữa trong cuộc hội thoại này trừ khi khách chủ động yêu cầu.`;
            }

            if (messagesSinceLastCta < CTA_COOLDOWN_MESSAGES) {
                return `[CTA-POLICY] Đã đề xuất tạo đơn gần đây. KHÔNG đề xuất lại. Chỉ tư vấn thêm nếu khách hỏi.`;
            }
        }

        return null;
    }

    private getOrCreateGuidedState(conversationId: string): GuidedConversationState {
        const existing = this.guidedState.get(conversationId);
        if (existing) return existing;
        const created: GuidedConversationState = {
            profileLoaded: false,
            pendingAction: undefined,
            draftRequest: {},
        };
        this.guidedState.set(conversationId, created);
        return created;
    }

    private loadGuidedStateFromPersistence(conversationId: string, raw: unknown) {
        const empty: GuidedConversationState = {
            profileLoaded: false,
            pendingAction: undefined,
            draftRequest: {},
        };
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            this.guidedState.set(conversationId, { ...empty, draftRequest: { ...empty.draftRequest } });
            return;
        }
        const o = raw as Record<string, unknown>;
        const draftIn = o.draftRequest;
        const draft: GuidedDraftRequest =
            draftIn && typeof draftIn === 'object' && !Array.isArray(draftIn)
                ? { ...(draftIn as GuidedDraftRequest) }
                : {};
        const pa = o.pendingAction;
        const pendingOk =
            pa === 'confirm_location' || pa === 'confirm_create' || pa === 'edit_field' || pa === 'describe_incident' || pa === 'complaint_confirm' || pa === 'wallet_withdrawal_confirm'
                ? pa
                : undefined;
        const cdRaw = o.complaintDraft;
        const complaintDraft =
            cdRaw && typeof cdRaw === 'object' && !Array.isArray(cdRaw)
                ? (cdRaw as GuidedConversationState['complaintDraft'])
                : undefined;
        const wtRaw = o.walletTopup;
        const walletTopup =
            wtRaw && typeof wtRaw === 'object' && !Array.isArray(wtRaw) &&
            typeof (wtRaw as Record<string, unknown>).topupTxId === 'string'
                ? (wtRaw as GuidedConversationState['walletTopup'])
                : undefined;
        this.guidedState.set(conversationId, {
            profileLoaded: !!o.profileLoaded,
            pendingAction: pendingOk,
            draftRequest: draft,
            requestCreated: !!o.requestCreated,
            complaintDraft,
            walletTopup,
        });
    }

    private async persistGuidedStateToDb(conversationId: string) {
        const state = this.guidedState.get(conversationId);
        if (!state) return;
        try {
            await this.prisma.chatbotConversation.update({
                where: { id: conversationId },
                data: {
                    guidedState: JSON.parse(
                        JSON.stringify({
                            profileLoaded: state.profileLoaded,
                            pendingAction: state.pendingAction ?? null,
                            draftRequest: state.draftRequest,
                            requestCreated: state.requestCreated ?? false,
                            complaintDraft: state.complaintDraft ?? null,
                            walletTopup: state.walletTopup ?? null,
                        }),
                    ),
                },
            });
        } catch (e) {
            this.logger.warn(`persistGuidedStateToDb failed for ${conversationId}`, e);
        }
    }

    private async eagerHydrateCustomerProfile(conversationId: string, userId: string) {
        const state = this.getOrCreateGuidedState(conversationId);
        if (state.profileLoaded) return;
        const payload = await this.customerProfileDefaults.loadPayload(userId);
        if (!payload) return;
        this.mergeProfileDefaultsIntoState(state, {
            contactPhone: payload.contactPhone,
            defaultVehicle: payload.defaultVehicle,
        });
    }

    private mergeProfileDefaultsIntoState(
        state: GuidedConversationState,
        profile: {
            contactPhone?: string | null;
            defaultVehicle?: { type?: string | null; licensePlate?: string | null; color?: string | null };
        },
    ) {
        state.profileLoaded = true;
        const d = state.draftRequest;
        if (profile.contactPhone && !d.contactPhone) {
            d.contactPhone = profile.contactPhone;
        }
        if (profile.defaultVehicle?.type && !d.vehicleType) {
            d.vehicleType = profile.defaultVehicle.type;
        }
        if (profile.defaultVehicle?.licensePlate && !d.licensePlate) {
            d.licensePlate = profile.defaultVehicle.licensePlate;
        }
        if (profile.defaultVehicle?.color && !d.vehicleColor) {
            d.vehicleColor = profile.defaultVehicle.color;
        }
        if (
            !d.pickupLocation &&
            state.pendingAction !== 'confirm_create' &&
            state.pendingAction !== 'edit_field'
        ) {
            state.pendingAction = 'confirm_location';
        }
    }

    private normalizeUserContentForGuidedFlow(
        conversationId: string,
        rawContent: string,
        imageUrls?: string[],
        originalMediaUrls?: string[],
    ): string {
        const state = this.getOrCreateGuidedState(conversationId);
        const content = rawContent.trim();
        
        const mediaToUse = originalMediaUrls?.length ? originalMediaUrls : imageUrls;

        // ── COMPLAINT_CONFIRM: user is confirming they want to submit the complaint ──
        if (state.pendingAction === 'complaint_confirm') {
            const lower = content.toLowerCase();
            const isConfirmation =
                lower.includes('xác nhận') ||
                lower.includes('gửi khiếu nại') ||
                lower.includes('đồng ý') ||
                lower === 'ok' ||
                lower.includes('tiếp tục') ||
                lower.includes('gửi đi');
            if (isConfirmation && state.complaintDraft?.requestId && state.complaintDraft?.paymentId) {
                return `[Khách hàng xác nhận gửi khiếu nại] HÃY GỌI NGAY tool open_complaint với requestId="${state.complaintDraft.requestId}", paymentId="${state.complaintDraft.paymentId}", và các thông tin đã thu thập trong cuộc hội thoại (reason, targetAmount, description, expectedOutcome, attachmentUrls). TUYỆT ĐỐI không hỏi thêm gì nữa.`;
            }
        }

        // ── WALLET_WITHDRAWAL_CONFIRM: user is confirming the withdrawal request ──
        if (state.pendingAction === 'wallet_withdrawal_confirm') {
            const lower = content.toLowerCase();
            const isConfirmation =
                lower.includes('xác nhận') ||
                lower.includes('xác nhận rút') ||
                lower.includes('đồng ý') ||
                lower === 'ok' ||
                lower.includes('tiếp tục') ||
                lower.includes('rút tiền');
            if (isConfirmation) {
                const draft = state.withdrawalDraft;
                const draftHint = draft
                    ? ` Dùng thông tin: amount=${draft.amount ?? '(từ hội thoại)'}${draft.bankName ? `, bankName="${draft.bankName}"` : ''}${draft.accountNumber ? `, accountNumber="${draft.accountNumber}"` : ''}${draft.accountHolderName ? `, accountHolderName="${draft.accountHolderName}"` : ''}${draft.withdrawalAccountId ? `, withdrawalAccountId="${draft.withdrawalAccountId}"` : ''}.`
                    : ' Dùng toàn bộ thông tin đã thu thập trong cuộc hội thoại.';
                return `[Khách hàng xác nhận rút tiền] HÃY GỌI NGAY tool initiate_withdrawal.${draftHint} TUYỆT ĐỐI không hỏi thêm gì nữa.`;
            }
        }

        // ── DESCRIBE_INCIDENT: user is responding to the optional media/description prompt ──
        // Any response (skip, text, or media) → just record and let AI call create_rescue_request
        if (state.pendingAction === 'describe_incident') {
            if (mediaToUse?.length) {
                // Media uploaded during DESCRIBE_INCIDENT → store as mediaUrls (not AI analysis)
                state.draftRequest.mediaUrls = [
                    ...(state.draftRequest.mediaUrls ?? []),
                    ...mediaToUse,
                ];
            }
            const skipPhrases = ['bỏ qua', 'bo qua', 'skip', 'tạo đơn ngay', 'không cần mô tả'];
            const lower = content.toLowerCase();
            const isSkipping = skipPhrases.some((p) => lower.includes(p));
            if (!isSkipping && content.length > 0 && content !== 'Bỏ qua, tạo đơn ngay') {
                // User typed a real description
                state.draftRequest.description = content;
            }
            // pendingAction stays 'describe_incident' — AI will read DESCRIBE_INCIDENT directive
            // and immediately call create_rescue_request after acknowledging
            return `${content}\n\n[System Note: Khách hàng đã phản hồi ở bước mô tả. HÃY GỌI NGAY tool create_rescue_request bằng thông tin trong bản nháp, tuyệt đối không hỏi thêm bất kỳ câu nào nữa.]`;
        }

        if (mediaToUse?.length) {
            state.draftRequest.mediaUrls = mediaToUse;
        }

        if (content.startsWith('__location_current__|')) {
            const [, addressText, latRaw, lngRaw] = content.split('|');
            const lat = Number(latRaw);
            const lng = Number(lngRaw);
            if (addressText && Number.isFinite(lat) && Number.isFinite(lng)) {
                state.draftRequest.pickupLocation = { addressText, lat, lng };
                state.pendingAction = 'confirm_create';
            }
            return `Tôi xác nhận dùng vị trí hiện tại: ${addressText}`;
        }

        if (content.startsWith('__location_other__|')) {
            const [, addressText, latRaw, lngRaw] = content.split('|');
            const lat = Number(latRaw);
            const lng = Number(lngRaw);
            if (addressText && Number.isFinite(lat) && Number.isFinite(lng)) {
                state.draftRequest.pickupLocation = { addressText, lat, lng };
                state.pendingAction = 'confirm_create';
            }
            return `Tôi chọn vị trí khác: ${addressText}`;
        }

        // ── Detect user confirming info while in confirm_create → transition to describe_incident ──
        if (state.pendingAction === 'confirm_create') {
            const lower = content.toLowerCase();
            const isConfirmation =
                lower.includes('đúng rồi') ||
                lower.includes('xác nhận') ||
                lower.includes('tạo đơn') ||
                lower.includes('tạo yêu cầu') ||
                lower === 'ok' ||
                lower === 'đồng ý' ||
                lower === 'tiếp tục';
            if (isConfirmation) {
                state.pendingAction = 'describe_incident';
                // Return a neutral message so AI doesn't re-confirm but asks for media
                return `[Khách hàng xác nhận thông tin chính xác] Hãy tiếp tục bước DESCRIBE_INCIDENT: Chỉ hỏi khách có muốn bổ sung thêm mô tả hoặc gửi ảnh/video hiện trường không. KHÔNG gọi tool create_rescue_request lúc này.`;
            }
        }

        const lower = content.toLowerCase();
        const phoneMatch = content.match(/(0\d{8,10})/);
        if (phoneMatch) {
            state.draftRequest.contactPhone = phoneMatch[1];
            state.pendingAction = 'confirm_create';
        }

        const plateMatch = content.match(/\b\d{2}[A-Z]{1,2}\d?[-.\s]?\d{4,5}\b/i);
        if (plateMatch) {
            state.draftRequest.licensePlate = plateMatch[0].replace(/\s+/g, '').toUpperCase();
        }

        if (lower.includes('màu')) {
            state.pendingAction = 'edit_field';
        }

        return content;
    }

    private buildGuidedFlowDirective(
        caller: CallerIdentity,
        conversationId: string,
    ): string | null {
        if (caller.userRole !== 'USER') return null;
        const state = this.getOrCreateGuidedState(conversationId);
        const draft = state.draftRequest;

        const missing = computeOrderedMissingFields(draft);
        const knownSnap = buildCustomerKnownSnapshot(draft);

        return `[GUIDED-FLOW]
Mục tiêu: tạo rescue request nhanh cho USER bằng auto-fill profile.
Quy tắc bắt buộc:
1) profileLoaded=true nghĩa là server đã đồng bộ hồ sơ (eager) hoặc đã có kết quả get_profile_defaults. KHÔNG cần gọi get_profile_defaults chỉ để lấy lại cùng dữ liệu; chỉ gọi khi user vừa cập nhật hồ sơ và cần refresh.
2) KHÔNG hỏi lại các trường đã có trong [CUSTOMER_KNOWN]/draft. Chỉ hỏi đúng mục trong [MISSING_FOR_ORDER] hoặc khi user muốn sửa.
3) Với vị trí, chỉ hỏi 1 câu xác nhận: "dùng vị trí hiện tại hay vị trí khác?".
3.1) Không được tự in "địa chỉ mặc định" từ profile. Chỉ nêu địa chỉ sau khi user đã xác nhận vị trí hiện tại hoặc chọn vị trí khác trên map.
4) Nếu user chưa gửi ảnh/video bằng chứng, hỏi thêm 1 lần (không ép).
5) Trước khi gọi create_rescue_request, luôn recap thông tin và yêu cầu user xác nhận rõ ràng.
6) Chỉ gọi create_rescue_request sau khi user xác nhận.
7) Khi gọi create_rescue_request, ưu tiên pickupLocation object (addressText, lat, lng).
8) TUYỆT ĐỐI không tự suy đoán/bịa địa chỉ cụ thể. Nếu chưa có pickupLocation xác thực thì phải yêu cầu user chọn vị trí hiện tại hoặc nhập vị trí khác qua map.
9) Không được trả lời một địa chỉ đầy đủ (số nhà, đường, quận, thành phố) trừ khi địa chỉ đó đã có trong GuidedState draftRequest.pickupLocation.

GuidedState:
${JSON.stringify(
            {
                profileLoaded: state.profileLoaded,
                pendingAction: state.pendingAction || null,
                draftRequest: draft,
            },
            null,
            2,
        )}

${formatCustomerKnownDirective(knownSnap)}

${formatMissingFieldsDirective(missing)}`;
    }

    private buildCtaStateDirective(
        caller: CallerIdentity,
        conversationId: string,
    ): string | null {
        if (caller.userRole !== 'USER') return null;
        const state = this.getOrCreateGuidedState(conversationId);
        const phase = inferPromptCtaPhaseForUserMessage({
            profileLoaded: state.profileLoaded,
            pendingAction: state.pendingAction,
            draftRequest: state.draftRequest,
            requestCreated: state.requestCreated,
            complaintDraft: state.complaintDraft,
            walletTopup: state.walletTopup,
            withdrawalDraft: state.withdrawalDraft,
        });
        return formatCtaStateDirective(phase);
    }

    private async processAIResponse(
        caller: CallerIdentity,
        conversationId: string,
        existingMessages: Array<{ role: string; content: string; toolCalls?: unknown; toolResults?: unknown; imageUrls?: string[] }>,
        userContent: string,
        imageUrls: string[] | undefined,
        subject: Subject<ChatbotStreamEvent>,
    ) {
        const systemPrompt = this.getSystemPrompt(caller.userRole);
        const tools = this.getTools(caller.userRole);

        const ctaDirective = this.buildCtaDirective(existingMessages, caller.userRole);
        const guidedDirective = this.buildGuidedFlowDirective(caller, conversationId);
        const ctaStateDirective = this.buildCtaStateDirective(caller, conversationId);
        const fullSystemPrompt = [
            systemPrompt,
            ctaDirective,
            guidedDirective,
            ctaStateDirective,
        ]
            .filter(Boolean)
            .join('\n\n');

        const messages: ChatCompletionMessageParam[] = [
            { role: 'system', content: fullSystemPrompt },
        ];

        for (const msg of existingMessages) {
            if (msg.role === 'USER') {
                messages.push({ role: 'user', content: msg.content });
            } else if (msg.role === 'ASSISTANT') {
                messages.push({ role: 'assistant', content: msg.content });
            } else if (msg.role === 'TOOL' && msg.toolCalls && msg.toolResults) {
                const calls = msg.toolCalls as Array<{ id: string; name: string; arguments: string }>;
                const results = msg.toolResults as Array<{ callId: string; result: string }>;

                messages.push({
                    role: 'assistant',
                    content: msg.content || null,
                    tool_calls: calls.map((c) => ({
                        id: c.id,
                        type: 'function',
                        function: {
                            name: c.name,
                            arguments: c.arguments,
                        },
                    })),
                });

                for (const r of results) {
                    messages.push({
                        role: 'tool',
                        tool_call_id: r.callId,
                        content: r.result,
                    });
                }
            }
        }

        if (imageUrls && imageUrls.length > 0) {
            const parts: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
                { type: 'text', text: userContent },
            ];
            
            for (const url of imageUrls) {
                // Determine if it's a video based on common extensions in the URL
                const isVideo = url.match(/\.(mp4|mov|webm)$/i);
                if (isVideo) {
                    (parts[0] as { type: 'text'; text: string }).text += `\n[System Note: Người dùng đính kèm một video tại link sau: ${url}]`;
                } else {
                    parts.push({
                        type: 'image_url' as const,
                        image_url: { url },
                    });
                }
            }
            messages.push({ role: 'user', content: parts });
        } else {
            messages.push({ role: 'user', content: userContent });
        }

        await this.streamWithToolLoop(
            caller,
            conversationId,
            messages,
            tools,
            imageUrls,
            subject,
        );
    }

    private async streamWithToolLoop(
        caller: CallerIdentity,
        conversationId: string,
        messages: ChatCompletionMessageParam[],
        tools: ChatCompletionTool[],
        imageUrls: string[] | undefined,
        subject: Subject<ChatbotStreamEvent>,
        depth = 0,
    ) {
        if (depth > 3) {
            subject.next({ type: 'done', ctaPhase: 'GENERAL' });
            subject.complete();
            return;
        }

        const stream = await this.openaiService.chatCompletionStream(messages, tools);

        let fullContent = '';
        const toolCalls: Array<{
            id: string;
            name: string;
            arguments: string;
        }> = [];
        const toolCallBuffers = new Map<number, { id: string; name: string; arguments: string }>();

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;
            if (!delta) continue;

            if (delta.content) {
                fullContent += delta.content;
                subject.next({ type: 'delta', content: delta.content });
            }

            if (delta.tool_calls) {
                for (const tc of delta.tool_calls) {
                    if (!toolCallBuffers.has(tc.index)) {
                        toolCallBuffers.set(tc.index, {
                            id: tc.id || '',
                            name: tc.function?.name || '',
                            arguments: '',
                        });
                    }
                    const buf = toolCallBuffers.get(tc.index)!;
                    if (tc.id) buf.id = tc.id;
                    if (tc.function?.name) buf.name = tc.function.name;
                    if (tc.function?.arguments) buf.arguments += tc.function.arguments;
                }
            }
        }

        for (const [, buf] of toolCallBuffers) {
            toolCalls.push(buf);
        }

        if (toolCalls.length > 0) {
            messages.push({
                role: 'assistant',
                content: fullContent || null,
                tool_calls: toolCalls.map((tc) => ({
                    id: tc.id,
                    type: 'function' as const,
                    function: { name: tc.name, arguments: tc.arguments },
                })),
            });

            const toolResultsForDb: Array<{ callId: string; name: string; result: string }> = [];

            for (const tc of toolCalls) {
                subject.next({ type: 'tool_start', toolName: tc.name });

                let args: Record<string, unknown> = {};
                try {
                    args = JSON.parse(tc.arguments || '{}');
                } catch {
                    args = {};
                }

                const result = await this.toolExecutor.executeTool(tc.name, args, {
                    userId: caller.userId,
                    guestSessionId: caller.guestSessionId,
                    userRole: caller.userRole,
                    imageUrls,
                });

                toolResultsForDb.push({ callId: tc.id, name: tc.name, result });

                if (caller.userRole === 'USER') {
                    this.updateGuidedStateFromTool(conversationId, tc.name, args, result);
                    await this.persistGuidedStateToDb(conversationId);
                }

                if (tc.name === 'create_rescue_request') {
                    try {
                        const parsed = JSON.parse(result) as {
                            success?: boolean;
                            request?: { id?: string };
                        };
                        if (parsed.success && parsed.request?.id) {
                            subject.next({
                                type: 'action',
                                action: 'redirect_request_detail',
                                payload: { requestId: parsed.request.id },
                            });
                        }
                    } catch {
                        // no-op
                    }
                }

                if (tc.name === 'open_complaint') {
                    try {
                        const parsed = JSON.parse(result) as {
                            success?: boolean;
                            disputeId?: string;
                        };
                        if (parsed.success && parsed.disputeId) {
                            subject.next({
                                type: 'action',
                                action: 'navigate_to_dispute',
                                payload: { disputeId: parsed.disputeId },
                            });
                        }
                    } catch {
                        // no-op
                    }
                }

                if (tc.name === 'check_topup_status') {
                    try {
                        const parsed = JSON.parse(result) as { status?: string };
                        if (parsed.status === 'COMPLETED' || parsed.status === 'EXPIRED') {
                            subject.next({ type: 'action', action: 'topup_completed', payload: { status: parsed.status } });
                        }
                    } catch {
                        // no-op
                    }
                }

                if (tc.name === 'initiate_topup') {
                    try {
                        const parsed = JSON.parse(result) as {
                            success?: boolean;
                            topupTxId?: string;
                            qrUrl?: string;
                            amount?: number;
                            bankAccount?: string;
                            bankCode?: string;
                            transferCode?: string;
                            expireAt?: string;
                        };
                        if (parsed.success && parsed.topupTxId && parsed.qrUrl) {
                            subject.next({
                                type: 'action',
                                action: 'show_topup_qr',
                                payload: {
                                    topupTxId: parsed.topupTxId,
                                    qrUrl: parsed.qrUrl,
                                    amount: parsed.amount,
                                    bankAccount: parsed.bankAccount,
                                    bankCode: parsed.bankCode,
                                    transferCode: parsed.transferCode,
                                    expireAt: parsed.expireAt,
                                },
                            });
                        }
                    } catch {
                        // no-op
                    }
                }

                messages.push({
                    role: 'tool',
                    tool_call_id: tc.id,
                    content: result,
                });

                subject.next({ type: 'tool_end', toolName: tc.name });
            }

            await this.prisma.chatbotMessage.create({
                data: {
                    conversationId,
                    role: 'TOOL',
                    content: fullContent,
                    toolCalls: toolCalls.map((tc) => ({
                        id: tc.id,
                        name: tc.name,
                        arguments: tc.arguments,
                    })),
                    toolResults: toolResultsForDb,
                },
            });

            await this.streamWithToolLoop(
                caller,
                conversationId,
                messages,
                tools,
                imageUrls,
                subject,
                depth + 1,
            );
        } else {
            // ── 1. Extract model-declared state before any processing ──
            const modelState = extractModelState(fullContent);

            // ── 2. Strip the hidden tag so it never reaches DB or UI ──
            const strippedContent = stripModelStateTag(fullContent);

            // ── 3. Optional CTA appendage (runs on clean text) ──
            const displayContent =
                caller.userRole === 'USER'
                    ? this.ensureCustomerCta(strippedContent, conversationId)
                    : strippedContent;

            // ── 4. Compute CTA phase — model state takes priority ──
            const guidedForCta = this.getOrCreateGuidedState(conversationId);
            const ctaPhase =
                caller.userRole === 'USER'
                    ? computeCustomerCtaPhase(
                          displayContent,
                          {
                              profileLoaded: guidedForCta.profileLoaded,
                              pendingAction: guidedForCta.pendingAction,
                              draftRequest: guidedForCta.draftRequest,
                              requestCreated: guidedForCta.requestCreated,
                              complaintDraft: guidedForCta.complaintDraft,
                              walletTopup: guidedForCta.walletTopup,
                              withdrawalDraft: guidedForCta.withdrawalDraft,
                          },
                          caller.userRole,
                          modelState,
                      )
                    : ('GENERAL' as CustomerCtaPhase);

            if (modelState) {
                this.logger.debug(
                    `[CTA] conv=${conversationId} model_state=${modelState} → phase=${ctaPhase}`,
                );
            }

            await this.prisma.chatbotMessage.create({
                data: {
                    conversationId,
                    role: 'ASSISTANT',
                    content: displayContent,
                    metadata:
                        caller.userRole === 'USER' ? { ctaPhase } : undefined,
                },
            });

            await this.prisma.chatbotConversation.update({
                where: { id: conversationId },
                data: { updatedAt: new Date() },
            });

            if (caller.userRole === 'USER') {
                // Sync pendingAction from model-declared state for cross-turn persistence.
                // This lets the normalizer intercept the user's next confirmation message.
                if (modelState === 'WITHDRAWAL_CONFIRM') {
                    const guidedSync = this.getOrCreateGuidedState(conversationId);
                    if (guidedSync.pendingAction !== 'wallet_withdrawal_confirm') {
                        guidedSync.pendingAction = 'wallet_withdrawal_confirm';
                    }
                }
                await this.persistGuidedStateToDb(conversationId);
            }

            subject.next({ type: 'done', ctaPhase });
            subject.complete();
        }
    }

    private hasActionableCta(text: string): boolean {
        const lower = text.toLowerCase();
        return (
            lower.includes('anh/chị muốn') ||
            lower.includes('muốn em') ||
            lower.includes('tạo yêu cầu cứu hộ') ||
            lower.includes('xác nhận tạo đơn') ||
            lower.includes('hành động đề xuất')
        );
    }

    private ensureCustomerCta(text: string, conversationId: string): string {
        if (!text || this.hasActionableCta(text)) return text;
        const lower = text.toLowerCase();
        if (assistantTextImpliesConfirmRecap(lower)) return text;
        const state = this.getOrCreateGuidedState(conversationId);
        // Never append generic CTA during describe_incident — AI handles create directly
        if (state.pendingAction === 'describe_incident') return text;
        if (
            state.pendingAction === 'confirm_create' &&
            state.draftRequest.pickupLocation &&
            state.draftRequest.contactPhone
        ) {
            return text;
        }

        if (
            lower.includes('lốp') ||
            lower.includes('ắc quy') ||
            lower.includes('hết xăng') ||
            lower.includes('chết máy') ||
            lower.includes('tai nạn') ||
            lower.includes('sự cố')
        ) {
            return `${text}\n\nHành động đề xuất: Anh/chị muốn em tạo yêu cầu cứu hộ ngay bây giờ không ạ?`;
        }

        if (lower.includes('khiếu nại')) {
            return `${text}\n\nHành động đề xuất: Anh/chị muốn em hướng dẫn mở khiếu nại theo từng bước ngay bây giờ không ạ?`;
        }

        if (lower.includes('đơn') || lower.includes('trạng thái')) {
            return `${text}\n\nHành động đề xuất: Anh/chị muốn em kiểm tra trạng thái đơn gần nhất giúp luôn không ạ?`;
        }

        if (lower.includes('ví') || lower.includes('wallet') || lower.includes('nạp')) {
            return `${text}\n\nHành động đề xuất: Anh/chị muốn em hướng dẫn thao tác nạp ví nhanh trong 1 phút không ạ?`;
        }

        return text;
    }

    private updateGuidedStateFromTool(
        conversationId: string,
        toolName: string,
        args: Record<string, unknown>,
        rawResult: string,
    ) {
        const state = this.getOrCreateGuidedState(conversationId);
        if (toolName === 'get_profile_defaults') {
            try {
                const profile = JSON.parse(rawResult) as {
                    error?: string;
                    contactPhone?: string | null;
                    defaultVehicle?: { type?: string | null; licensePlate?: string | null; color?: string | null };
                };
                if (profile?.error) return;
                this.mergeProfileDefaultsIntoState(state, {
                    contactPhone: profile.contactPhone,
                    defaultVehicle: profile.defaultVehicle,
                });
            } catch {
                // no-op
            }
            return;
        }

        if (toolName === 'create_rescue_request') {
            state.pendingAction = undefined;
            try {
                const result = JSON.parse(rawResult) as { success?: boolean };
                if (result.success) {
                    state.draftRequest = {};
                    state.requestCreated = true;
                }
            } catch {
                // no-op
            }
            return;
        }

        if (toolName === 'lookup_order_for_complaint') {
            try {
                const result = JSON.parse(rawResult) as {
                    success?: boolean;
                    requestId?: string;
                    paymentId?: string;
                    orderCode?: string;
                    maxDisputeAmount?: number;
                };
                if (result.success && result.requestId && result.paymentId) {
                    state.complaintDraft = {
                        requestId: result.requestId,
                        paymentId: result.paymentId,
                        orderCode: result.orderCode,
                        maxDisputeAmount: result.maxDisputeAmount,
                    };
                    state.pendingAction = 'complaint_confirm';
                }
            } catch {
                // no-op
            }
            return;
        }

        if (toolName === 'open_complaint') {
            try {
                const result = JSON.parse(rawResult) as { success?: boolean };
                if (result.success) {
                    state.complaintDraft = undefined;
                    state.pendingAction = undefined;
                }
            } catch {
                // no-op
            }
            return;
        }

        if (toolName === 'initiate_topup') {
            try {
                const result = JSON.parse(rawResult) as {
                    success?: boolean;
                    topupTxId?: string;
                    amount?: number;
                };
                if (result.success && result.topupTxId) {
                    state.walletTopup = {
                        topupTxId: result.topupTxId,
                        amount: result.amount ?? (args.amount as number) ?? 0,
                    };
                }
            } catch {
                // no-op
            }
            return;
        }

        if (toolName === 'check_topup_status') {
            try {
                const result = JSON.parse(rawResult) as { status?: string };
                if (result.status === 'COMPLETED' || result.status === 'CANCELLED') {
                    state.walletTopup = undefined;
                }
            } catch {
                // no-op
            }
            return;
        }

        if (toolName === 'initiate_withdrawal') {
            try {
                const result = JSON.parse(rawResult) as { success?: boolean };
                if (result.success) {
                    state.withdrawalDraft = undefined;
                    state.pendingAction = undefined;
                }
            } catch {
                // no-op
            }
            return;
        }

        if (toolName === 'estimate_price_range') {
            return;
        }

        if (args.incidentType && typeof args.incidentType === 'string') {
            state.draftRequest.incidentType = args.incidentType;
            // Starting a new order flow — clear the post-creation flag.
            state.requestCreated = false;
        }
    }

    private getSystemPrompt(userRole: string): string {
        switch (userRole) {
            case 'PROVIDER':
                return PROVIDER_SYSTEM_PROMPT;
            case 'GUEST':
                return GUEST_SYSTEM_PROMPT;
            default:
                return CUSTOMER_SYSTEM_PROMPT;
        }
    }

    private getTools(userRole: string): ChatCompletionTool[] {
        switch (userRole) {
            case 'PROVIDER':
                return PROVIDER_TOOLS;
            case 'GUEST':
                return [];
            default:
                return CUSTOMER_TOOLS;
        }
    }

    private assertOwnership(
        caller: CallerIdentity,
        conversation: { userId: string | null; guestSessionId: string | null },
    ) {
        if (caller.guestSessionId) {
            if (conversation.guestSessionId !== caller.guestSessionId) {
                throw new ForbiddenException();
            }
        } else if (caller.userId) {
            if (conversation.userId !== caller.userId) {
                throw new ForbiddenException();
            }
        }
    }
}
