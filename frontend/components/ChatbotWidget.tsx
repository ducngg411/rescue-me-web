'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useGuest } from '@/contexts/GuestContext';
import { useChatbot, ChatbotMessage, type CustomerCtaPhase } from '@/lib/hooks/useChatbot';
import { uploadFile, UploadPurpose } from '@/lib/upload';
import LocationPicker from '@/components/LocationPicker';
import { reverseGeocode } from '@/lib/vietmap';

const C = {
    orange: '#f97316',
    orangeDark: '#ea6c0a',
    orangeLight: '#fff7ed',
    navy: '#1a1a2e',
    gray: '#6b7280',
    grayLight: '#94a3b8',
    border: '#f1f5f9',
    bg: '#f8fafc',
    green: '#22c55e',
    greenBg: '#f0fdf4',
    yellow: '#eab308',
    yellowBg: '#fefce8',
    red: '#ef4444',
    redBg: '#fef2f2',
};

const TOOL_LABELS: Record<string, string> = {
    get_my_requests: 'Đang tra cứu đơn cứu hộ...',
    get_request_status: 'Đang kiểm tra trạng thái đơn...',
    get_wallet_balance: 'Đang kiểm tra ví...',
    analyze_vehicle_image: 'Đang phân tích ảnh sự cố...',
    get_incident_types: 'Đang lấy danh sách sự cố...',
    get_my_earnings: 'Đang tra cứu thu nhập...',
    get_active_request: 'Đang kiểm tra đơn đang xử lý...',
    get_verification_guide: 'Đang kiểm tra trạng thái xác minh...',
    create_rescue_request: 'Đang tạo yêu cầu cứu hộ...',
    estimate_price_range: 'Đang ước tính giá dịch vụ...',
};

function formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

type RiskLevel = 'safe' | 'warning' | 'critical' | null;
type RescueLocationData = { addressText: string; lat: number; lng: number };

function detectRiskLevel(content: string): RiskLevel {
    if (!content) return null;
    if (content.includes('🔴') || content.includes('Khẩn cấp')) return 'critical';
    if (content.includes('🟡') || content.includes('Cần xử lý sớm')) return 'warning';
    if (content.includes('🟢') || content.includes('An toàn')) return 'safe';
    return null;
}

type CustomerCtaUiKind =
    | 'none'
    | 'confirm'
    | 'location'
    | 'incident'
    | 'enterInfo'
    | 'createRequest'
    | 'describeIncident'
    | 'generic';

/** Fallback when server did not send ctaPhase — keep in sync with backend customer-cta-phase.ts */
function looksLikeConfirmRecapStep(content: string): boolean {
    const lower = content.toLowerCase();
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

function looksLikeLocationChoiceStep(content: string): boolean {
    if (!content) return false;
    const lower = content.toLowerCase();
    if (lower.includes('đã ghi nhận vị trí') || lower.includes('đã xác nhận vị trí')) return false;
    if (lower.includes('chúng ta sẽ dùng vị trí hiện tại')) return false;
    const hasLoc =
        lower.includes('vị trí hiện tại') ||
        lower.includes('vị trí khác') ||
        lower.includes('chọn vị trí');
    const asks =
        lower.includes('chọn') || lower.includes('hay') || lower.includes('hay là') || lower.includes('?');
    return hasLoc && asks;
}

function looksLikeSelectIssueStep(content: string): boolean {
    if (!content || looksLikeConfirmRecapStep(content)) return false;
    if (looksLikeLocationChoiceStep(content)) return false;
    const lower = content.toLowerCase();
    return (
        (lower.includes('loại sự cố') &&
            (lower.includes('?') ||
                lower.includes('là gì') ||
                lower.includes('đang gặp') ||
                lower.includes('là như thế nào'))) ||
        lower.includes('đang gặp phải là gì') ||
        (lower.includes('ví dụ: xe hỏng') && lower.includes('?')) ||
        (lower.includes('tai nạn') && lower.includes('v.v') && lower.includes('?'))
    );
}

function looksLikeEnterInfoStep(content: string): boolean {
    if (!content || looksLikeConfirmRecapStep(content)) return false;
    if (looksLikeLocationChoiceStep(content)) return false;
    const lower = content.toLowerCase();
    if (
        lower.includes('loại sự cố') &&
        (lower.includes('?') || lower.includes('là gì') || lower.includes('đang gặp'))
    ) {
        return false;
    }
    return (
        (lower.includes('loại xe') && (lower.includes('?') || lower.includes('ô tô') || lower.includes('xe máy'))) ||
        (lower.includes('số điện thoại') && (lower.includes('?') || lower.includes('liên hệ'))) ||
        (lower.includes('biển số') && (lower.includes('?') || lower.includes('cho em'))) ||
        (lower.includes('màu xe') && lower.includes('?'))
    );
}

function looksLikeCreateRequestStep(content: string): boolean {
    if (!content || looksLikeConfirmRecapStep(content)) return false;
    const lower = content.toLowerCase();
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

function detectShouldShowCta(content: string, isLastAssistant: boolean): boolean {
    if (!isLastAssistant || !content) return false;
    if (looksLikeConfirmRecapStep(content)) return false;
    const lower = content.toLowerCase();
    const hasIncidentMention =
        lower.includes('sự cố') ||
        lower.includes('hỏng') ||
        lower.includes('xẹp lốp') ||
        lower.includes('chết máy') ||
        lower.includes('tai nạn') ||
        lower.includes('ắc quy') ||
        lower.includes('hết xăng') ||
        lower.includes('ngập nước');
    const hasRisk = content.includes('🔴') || content.includes('🟡');
    const alreadyHasCta = lower.includes('tạo yêu cầu cứu hộ') || lower.includes('tạo đơn');
    return (hasIncidentMention || hasRisk) && !alreadyHasCta;
}

function looksLikeDescribeIncidentStep(content: string): boolean {
    if (!content) return false;
    if (looksLikeConfirmRecapStep(content)) return false;
    const lower = content.toLowerCase();
    
    // Check if it's asking for description/media
    const hasMediaKeywords = /(mô tả|diễn tả|mô tả thêm|chi tiết thêm|hiện trường|ảnh hiện trường|video hiện trường)/i.test(lower);
    const hasQuestionKeywords = lower.includes('muốn') || lower.includes('có thể') || lower.includes('có muốn') || lower.includes('cho em xin') || lower.includes('gửi giúp') || lower.includes('bỏ qua');
    
    return hasMediaKeywords && hasQuestionKeywords;
}

function resolveCustomerCtaUi(
    content: string,
    isLastAssistant: boolean,
    ctaPhase: CustomerCtaPhase | null | undefined,
    allowStructuredCustomerCta: boolean,
): CustomerCtaUiKind {
    if (!allowStructuredCustomerCta || !isLastAssistant || !content) return 'none';

    if (ctaPhase && ctaPhase !== 'GENERAL') {
        switch (ctaPhase) {
            case 'CONFIRM_INFO':
                return 'confirm';
            case 'LOCATION_CHOICE':
                return 'location';
            case 'SELECT_ISSUE':
                return 'incident';
            case 'ENTER_INFO':
                return 'enterInfo';
            case 'CREATE_REQUEST':
                return 'createRequest';
            case 'DESCRIBE_INCIDENT':
                return 'describeIncident';
            default:
                break;
        }
    }

    if (looksLikeConfirmRecapStep(content)) return 'confirm';
    if (looksLikeDescribeIncidentStep(content)) return 'describeIncident';
    if (looksLikeLocationChoiceStep(content)) return 'location';
    if (looksLikeCreateRequestStep(content)) return 'createRequest';
    if (looksLikeSelectIssueStep(content)) return 'incident';
    if (looksLikeEnterInfoStep(content)) return 'enterInfo';

    if (ctaPhase === 'GENERAL' || ctaPhase === null || ctaPhase === undefined) {
        if (detectShouldShowCta(content, true)) return 'generic';
    }
    return 'none';
}

function RiskBadge({ level }: { level: RiskLevel }) {
    if (!level) return null;
    const config = {
        safe: { label: 'An toàn', bg: C.greenBg, color: C.green, border: '#bbf7d0' },
        warning: { label: 'Cần xử lý sớm', bg: C.yellowBg, color: C.yellow, border: '#fef08a' },
        critical: { label: 'Khẩn cấp', bg: C.redBg, color: C.red, border: '#fecaca' },
    };
    const c = config[level];
    return (
        <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}
        >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />
            {c.label}
        </span>
    );
}

function MessageBubble({
    msg,
    isLastAssistant,
    onCtaClick,
    onUseCurrentLocation,
    onChooseOtherLocation,
    onOpenFileUpload,
    isSending,
    allowStructuredCustomerCta,
}: {
    msg: ChatbotMessage;
    isLastAssistant: boolean;
    onCtaClick: (text: string) => void;
    onUseCurrentLocation: () => void;
    onChooseOtherLocation: () => void;
    onOpenFileUpload: () => void;
    isSending: boolean;
    allowStructuredCustomerCta: boolean;
}) {
    const isUser = msg.role === 'USER';
    const riskLevel = !isUser ? detectRiskLevel(msg.content) : null;
    const ctaKind: CustomerCtaUiKind =
        !isUser && !msg.isStreaming
            ? resolveCustomerCtaUi(msg.content, isLastAssistant, msg.ctaPhase, allowStructuredCustomerCta)
            : 'none';

    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
            {!isUser && (
                <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mr-2 self-end"
                    style={{ background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})` }}
                >
                    AI
                </div>
            )}
            <div className={`max-w-[80%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                {msg.imageUrls && msg.imageUrls.length > 0 && (
                    <div className="flex gap-1.5 mb-1.5 flex-wrap">
                        {msg.imageUrls.map((url, i) => {
                            const isVideo = url.match(/\.(mp4|mov|webm)$/i);
                            return isVideo ? (
                                <video key={i} src={url} controls className="w-32 max-h-32 object-cover rounded-lg border border-gray-200" />
                            ) : (
                                <img
                                    key={i}
                                    src={url}
                                    alt="Uploaded"
                                    className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                                />
                            );
                        })}
                    </div>
                )}
                {!isUser && riskLevel && (
                    <div className="mb-1.5">
                        <RiskBadge level={riskLevel} />
                    </div>
                )}
                <div
                    className="px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                    style={{
                        background: isUser
                            ? `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`
                            : 'white',
                        color: isUser ? 'white' : C.navy,
                        borderBottomRightRadius: isUser ? '4px' : undefined,
                        borderBottomLeftRadius: !isUser ? '4px' : undefined,
                        boxShadow: isUser
                            ? `0 2px 8px ${C.orange}30`
                            : '0 1px 4px rgba(0,0,0,0.06)',
                    }}
                >
                    {msg.content}
                    {msg.isStreaming && !msg.content && (
                        <span className="inline-flex gap-1">
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                    )}
                    {msg.isStreaming && msg.content && (
                        <span className="inline-block w-1 h-4 ml-0.5 bg-gray-400 animate-pulse align-middle" />
                    )}
                </div>
                {ctaKind === 'generic' && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        <button
                            onClick={() => onCtaClick('Tôi muốn tạo yêu cầu cứu hộ')}
                            disabled={isSending}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                            style={{
                                background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`,
                                color: 'white',
                                boxShadow: `0 2px 8px ${C.orange}40`,
                            }}
                        >
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            Tạo yêu cầu cứu hộ
                        </button>
                        <button
                            onClick={() => onCtaClick('Ước tính giá dịch vụ cho sự cố này')}
                            disabled={isSending}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                            style={{
                                background: C.orangeLight,
                                color: C.orangeDark,
                                border: `1px solid ${C.orange}30`,
                            }}
                        >
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                            </svg>
                            Xem giá dự kiến
                        </button>
                        <button
                            onClick={() => onCtaClick('Gửi thêm ảnh/video sự cố để phân tích chính xác hơn')}
                            disabled={isSending}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                            style={{
                                background: C.orangeLight,
                                color: C.orangeDark,
                                border: `1px solid ${C.orange}30`,
                            }}
                        >
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Gửi thêm ảnh
                        </button>
                    </div>
                )}
                {ctaKind === 'location' && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        <button
                            onClick={onUseCurrentLocation}
                            disabled={isSending}
                            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                            style={{
                                background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`,
                                color: 'white',
                            }}
                        >
                            Dùng vị trí hiện tại
                        </button>
                        <button
                            onClick={onChooseOtherLocation}
                            disabled={isSending}
                            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                            style={{
                                background: C.orangeLight,
                                color: C.orangeDark,
                                border: `1px solid ${C.orange}30`,
                            }}
                        >
                            Nhập vị trí khác
                        </button>
                    </div>
                )}
                {ctaKind === 'incident' && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        <button
                            onClick={() => onCtaClick('Xe tôi bị hỏng/chết máy')}
                            disabled={isSending}
                            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                            style={{ background: C.orangeLight, color: C.orangeDark, border: `1px solid ${C.orange}30` }}
                        >
                            Hỏng xe
                        </button>
                        <button
                            onClick={() => onCtaClick('Xe tôi hết bình ắc quy')}
                            disabled={isSending}
                            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                            style={{ background: C.orangeLight, color: C.orangeDark, border: `1px solid ${C.orange}30` }}
                        >
                            Hết bình
                        </button>
                        <button
                            onClick={() => onCtaClick('Xe tôi bị nổ/xẹp lốp')}
                            disabled={isSending}
                            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                            style={{ background: C.orangeLight, color: C.orangeDark, border: `1px solid ${C.orange}30` }}
                        >
                            Nổ lốp
                        </button>
                        <button
                            onClick={() => onCtaClick('Xe tôi bị hết xăng')}
                            disabled={isSending}
                            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                            style={{ background: C.orangeLight, color: C.orangeDark, border: `1px solid ${C.orange}30` }}
                        >
                            Hết xăng
                        </button>
                        <button
                            onClick={() => onCtaClick('Tôi bị khóa xe trong xe')}
                            disabled={isSending}
                            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                            style={{ background: C.orangeLight, color: C.orangeDark, border: `1px solid ${C.orange}30` }}
                        >
                            Khóa xe
                        </button>
                        <button
                            onClick={() => onCtaClick('Tôi gặp tai nạn')}
                            disabled={isSending}
                            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                            style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
                        >
                            Tai nạn
                        </button>
                    </div>
                )}
                {ctaKind === 'confirm' && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        <button
                            onClick={() => onCtaClick('Đúng rồi, tạo yêu cầu cứu hộ ngay')}
                            disabled={isSending}
                            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                            style={{
                                background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`,
                                color: 'white',
                            }}
                        >
                            Xác nhận
                        </button>
                        <button
                            onClick={() => onCtaClick('Tôi muốn chỉnh lại thông tin')}
                            disabled={isSending}
                            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                            style={{
                                background: C.orangeLight,
                                color: C.orangeDark,
                                border: `1px solid ${C.orange}30`,
                            }}
                        >
                            Thay đổi thông tin
                        </button>
                    </div>
                )}
                {ctaKind === 'enterInfo' && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        <button
                            onClick={() => onCtaClick('Tiếp tục')}
                            disabled={isSending}
                            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                            style={{
                                background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`,
                                color: 'white',
                            }}
                        >
                            Tiếp tục
                        </button>
                        <button
                            onClick={() => onCtaClick('Nhập lại thông tin từ đầu')}
                            disabled={isSending}
                            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                            style={{
                                background: C.orangeLight,
                                color: C.orangeDark,
                                border: `1px solid ${C.orange}30`,
                            }}
                        >
                            Nhập lại
                        </button>
                    </div>
                )}
                {ctaKind === 'createRequest' && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        <button
                            onClick={() => onCtaClick('Tôi muốn tạo yêu cầu cứu hộ')}
                            disabled={isSending}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                            style={{
                                background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`,
                                color: 'white',
                                boxShadow: `0 2px 8px ${C.orange}40`,
                            }}
                        >
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            Tạo yêu cầu cứu hộ
                        </button>
                    </div>
                )}
                {ctaKind === 'describeIncident' && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        <button
                            onClick={() => onCtaClick('Bỏ qua, tạo đơn ngay')}
                            disabled={isSending}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                            style={{
                                background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`,
                                color: 'white',
                                boxShadow: `0 2px 8px ${C.orange}40`,
                            }}
                        >
                            ⚡ Bỏ qua và tạo đơn ngay
                        </button>
                        <button
                            onClick={onOpenFileUpload}
                            disabled={isSending}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                            style={{
                                background: C.orangeLight,
                                color: C.orangeDark,
                                border: `1px solid ${C.orange}30`,
                            }}
                        >
                            📷 Gửi ảnh/video
                        </button>
                    </div>
                )}
                <span className="text-[10px] mt-1 px-1" style={{ color: C.grayLight }}>
                    {formatTime(msg.createdAt)}
                </span>
            </div>
        </div>
    );
}

interface QuickAction {
    label: string;
    message: string;
}

type AttachmentItem = {
    url: string;
    type: 'image' | 'video';
    name: string;
    analysisFrames?: string[];
};

function extractVideoFrames(
    file: File,
    frameCount: number,
): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = 'anonymous';

        const cleanup = () => {
            URL.revokeObjectURL(video.src);
        };

        video.onloadedmetadata = async () => {
            const duration = Number.isFinite(video.duration) ? video.duration : 0;
            if (!duration || duration <= 0) {
                cleanup();
                resolve([]);
                return;
            }

            const canvas = document.createElement('canvas');
            const targetWidth = 320;
            const ratio = video.videoWidth > 0 ? targetWidth / video.videoWidth : 1;
            canvas.width = targetWidth;
            canvas.height = Math.max(180, Math.round(video.videoHeight * ratio));
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                cleanup();
                reject(new Error('Cannot initialize canvas context'));
                return;
            }

            const times = Array.from({ length: frameCount }, (_, i) => {
                const t = ((i + 1) / (frameCount + 1)) * duration;
                return Math.max(0.1, Math.min(duration - 0.1, t));
            });

            const frames: string[] = [];
            const seekTo = (time: number) =>
                new Promise<void>((done) => {
                    const onSeeked = () => {
                        video.removeEventListener('seeked', onSeeked);
                        done();
                    };
                    video.addEventListener('seeked', onSeeked);
                    video.currentTime = time;
                });

            for (const t of times) {
                await seekTo(t);
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                frames.push(canvas.toDataURL('image/jpeg', 0.5));
            }

            cleanup();
            resolve(frames);
        };

        video.onerror = () => {
            cleanup();
            reject(new Error('Cannot decode video for frame extraction'));
        };

        video.src = URL.createObjectURL(file);
    });
}

const CUSTOMER_QUICK_ACTIONS: QuickAction[] = [
    { label: 'Tạo yêu cầu cứu hộ', message: 'Tôi muốn tạo yêu cầu cứu hộ' },
    { label: 'Trạng thái đơn', message: 'Đơn cứu hộ hiện tại của tôi đang ở trạng thái nào?' },
    { label: 'Cách khiếu nại', message: 'Làm sao để khiếu nại một đơn cứu hộ?' },
    { label: 'Số dư ví', message: 'Kiểm tra số dư ví của tôi' },
];

const PROVIDER_QUICK_ACTIONS: QuickAction[] = [
    { label: 'Thu nhập hôm nay', message: 'Hôm nay tôi kiếm được bao nhiêu?' },
    { label: 'Đơn đang xử lý', message: 'Tôi có đơn nào đang xử lý không?' },
    { label: 'Xác minh tài khoản', message: 'Hướng dẫn tôi xác minh tài khoản' },
    { label: 'Số dư ví', message: 'Kiểm tra số dư ví của tôi' },
];

const GUEST_QUICK_ACTIONS: QuickAction[] = [
    { label: 'Rescue Me hoạt động thế nào?', message: 'Rescue Me hoạt động thế nào? Em giải thích ngắn giúp anh/chị.' },
    { label: 'Chọn địa chỉ đón', message: 'Trên form tạo yêu cầu guest trên web (PWA), chọn điểm đón có những cách nào? (em trả lời ngắn, đúng với giao diện)' },
    { label: 'Cách tạo yêu cầu cứu hộ', message: 'Trên trang web dành cho khách guest (PWA), tạo yêu cầu cứu hộ như thế nào?' },
    { label: 'Thanh toán & phí', message: 'Khách guest thanh toán bằng hình thức nào? Có ví không?' },
    { label: 'Lợi ích đăng ký', message: 'Đăng ký tài khoản có lợi ích gì so với dùng guest?' },
];

export default function ChatbotWidget() {
    const router = useRouter();
    const { user } = useAuth();
    const { isGuest } = useGuest();
    const pathname = usePathname();

    const isGuestMode = !user && isGuest;
    const userRole = user?.role || (isGuestMode ? 'GUEST' : null);

    const isExcludedPath =
        pathname.startsWith('/admin') ||
        pathname.startsWith('/auth') ||
        pathname.startsWith('/onboarding') ||
        pathname === '/';

    const chatbot = useChatbot({
        isGuest: isGuestMode,
        onAction: (event) => {
            if (event.action === 'redirect_request_detail') {
                const requestId = event.payload?.requestId;
                if (typeof requestId === 'string' && requestId.length > 0) {
                    router.push(`/user/requests/${requestId}`);
                }
            }
        },
    });
    const {
        messages,
        isSending,
        activeToolName,
        activeConversation,
        createConversation,
        sendMessage,
    } = chatbot;

    const [isOpen, setIsOpen] = useState(false);
    const [inputText, setInputText] = useState('');
    const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [showLocationPicker, setShowLocationPicker] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<RescueLocationData | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!user && !isGuestMode) return null;
    if (isExcludedPath) return null;
    if (user?.role === 'ADMIN') return null;

    const quickActions =
        userRole === 'PROVIDER'
            ? PROVIDER_QUICK_ACTIONS
            : isGuestMode
              ? GUEST_QUICK_ACTIONS
              : CUSTOMER_QUICK_ACTIONS;

    const handleOpen = async () => {
        setIsOpen(true);
        if (!activeConversation) {
            await createConversation();
        }
        setTimeout(() => inputRef.current?.focus(), 200);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        
        setIsUploading(true);
        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const isVideo = file.type.startsWith('video/');
                const result = await uploadFile(file, UploadPurpose.CHATBOT_ATTACHMENT);
                if (result.success && result.publicUrl) {
                    let analysisFrames: string[] | undefined;
                    if (isVideo) {
                        let frameCount = 4;
                        try {
                            const metaVideo = document.createElement('video');
                            metaVideo.preload = 'metadata';
                            metaVideo.src = URL.createObjectURL(file);
                            await new Promise<void>((resolveMeta) => {
                                metaVideo.onloadedmetadata = () => resolveMeta();
                                metaVideo.onerror = () => resolveMeta();
                            });
                            const d = Number.isFinite(metaVideo.duration) ? metaVideo.duration : 30;
                            URL.revokeObjectURL(metaVideo.src);
                            frameCount = d <= 30 ? 4 : Math.min(6, Math.max(4, Math.ceil(d / 8)));
                        } catch {
                            frameCount = 4;
                        }

                        try {
                            analysisFrames = await extractVideoFrames(file, frameCount);
                        } catch (frameErr) {
                            console.warn('[ChatbotWidget] Failed to extract video frames', frameErr);
                        }
                    }

                    setAttachments(prev => [...prev, {
                        url: result.publicUrl!,
                        type: isVideo ? 'video' : 'image',
                        name: file.name,
                        analysisFrames,
                    }]);
                } else {
                    alert(`Upload failed: ${result.error}`);
                }
            }
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleSend = async (text?: string) => {
        const content = text || inputText.trim();
        if ((!content && attachments.length === 0) || isSending || isUploading) return;
        
        setInputText('');
        const currentAttachments = [...attachments];
        setAttachments([]);

        const displayMediaUrls = currentAttachments.map((a) => a.url);
        const analysisImageUrls: string[] = [];
        for (const att of currentAttachments) {
            if (att.type === 'image') {
                analysisImageUrls.push(att.url);
            } else if (att.analysisFrames && att.analysisFrames.length > 0) {
                analysisImageUrls.push(...att.analysisFrames);
            }
        }

        if (!activeConversation) {
            const conv = await createConversation();
            if (!conv) {
                setAttachments(currentAttachments);
                return;
            }
            setTimeout(() => sendMessage(content, displayMediaUrls, analysisImageUrls), 50);
        } else {
            await sendMessage(content, displayMediaUrls, analysisImageUrls);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleUseCurrentLocation = async () => {
        if (!navigator.geolocation || isSending) return;
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const addressText = await reverseGeocode(lat, lng);
                const payload = `__location_current__|${addressText}|${lat}|${lng}`;
                await handleSend(payload);
            },
            async () => {
                await handleSend('Tôi muốn dùng vị trí hiện tại');
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
        );
    };

    const handleConfirmOtherLocation = async () => {
        if (!selectedLocation || isSending) return;
        const payload = `__location_other__|${selectedLocation.addressText}|${selectedLocation.lat}|${selectedLocation.lng}`;
        setShowLocationPicker(false);
        await handleSend(payload);
    };

    return (
        <>
            {!isOpen && (
                <button
                    onClick={handleOpen}
                    className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95"
                    style={{
                        background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`,
                        boxShadow: `0 4px 20px ${C.orange}50`,
                    }}
                >
                    <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={1.8}>
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                    </svg>
                </button>
            )}

            {isOpen && <ChatPanel
                messages={messages}
                isSending={isSending}
                activeToolName={activeToolName}
                inputText={inputText}
                setInputText={setInputText}
                attachments={attachments}
                setAttachments={setAttachments}
                isUploading={isUploading}
                quickActions={quickActions}
                showLocationPicker={showLocationPicker}
                setShowLocationPicker={setShowLocationPicker}
                selectedLocation={selectedLocation}
                setSelectedLocation={setSelectedLocation}
                messagesEndRef={messagesEndRef}
                inputRef={inputRef}
                fileInputRef={fileInputRef}
                onSend={handleSend}
                onKeyDown={handleKeyDown}
                onFileUpload={handleFileUpload}
                onUseCurrentLocation={handleUseCurrentLocation}
                onConfirmOtherLocation={handleConfirmOtherLocation}
                onClose={() => setIsOpen(false)}
                allowStructuredCustomerCta={userRole === 'USER'}
                faqOnlyGuest={isGuestMode}
            />}
        </>
    );
}

interface ChatPanelProps {
    messages: ChatbotMessage[];
    isSending: boolean;
    activeToolName: string | null;
    inputText: string;
    setInputText: (v: string) => void;
    attachments: AttachmentItem[];
    setAttachments: React.Dispatch<React.SetStateAction<AttachmentItem[]>>;
    isUploading: boolean;
    quickActions: QuickAction[];
    showLocationPicker: boolean;
    setShowLocationPicker: React.Dispatch<React.SetStateAction<boolean>>;
    selectedLocation: RescueLocationData | null;
    setSelectedLocation: React.Dispatch<React.SetStateAction<RescueLocationData | null>>;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    inputRef: React.RefObject<HTMLTextAreaElement | null>;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    onSend: (text?: string) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onUseCurrentLocation: () => void;
    onConfirmOtherLocation: () => void;
    onClose: () => void;
    /** Incident/location/confirm chips — chỉ user đăng nhập */
    allowStructuredCustomerCta: boolean;
    /** Guest: chỉ FAQ, ẩn đính kèm & copy gợi ý tạo đơn trong chat */
    faqOnlyGuest: boolean;
}

function ChatPanel({
    messages,
    isSending,
    activeToolName,
    inputText,
    setInputText,
    attachments,
    setAttachments,
    isUploading,
    quickActions,
    showLocationPicker,
    setShowLocationPicker,
    selectedLocation,
    setSelectedLocation,
    messagesEndRef,
    inputRef,
    fileInputRef,
    onSend,
    onKeyDown,
    onFileUpload,
    onUseCurrentLocation,
    onConfirmOtherLocation,
    onClose,
    allowStructuredCustomerCta,
    faqOnlyGuest,
}: ChatPanelProps) {
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, messagesEndRef]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    const lastAssistantId = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'ASSISTANT') return messages[i].id;
        }
        return null;
    }, [messages]);

    return (
        <div className="fixed bottom-0 right-0 z-50 sm:bottom-6 sm:right-6">
            <div
                className="flex flex-col w-screen sm:w-[400px] sm:rounded-2xl overflow-hidden"
                style={{
                    height: 'min(92vh, 680px)',
                    background: C.bg,
                    boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
                }}
            >
                {/* Header */}
                <div
                    className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
                    style={{
                        background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`,
                    }}
                >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center bg-white/20 text-white font-bold text-sm flex-shrink-0">
                        AI
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">Rescue Me Assistant</p>
                        <p className="text-[10px] text-white/70">
                            {faqOnlyGuest ? 'Hỏi đáp về hệ thống (FAQ)' : 'Tư vấn viên cứu hộ xe'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-70 bg-white/15"
                    >
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollBehavior: 'smooth' }}>
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full gap-4">
                            <div
                                className="w-16 h-16 rounded-full flex items-center justify-center"
                                style={{ background: C.orangeLight }}
                            >
                                <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={1.5}>
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
                                    />
                                </svg>
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-semibold" style={{ color: C.navy }}>
                                    Xin chào! Em có thể giúp gì ạ?
                                </p>
                                <p className="text-xs mt-1" style={{ color: C.grayLight }}>
                                    {faqOnlyGuest
                                        ? 'Hỏi về cách dùng Rescue Me trên web (PWA), thanh toán và quy trình — không tạo đơn trong chat.'
                                        : 'Gửi ảnh sự cố, tạo đơn cứu hộ, hoặc hỏi bất kỳ điều gì'}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2 justify-center mt-2">
                                {quickActions.map((qa) => (
                                    <button
                                        key={qa.label}
                                        onClick={() => onSend(qa.message)}
                                        className="px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105 active:scale-95"
                                        style={{
                                            background: C.orangeLight,
                                            color: C.orangeDark,
                                            border: `1px solid ${C.orange}30`,
                                        }}
                                    >
                                        {qa.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <>
                            {messages.map((msg) => (
                                <MessageBubble
                                    key={msg.id}
                                    msg={msg}
                                    isLastAssistant={msg.id === lastAssistantId}
                                    onCtaClick={onSend}
                                    onUseCurrentLocation={onUseCurrentLocation}
                                    onChooseOtherLocation={() => setShowLocationPicker(true)}
                                    onOpenFileUpload={() => fileInputRef.current?.click()}
                                    isSending={isSending}
                                    allowStructuredCustomerCta={allowStructuredCustomerCta}
                                />
                            ))}
                            {activeToolName && (
                                <div className="flex items-center gap-2 text-xs py-2 px-3 rounded-lg mb-2" style={{ color: C.gray, background: C.orangeLight }}>
                                    <div className="animate-spin w-3.5 h-3.5 border-2 rounded-full" style={{ borderColor: `${C.orange}30`, borderTopColor: C.orange }} />
                                    {TOOL_LABELS[activeToolName] || 'Đang xử lý...'}
                                </div>
                            )}
                        </>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                <div className="flex flex-col flex-shrink-0" style={{ background: 'white', borderTop: `1px solid ${C.border}` }}>
                    {showLocationPicker && (
                        <div className="px-4 pt-3 pb-2" style={{ borderBottom: `1px solid ${C.border}` }}>
                            <p className="text-xs font-semibold mb-2" style={{ color: C.navy }}>
                                Chọn vị trí đón khác
                            </p>
                            <LocationPicker
                                variant="rescue"
                                label=""
                                value={selectedLocation}
                                onChange={(loc) => setSelectedLocation(loc as RescueLocationData | null)}
                                placeholder="Tìm địa chỉ đón..."
                                required
                            />
                            <div className="flex gap-2 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowLocationPicker(false)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium"
                                    style={{ background: C.bg, color: C.gray }}
                                >
                                    Hủy
                                </button>
                                <button
                                    type="button"
                                    onClick={onConfirmOtherLocation}
                                    disabled={!selectedLocation || isSending}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                                    style={{ background: C.orange, color: 'white' }}
                                >
                                    Xác nhận vị trí này
                                </button>
                            </div>
                        </div>
                    )}
                    {attachments.length > 0 && (
                        <div className="flex gap-2 px-4 pt-3 pb-1 overflow-x-auto">
                            {attachments.map((att, i) => (
                                <div key={i} className="relative w-16 h-16 rounded-lg border flex-shrink-0 group overflow-hidden">
                                    {att.type === 'image' ? (
                                        <img src={att.url} alt="attachment" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                            <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24" className="text-gray-400">
                                                <path d="M8 5v14l11-7z"/>
                                            </svg>
                                        </div>
                                    )}
                                    <button 
                                        onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                                        className="absolute top-1 right-1 w-5 h-5 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        &times;
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="flex items-end gap-2.5 px-4 py-3">
                        {!faqOnlyGuest && (
                            <>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    multiple
                                    accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                                    onChange={onFileUpload}
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading || isSending}
                                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    style={{ background: C.bg, border: `1.5px solid ${C.border}` }}
                                >
                                    {isUploading ? (
                                        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                        </svg>
                                    )}
                                </button>
                            </>
                        )}
                        <textarea
                            ref={inputRef}
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={onKeyDown}
                            placeholder="Nhập tin nhắn..."
                            rows={1}
                            className="flex-1 px-4 py-2.5 rounded-2xl text-sm outline-none resize-none"
                            style={{
                                background: C.bg,
                                border: `1.5px solid ${C.border}`,
                                color: C.navy,
                                maxHeight: '100px',
                            }}
                            onFocus={(e) => {
                                e.currentTarget.style.borderColor = C.orange;
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.borderColor = C.border;
                            }}
                            onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = 'auto';
                                target.style.height = Math.min(target.scrollHeight, 100) + 'px';
                            }}
                        />
                        <button
                            onClick={() => onSend()}
                            disabled={(!inputText.trim() && attachments.length === 0) || isSending || isUploading}
                            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
                            style={{
                                background:
                                    (inputText.trim() || attachments.length > 0) && !isSending && !isUploading
                                        ? `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`
                                        : C.border,
                                boxShadow:
                                    (inputText.trim() || attachments.length > 0) && !isSending && !isUploading
                                        ? `0 2px 8px ${C.orange}40`
                                        : 'none',
                            }}
                        >
                            {isSending ? (
                                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                                    <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>
                            ) : (
                                <svg
                                    width="18"
                                    height="18"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke={(inputText.trim() || attachments.length > 0) ? 'white' : C.gray}
                                    strokeWidth={2}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                                    />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
