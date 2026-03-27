import {
    Injectable,
    Logger,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAIService } from './openai.service';
import { ToolExecutorService } from './tool-executor.service';
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

export interface ChatbotStreamEvent {
    type: 'delta' | 'tool_start' | 'tool_end' | 'done' | 'error' | 'action';
    content?: string;
    toolName?: string;
    action?: string;
    payload?: Record<string, unknown>;
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
    mediaUrls?: string[];
}

interface GuidedConversationState {
    profileLoaded: boolean;
    pendingAction?: 'confirm_location' | 'confirm_create' | 'edit_field';
    draftRequest: GuidedDraftRequest;
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
    ): Promise<Subject<ChatbotStreamEvent>> {
        const normalizedContent = this.normalizeUserContentForGuidedFlow(
            conversationId,
            content,
            imageUrls,
        );

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

        await this.prisma.chatbotMessage.create({
            data: {
                conversationId,
                role: 'USER',
                content: normalizedContent,
                imageUrls: imageUrls || [],
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

        this.processAIResponse(caller, conversationId, conversation.messages, normalizedContent, imageUrls, subject).catch(
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
        if (userRole === 'PROVIDER') return null;

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

    private normalizeUserContentForGuidedFlow(
        conversationId: string,
        rawContent: string,
        imageUrls?: string[],
    ): string {
        const state = this.getOrCreateGuidedState(conversationId);
        const content = rawContent.trim();

        if (imageUrls?.length) {
            state.draftRequest.mediaUrls = imageUrls;
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

        return `[GUIDED-FLOW]
Mục tiêu: tạo rescue request nhanh cho USER bằng auto-fill profile.
Quy tắc bắt buộc:
1) Nếu chưa có profileLoaded=true, hãy gọi tool get_profile_defaults.
2) KHÔNG hỏi lại các trường đã có trong draft/profile. Chỉ hỏi thiếu hoặc khi user muốn sửa.
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
        )}`;
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
        const fullSystemPrompt = ctaDirective
            ? `${systemPrompt}\n\n${ctaDirective}${guidedDirective ? `\n\n${guidedDirective}` : ''}`
            : guidedDirective
              ? `${systemPrompt}\n\n${guidedDirective}`
            : systemPrompt;

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
            subject.next({ type: 'done' });
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
            await this.prisma.chatbotMessage.create({
                data: {
                    conversationId,
                    role: 'ASSISTANT',
                    content: fullContent,
                },
            });

            await this.prisma.chatbotConversation.update({
                where: { id: conversationId },
                data: { updatedAt: new Date() },
            });

            subject.next({ type: 'done' });
            subject.complete();
        }
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
                    contactPhone?: string | null;
                    defaultVehicle?: { type?: string | null; licensePlate?: string | null; color?: string | null };
                };
                state.profileLoaded = true;
                if (profile.contactPhone) state.draftRequest.contactPhone = profile.contactPhone;
                if (profile.defaultVehicle?.type) state.draftRequest.vehicleType = profile.defaultVehicle.type;
                if (profile.defaultVehicle?.licensePlate) state.draftRequest.licensePlate = profile.defaultVehicle.licensePlate;
                if (profile.defaultVehicle?.color) state.draftRequest.vehicleColor = profile.defaultVehicle.color;
                state.pendingAction = 'confirm_location';
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
                }
            } catch {
                // no-op
            }
            return;
        }

        if (toolName === 'create_rescue_request' || toolName === 'estimate_price_range') {
            return;
        }

        if (args.incidentType && typeof args.incidentType === 'string') {
            state.draftRequest.incidentType = args.incidentType;
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
                return CUSTOMER_TOOLS;
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
