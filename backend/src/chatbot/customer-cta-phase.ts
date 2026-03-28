/**
 * Customer chatbot UI CTA phase — aligned with frontend chip groups.
 * Used by ChatbotService and scenario/unit checks.
 */
export type CustomerCtaPhase =
    | 'SELECT_ISSUE'
    | 'ENTER_INFO'
    | 'CONFIRM_INFO'
    | 'CREATE_REQUEST'
    | 'LOCATION_CHOICE'
    | 'DESCRIBE_INCIDENT'
    | 'GENERAL';

/** Valid CustomerCtaPhase values for runtime validation. */
const VALID_CTA_PHASES = new Set<CustomerCtaPhase>([
    'SELECT_ISSUE', 'ENTER_INFO', 'CONFIRM_INFO', 'CREATE_REQUEST', 'LOCATION_CHOICE', 'DESCRIBE_INCIDENT', 'GENERAL',
]);

/** The hidden tag the model appends, e.g. <!--STATE:{"s":"CONFIRM_INFO"}--> or <!--STATE:CONFIRM_INFO--> */
const STATE_TAG_RE = /<!--STATE:(?:\{"s":"([A-Z_]+)"\}|([A-Z_]+))-->/;

/**
 * Extracts the model-declared CTA phase from the assistant text.
 * Returns null if the tag is absent or contains an invalid phase.
 */
export function extractModelState(text: string): CustomerCtaPhase | null {
    if (!text) return null;
    const match = STATE_TAG_RE.exec(text);
    if (!match) return null;
    const candidate = (match[1] || match[2]) as CustomerCtaPhase;
    return VALID_CTA_PHASES.has(candidate) ? candidate : null;
}

/**
 * Removes the hidden state tag (and any surrounding whitespace on that line)
 * so the tag never appears in the stored content or UI.
 */
export function stripModelStateTag(text: string): string {
    if (!text) return text;
    return text.replace(/\n?<!--STATE:(?:\{"s":"[A-Z_]+"\}|[A-Z_]+)-->\n?/, '\n').trimEnd();
}

export function assistantTextImpliesConfirmRecap(lower: string): boolean {
    if (lower.includes('xác nhận lại thông tin')) return true;
    if (lower.includes('vui lòng xác nhận')) return true;
    if (lower.includes('xác nhận giúp em') && (lower.includes('thông tin') || lower.includes('đơn'))) return true;
    if (lower.includes('thông tin trên') && lower.includes('xác nhận')) return true;
    if (
        lower.includes('xác nhận') &&
        lower.includes('thông tin') &&
        (lower.includes('tóm tắt') || lower.includes('sau đó em') || lower.includes('tiến hành tạo'))
    ) {
        return true;
    }
    if (lower.includes('trước khi em') && (lower.includes('tạo') || lower.includes('thi'))) return true;
    if (/\d+\.\s*\*?\*?loại sự cố/i.test(lower) && lower.includes('xác nhận')) return true;
    return false;
}

export function assistantTextImpliesLocationChoice(lower: string): boolean {
    if (lower.includes('đã ghi nhận vị trí') || lower.includes('đã xác nhận vị trí')) return false;
    if (lower.includes('chúng ta sẽ dùng vị trí hiện tại')) return false;
    const hasLoc =
        lower.includes('vị trí hiện tại') ||
        lower.includes('vị trí khác') ||
        lower.includes('chọn vị trí');
    const asks =
        lower.includes('chọn') ||
        lower.includes('hay') ||
        lower.includes('hay là') ||
        lower.includes('?');
    return hasLoc && asks;
}

export function assistantTextImpliesCreateRequest(lower: string): boolean {
    if (assistantTextImpliesConfirmRecap(lower)) return false;
    const createCue =
        lower.includes('tạo yêu cầu cứu hộ') ||
        lower.includes('tạo đơn cứu hộ') ||
        lower.includes('tạo đơn');
    if (!createCue) return false;
    return (
        lower.includes('bấm') ||
        lower.includes('nhấn') ||
        lower.includes('chọn') ||
        lower.includes('ngay bây giờ') ||
        lower.includes('sẵn sàng')
    );
}

export function assistantTextImpliesSelectIssue(lower: string): boolean {
    if (assistantTextImpliesConfirmRecap(lower)) return false;
    if (assistantTextImpliesLocationChoice(lower)) return false;
    const asksIncident =
        (lower.includes('loại sự cố') &&
            (lower.includes('?') ||
                lower.includes('là gì') ||
                lower.includes('đang gặp') ||
                lower.includes('là như thế nào'))) ||
        lower.includes('đang gặp phải là gì') ||
        (lower.includes('ví dụ: xe hỏng') && lower.includes('?')) ||
        (lower.includes('tai nạn') && lower.includes('v.v') && lower.includes('?'));
    return asksIncident;
}

export function assistantTextImpliesEnterInfo(lower: string): boolean {
    if (assistantTextImpliesConfirmRecap(lower)) return false;
    if (assistantTextImpliesSelectIssue(lower)) return false;
    if (assistantTextImpliesLocationChoice(lower)) return false;
    return (
        (lower.includes('loại xe') && (lower.includes('?') || lower.includes('ô tô') || lower.includes('xe máy'))) ||
        (lower.includes('số điện thoại') && (lower.includes('?') || lower.includes('liên hệ'))) ||
        (lower.includes('biển số') && (lower.includes('?') || lower.includes('cho em'))) ||
        (lower.includes('màu xe') && lower.includes('?'))
    );
}

export interface GuidedDraftLike {
    incidentType?: string;
    vehicleType?: string;
    contactPhone?: string;
    pickupLocation?: unknown;
}

export interface GuidedStateLike {
    profileLoaded: boolean;
    pendingAction?: 'confirm_location' | 'confirm_create' | 'edit_field' | 'describe_incident';
    draftRequest: GuidedDraftLike;
}

export function computeCustomerCtaPhase(
    assistantPlainText: string,
    state: GuidedStateLike,
    userRole: string,
    modelState?: CustomerCtaPhase | null,
): CustomerCtaPhase {
    if (userRole !== 'USER') return 'GENERAL';

    // ── Primary signal: model-declared state ──
    if (modelState) return modelState;

    // ── Fallback: regex / keyword detection on text ──
    const lower = assistantPlainText.toLowerCase();

    if (assistantTextImpliesConfirmRecap(lower)) return 'CONFIRM_INFO';
    if (assistantTextImpliesLocationChoice(lower)) return 'LOCATION_CHOICE';
    if (assistantTextImpliesCreateRequest(lower)) return 'CREATE_REQUEST';
    if (assistantTextImpliesSelectIssue(lower)) return 'SELECT_ISSUE';
    if (assistantTextImpliesEnterInfo(lower)) return 'ENTER_INFO';

    // ── Final fallback: guided state ──
    const d = state.draftRequest;
    if (state.pendingAction === 'describe_incident') return 'DESCRIBE_INCIDENT';
    if (state.pendingAction === 'confirm_create' && d.pickupLocation && d.contactPhone) {
        return 'CONFIRM_INFO';
    }
    if (state.pendingAction === 'confirm_location') {
        return 'LOCATION_CHOICE';
    }
    if (!d.incidentType && state.profileLoaded) {
        return 'SELECT_ISSUE';
    }
    if (state.profileLoaded && !d.pickupLocation) {
        return 'LOCATION_CHOICE';
    }
    return 'GENERAL';
}

/** Phase hint for system prompt before the model replies (after user message, guided state updated). */
export function inferPromptCtaPhaseForUserMessage(state: GuidedStateLike): CustomerCtaPhase {
    const d = state.draftRequest;
    if (state.pendingAction === 'describe_incident') return 'DESCRIBE_INCIDENT';
    if (state.pendingAction === 'confirm_location') return 'LOCATION_CHOICE';
    if (state.pendingAction === 'confirm_create' && d.pickupLocation && d.contactPhone) {
        return 'CONFIRM_INFO';
    }
    if (state.pendingAction === 'edit_field') return 'ENTER_INFO';
    if (!d.incidentType && state.profileLoaded) return 'SELECT_ISSUE';
    if (!d.vehicleType || !d.contactPhone) return 'ENTER_INFO';
    if (state.profileLoaded && !d.pickupLocation) return 'LOCATION_CHOICE';
    if (!d.pickupLocation) return 'LOCATION_CHOICE';
    return 'GENERAL';
}

export function formatCtaStateDirective(phase: CustomerCtaPhase): string {
    const hints: Record<CustomerCtaPhase, string> = {
        SELECT_ISSUE:
            'Lượt này hệ thống đang ở SELECT_ISSUE. Trong luồng tạo đơn: chỉ dẫn khách chọn loại sự cố (hỏng xe, hết bình, nổ lốp…). TUYỆT ĐỐI KHÔNG yêu cầu xác nhận tổng hợp toàn bộ đơn cùng lúc và KHÔNG mô tả CTA kiểu xác nhận đơn.',
        ENTER_INFO:
            'Lượt này hệ thống đang ở ENTER_INFO. Chỉ hỏi đúng các trường còn thiếu trong [MISSING_FOR_ORDER] (ưu tiên 1 trường hoặc cùng lắm gộp nhẹ theo danh sách đó). CẤM liệt kê template 4–5 câu hỏi khi chỉ thiếu một mục. CẤM hỏi lại trường đã có trong [CUSTOMER_KNOWN]. KHÔNG đề xuất danh sách loại sự cố như bước đầu.',
        CONFIRM_INFO:
            'Lượt này hệ thống đang ở CONFIRM_INFO. Chỉ tóm tắt và xin xác nhận. KHÔNG đề xuất chip/nút loại sự cố. Người dùng chỉ cần Xác nhận hoặc Thay đổi thông tin.',
        CREATE_REQUEST:
            'Lượt này hệ thống đang ở CREATE_REQUEST. Một hành động tạo yêu cầu cứu hộ. Không lặp danh sách sự cố.',
        LOCATION_CHOICE:
            'Lượt này hệ thống đang ở LOCATION_CHOICE. Chỉ hỏi vị trí hiện tại hay chọn trên bản đồ. Không gộp thêm danh sách loại sự cố.',
        DESCRIBE_INCIDENT:
            'Lượt này hệ thống đang ở DESCRIBE_INCIDENT. Hỏi thêm mô tả sự cố và ảnh/video một cách nhẹ nhàng — KHÔNG BẮT BUỘC. KHÔNG hỏi lại bất kỳ thông tin nào đã xác nhận (loại xe, SĐT, vị trí…). Sau khi nhận BẤT KỲ phản hồi nào của user (kể cả "bỏ qua" hay im lặng bằng nút CTA), GỌI NGAY tool create_rescue_request với toàn bộ thông tin trong draftRequest, kèm description/mediaUrls nếu user có cung cấp. TUYỆT ĐỐI không hỏi xác nhận thêm lần nào nữa.',
        GENERAL:
            'Ngoài luồng tạo đơn có cấu trúc: trả lời tự nhiên; có thể một câu hành động gợi ý ở cuối nếu phù hợp. Không mô tả sai nhóm CTA với bước guided.',
    };
    return `[CTA-STATE] ${hints[phase]}`;
}
