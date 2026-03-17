'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUserGuard } from '@/lib/guards';
import { useRequestTracking } from '@/lib/hooks/useRequestTracking';
import MatchingStatus from '@/components/MatchingStatus';
import AssignedProvider from '@/components/AssignedProvider';
import ArrivalConfirmation from '@/components/ArrivalConfirmation';
import PaymentRequest from '@/components/PaymentRequest';
import ExpiredRetry from '@/components/ExpiredRetry';
import QuoteSelectionPanel from '@/components/QuoteSelectionPanel';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const C = {
    orange: '#f97316',
    orangeDark: '#ea6c0a',
    orangeLight: '#fff7ed',
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#f1f5f9',
    bg: '#f8fafc',
};

const STATUS_LABELS: Record<string, string> = {
    CREATED: 'Đã tạo',
    MATCHING: 'Đang tìm provider',
    SEARCHING: 'Đang tìm provider',
    MATCHED: 'Đã ghép đôi',
    ASSIGNED: 'Đã có provider',
    ACCEPTED: 'Đã chấp nhận',
    IN_PROGRESS: 'Đang di chuyển',
    ARRIVED: 'Provider đã đến',
    WORKING: 'Đang làm việc',
    PAYMENT_PENDING: 'Chờ thanh toán',
    PAID: 'Đã thanh toán',
    COMPLETED: 'Hoàn thành',
    CANCELLED: 'Đã hủy',
    REJECTED: 'Bị từ chối',
    EXPIRED: 'Hết hạn',
};

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
    MATCHING: { bg: C.orangeLight, text: C.orange, dot: C.orange },
    SEARCHING: { bg: C.orangeLight, text: C.orange, dot: C.orange },
    ASSIGNED: { bg: '#f0fdf4', text: '#16a34a', dot: '#22c55e' },
    ACCEPTED: { bg: '#f0fdf4', text: '#16a34a', dot: '#22c55e' },
    IN_PROGRESS: { bg: '#eff6ff', text: '#2563eb', dot: '#3b82f6' },
    ARRIVED: { bg: '#fef3c7', text: '#d97706', dot: '#f59e0b' },
    WORKING: { bg: '#f0fdf4', text: '#16a34a', dot: '#22c55e' },
    PAYMENT_PENDING: { bg: '#fff7ed', text: '#f97316', dot: '#f97316' },
    PAID: { bg: '#f0fdf4', text: '#16a34a', dot: '#22c55e' },
    COMPLETED: { bg: '#f0fdf4', text: '#16a34a', dot: '#22c55e' },
    CANCELLED: { bg: '#fef2f2', text: '#dc2626', dot: '#ef4444' },
    EXPIRED: { bg: '#fefce8', text: '#ca8a04', dot: '#eab308' },
    MATCHED: { bg: '#f5f3ff', text: '#7c3aed', dot: '#8b5cf6' },
};

const INCIDENT_LABELS: Record<string, string> = {
    BREAKDOWN: 'Hỏng xe',
    ACCIDENT: 'Tai nạn',
    FLAT_TIRE: 'Lốp xe hỏng',
    BATTERY_DEAD: 'Hết bình điện',
    OUT_OF_FUEL: 'Hết nhiên liệu',
    LOCKED_OUT: 'Khóa xe',
    OTHER: 'Khác',
};

interface Quote {
    id: string;
    price: number;
    estimatedArrivalMinutes: number;
    message?: string;
    status: string;
    provider: {
        id: string;
        name: string | null;
        avatar?: string | null;
        serviceName: string | null;
        phoneNumber: string | null;
    };
}

// ── Live Quote Card (compact, shown during countdown) ──────────────────────
function LiveQuoteCard({
    quote,
    onAccept,
    isAccepting,
    isAnyAccepting,
}: {
    quote: Quote;
    onAccept: (id: string) => void;
    isAccepting: boolean;
    isAnyAccepting: boolean;
}) {
    const providerName = quote.provider.serviceName || quote.provider.name || 'Provider';
    const initials = providerName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

    return (
        <div
            className="bg-white rounded-2xl p-4 transition-all"
            style={{
                boxShadow: isAccepting ? `0 0 0 2px ${C.orange}` : '0 1px 8px rgba(0,0,0,0.06)',
                opacity: isAnyAccepting && !isAccepting ? 0.55 : 1,
            }}
        >
            <div className="flex items-center gap-3">
                {/* Avatar */}
                <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 bg-cover bg-center"
                    style={{ background: quote.provider.avatar ? `url(${quote.provider.avatar}) center/cover` : `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})` }}
                >
                    {!quote.provider.avatar && initials}
                </div>

                {/* Name + price */}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: C.navy }}>{providerName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm font-bold" style={{ color: C.orange }}>
                            {quote.price.toLocaleString('vi-VN')}₫
                        </span>
                        <span className="text-[11px]" style={{ color: C.gray }}>·</span>
                        <span className="text-[11px]" style={{ color: C.gray }}>
                            ~{quote.estimatedArrivalMinutes} phút
                        </span>
                    </div>
                </div>

                {/* Accept button */}
                <button
                    onClick={() => onAccept(quote.id)}
                    disabled={isAnyAccepting}
                    className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold text-white transition-all active:scale-[0.97]"
                    style={{
                        background: isAccepting
                            ? C.gray
                            : `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`,
                        boxShadow: isAccepting ? 'none' : `0 2px 8px ${C.orange}40`,
                        cursor: isAnyAccepting ? 'not-allowed' : 'pointer',
                        minWidth: '72px',
                    }}
                >
                    {isAccepting ? (
                        <span className="flex items-center gap-1">
                            <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                        </span>
                    ) : 'Chọn ngay'}
                </button>
            </div>

            {/* Message snippet */}
            {quote.message && (
                <p className="text-[11px] italic mt-2 pl-14 truncate" style={{ color: C.gray }}>
                    "{quote.message}"
                </p>
            )}
        </div>
    );
}


// Fetches payment details and renders PaymentRequest for the user
function PaymentRequestFetcher({ requestId, providerName }: { requestId: string; providerName: string }) {
    const [payment, setPayment] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                const res = await api.get(`/rescue-requests/${requestId}/payment`);
                if (active) setPayment(res.data);
            } catch { /* ignore — may not exist yet */ }
            finally { if (active) setLoading(false); }
        };
        load();
        // Re-poll every 5s so userConfirmedAt refreshes after user confirms
        const t = setInterval(load, 5000);
        return () => { active = false; clearInterval(t); };
    }, [requestId]);

    if (loading) return (
        <div className="bg-white rounded-2xl p-6 text-center" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <p className="text-sm" style={{ color: '#6b7280' }}>Đang tải thông tin thanh toán...</p>
        </div>
    );
    if (!payment) return (
        <div className="bg-white rounded-2xl p-6 text-center" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <p className="text-sm" style={{ color: '#6b7280' }}>Chưa có yêu cầu thanh toán</p>
        </div>
    );
    return <PaymentRequest requestId={requestId} payment={payment} providerName={providerName} />;
}

// ── Completed Card shown after job is COMPLETED ────────────────────────────
const QUICK_TAGS = [
    'Sạch sẽ', 'Chuyên nghiệp', 'Thân thiện', 'Nhanh chóng', 'Đúng giờ', 'Giá hợp lý',
];

function StarIcon({ filled, size = 32 }: { filled: boolean; size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? '#f59e0b' : 'none'} stroke={filled ? '#f59e0b' : '#d1d5db'} strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
    );
}

function CompletedCard({ requestId }: { requestId: string }) {
    const router = useRouter();

    // Dispute state
    const [showDispute, setShowDispute] = useState(false);
    const [disputeReason, setDisputeReason] = useState('');
    const [isDisputing, setIsDisputing] = useState(false);

    // Review state
    const [hoveredStar, setHoveredStar] = useState(0);
    const [selectedStar, setSelectedStar] = useState(0);
    const [comment, setComment] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [reviewSubmitted, setReviewSubmitted] = useState(false);

    const handleDispute = async () => {
        if (!disputeReason.trim()) { toast.error('Vui lòng nhập lý do khiếu nại'); return; }
        setIsDisputing(true);
        try {
            await api.post(`/rescue-requests/${requestId}/payment/dispute`, { reason: disputeReason });
            toast.success('Đã gửi khiếu nại. Chúng tôi sẽ xem xét trong 24h.');
            setShowDispute(false);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Gửi khiếu nại thất bại');
        } finally {
            setIsDisputing(false);
        }
    };

    const toggleTag = (tag: string) => {
        setSelectedTags(prev =>
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
    };

    const handleReviewSubmit = async () => {
        if (selectedStar === 0) { toast.error('Vui lòng chọn ít nhất 1 sao'); return; }
        setIsSubmitting(true);
        try {
            await api.post(`/rescue-requests/${requestId}/review`, {
                rating: selectedStar,
                comment: comment.trim() || undefined,
                tags: selectedTags,
            });
            setReviewSubmitted(true);
            toast.success('Đã gửi đánh giá! Cảm ơn bạn ♥️');
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Gửi đánh giá thất bại';
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const displayStar = hoveredStar || selectedStar;

    return (
        <>
            <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 12px rgba(0,0,0,0.08)' }}>
                {/* Success header */}
                <div className="px-6 pt-8 pb-6 text-center" style={{ background: 'linear-gradient(160deg, #f0fdf4, #dcfce7)' }}>
                    <div
                        className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
                        style={{ background: 'white', boxShadow: '0 4px 16px rgba(22,163,74,0.2)' }}
                    >
                        <span style={{ fontSize: '38px' }}>🎉</span>
                    </div>
                    <h3 className="text-lg font-bold mb-1" style={{ color: '#15803d' }}>Dịch vụ hoàn thành!</h3>
                    <p className="text-sm" style={{ color: '#166534' }}>
                        Cảm ơn bạn đã sử dụng dịch vụ RescueMe.
                    </p>
                </div>

                {/* ── Rating block (primary action) ── */}
                <div className="px-5 pt-5 pb-4">
                    {reviewSubmitted ? (
                        /* ── Thank-you state ── */
                        <div
                            className="flex flex-col items-center gap-2 py-4 rounded-2xl"
                            style={{ background: '#fffbeb' }}
                        >
                            <span style={{ fontSize: '28px' }}>⭐</span>
                            <p className="text-sm font-bold" style={{ color: '#92400e' }}>Cảm ơn bạn đã đánh giá!</p>
                            <div className="flex gap-0.5 mt-1">
                                {[1, 2, 3, 4, 5].map(s => (
                                    <StarIcon key={s} filled={s <= selectedStar} size={20} />
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* ── Rating form ── */
                        <div
                            className="rounded-2xl p-4"
                            style={{
                                background: selectedStar ? '#fffbeb' : '#f8fafc',
                                border: `1.5px solid ${selectedStar ? '#fde68a' : '#f1f5f9'}`,
                                transition: 'all 0.25s',
                            }}
                        >
                            {/* Title */}
                            <div className="text-center mb-3">
                                <p className="text-sm font-bold" style={{ color: C.navy }}>Bạn hài lòng với dịch vụ chứ?</p>
                                <p className="text-[11px] mt-0.5" style={{ color: C.gray }}>⭐ Chọn số sao trực tiếp tại đây</p>
                            </div>

                            {/* Stars */}
                            <div className="flex items-center justify-center gap-1 mb-1">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <button
                                        key={star}
                                        onMouseEnter={() => setHoveredStar(star)}
                                        onMouseLeave={() => setHoveredStar(0)}
                                        onClick={() => setSelectedStar(star)}
                                        className="transition-transform active:scale-90"
                                        style={{ transform: displayStar >= star ? 'scale(1.1)' : 'scale(1)' }}
                                    >
                                        <StarIcon filled={displayStar >= star} size={36} />
                                    </button>
                                ))}
                            </div>
                            {selectedStar > 0 && (
                                <p className="text-center text-[11px] font-medium mb-3" style={{ color: '#92400e' }}>
                                    {['', 'Tệ', 'Không tốt', 'Bình thường', 'Tốt', 'Xuất sắc'][selectedStar]}
                                </p>
                            )}

                            {/* Comment + quick tags — show after a star is chosen */}
                            {
                                selectedStar > 0 && (
                                    <div
                                        style={{
                                            overflow: 'hidden',
                                            maxHeight: '320px',
                                            opacity: 1,
                                            transition: 'max-height 0.3s ease, opacity 0.3s ease',
                                        }}
                                    >
                                        {/* Quick tags */}
                                        <div className="flex flex-wrap gap-1.5 mb-3">
                                            {QUICK_TAGS.map(tag => {
                                                const active = selectedTags.includes(tag);
                                                return (
                                                    <button
                                                        key={tag}
                                                        onClick={() => toggleTag(tag)}
                                                        className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all active:scale-95"
                                                        style={{
                                                            background: active ? '#fef3c7' : 'white',
                                                            color: active ? '#92400e' : '#6b7280',
                                                            border: `1px solid ${active ? '#fde68a' : '#e5e7eb'}`,
                                                        }}
                                                    >
                                                        {active ? '✓ ' : ''}{tag}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Comment textarea */}
                                        <textarea
                                            value={comment}
                                            onChange={e => setComment(e.target.value)}
                                            placeholder="Nhận xét thêm (không bắt buộc)..."
                                            rows={3}
                                            className="w-full py-2.5 px-3 rounded-xl text-sm outline-none resize-none mb-3"
                                            style={{ background: 'white', border: '1px solid #e5e7eb', color: C.navy }}
                                        />

                                        {/* Submit button */}
                                        <button
                                            onClick={handleReviewSubmit}
                                            disabled={isSubmitting}
                                            className="w-full py-3 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                            style={{
                                                background: isSubmitting ? C.gray : 'linear-gradient(135deg, #f59e0b, #d97706)',
                                                boxShadow: isSubmitting ? 'none' : '0 4px 14px rgba(245,158,11,0.35)',
                                            }}
                                        >
                                            {isSubmitting ? (
                                                <span className="flex items-center gap-2">
                                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" /><path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                                                    Đang gửi...
                                                </span>
                                            ) : (
                                                <>
                                                    <span>⭐</span> Gửi đánh giá
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )
                            }
                        </div>
                    )}
                </div>

                {/* ── Secondary actions ── */}
                <div className="px-5 pb-5 space-y-2.5">
                    <button
                        onClick={() => router.push('/user')}
                        className="w-full py-3.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2"
                        style={{ background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`, boxShadow: `0 4px 16px ${C.orange}40` }}
                    >
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        Về trang chủ
                    </button>
                    <button
                        onClick={() => setShowDispute(true)}
                        className="w-full py-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5"
                        style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }}
                    >
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Khiếu nại / Báo sự cố
                    </button>
                </div>
            </div>

            {/* Dispute bottom sheet */}
            {showDispute && (
                <div
                    className="fixed inset-0 z-[70] flex items-end"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                    onClick={() => setShowDispute(false)}
                >
                    <div
                        className="w-full px-4 pb-10 pt-5"
                        style={{ background: 'white', borderRadius: '24px 24px 0 0' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: '#f1f5f9' }} />
                        <h3 className="text-sm font-bold mb-1" style={{ color: C.navy }}>Khiếu nại dịch vụ</h3>
                        <p className="text-xs mb-4" style={{ color: C.gray }}>
                            Mô tả vấn đề bạn gặp phải. Chúng tôi sẽ xem xét và phản hồi trong 24 giờ.
                        </p>
                        <textarea
                            value={disputeReason}
                            onChange={e => setDisputeReason(e.target.value)}
                            placeholder="Ví dụ: Số tiền không đúng, dịch vụ không như cam kết..."
                            rows={4}
                            className="w-full py-3 px-4 rounded-xl text-sm outline-none resize-none mb-4"
                            style={{ background: '#f8fafc', border: '1px solid #f1f5f9', color: C.navy }}
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setShowDispute(false)}
                                className="py-3 rounded-2xl text-sm font-semibold"
                                style={{ background: '#f8fafc', color: '#6b7280' }}
                            >
                                Huỷ
                            </button>
                            <button
                                onClick={handleDispute}
                                disabled={isDisputing}
                                className="py-3 rounded-2xl text-sm font-bold text-white"
                                style={{ background: '#dc2626' }}
                            >
                                {isDisputing ? 'Đang gửi...' : 'Gửi khiếu nại'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default function RequestTrackingPage() {

    const router = useRouter();
    const params = useParams();
    const requestId = params.id as string;
    const { isReady } = useUserGuard();
    const [isRetrying, setIsRetrying] = useState(false);
    const [showQuoteSelection, setShowQuoteSelection] = useState(false);

    // Live quotes state (during countdown)
    const [liveQuotes, setLiveQuotes] = useState<Quote[]>([]);
    const [acceptingId, setAcceptingId] = useState<string | null>(null);

    const { status, isLoading, error, timeRemaining, quoteWindowJustClosed, cancelRequest, retryRequest } = useRequestTracking({
        requestId,
        enabled: isReady,
    });

    // ── Fetch live quotes when quoteCount > 0 ────────────────────────────────
    const fetchLiveQuotes = useCallback(async () => {
        if (!requestId) return;
        try {
            const res = await api.get(`/rescue-requests/${requestId}/quotes`);
            const pending = res.data.filter((q: Quote) => q.status === 'PENDING');
            setLiveQuotes(pending);
        } catch (err) {
            // Silently fail — not critical
        }
    }, [requestId]);

    // Poll live quotes every 4s when in MATCHING + window open + has quotes
    useEffect(() => {
        const isMatching = status?.status === 'MATCHING' || status?.status === 'SEARCHING';
        const windowOpen = status?.quoteWindowOpen !== false; // true or undefined = open
        const hasQuotes = (status?.quoteCount ?? 0) > 0;

        if (!isMatching || !hasQuotes || showQuoteSelection) return;

        fetchLiveQuotes(); // immediate fetch

        const interval = setInterval(fetchLiveQuotes, 4000);
        return () => clearInterval(interval);
    }, [status?.quoteCount, status?.status, status?.quoteWindowOpen, showQuoteSelection, fetchLiveQuotes]);

    // ── Auto-switch to full quote selection when countdown ends ───────────────
    useEffect(() => {
        if (quoteWindowJustClosed && (status?.quoteCount ?? 0) > 0) {
            setShowQuoteSelection(true);
        }
    }, [quoteWindowJustClosed, status?.quoteCount]);

    // Handle page reload: if window already closed + quotes present
    useEffect(() => {
        if (!showQuoteSelection && status &&
            (status.status === 'MATCHING' || status.status === 'SEARCHING') &&
            status.quoteWindowOpen === false &&
            (status.quoteCount ?? 0) > 0) {
            setShowQuoteSelection(true);
        }
    }, [status?.quoteWindowOpen, status?.quoteCount, status?.status]);

    // ── Accept quote during countdown ────────────────────────────────────────
    const handleAcceptLiveQuote = async (quoteId: string) => {
        if (acceptingId) return;
        setAcceptingId(quoteId);
        try {
            await api.patch(`/rescue-requests/${requestId}/quotes/${quoteId}/respond`, {
                action: 'ACCEPT',
            });
            toast.success('Đã chọn báo giá! Provider đang chuẩn bị đến.');
            // Tracking hook will poll and catch ASSIGNED status automatically
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Không thể chọn báo giá. Vui lòng thử lại.';
            toast.error(msg);
            setAcceptingId(null);
        }
    };

    const handleCancel = async () => {
        const confirmed = window.confirm('Bạn có chắc muốn huỷ yêu cầu này?');
        if (!confirmed) return;
        const success = await cancelRequest();
        if (success) {
            toast.success('Đã huỷ yêu cầu thành công');
            router.push('/user/requests');
        }
    };

    const handleRetry = async () => {
        setIsRetrying(true);
        try {
            const newRequest = await retryRequest();
            toast.success('Đã tạo yêu cầu mới!');
            router.push(`/user/requests/${newRequest.id}`);
        } catch {
            toast.error('Không thể thử lại. Vui lòng thử lại sau.');
        } finally {
            setIsRetrying(false);
        }
    };

    if (!isReady || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-3" style={{ borderColor: C.orange }}></div>
                    <p className="text-sm" style={{ color: C.gray }}>Đang tải yêu cầu...</p>
                </div>
            </div>
        );
    }

    if (error && !status) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4" style={{ background: C.bg }}>
                <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
                    <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: '#fef2f2' }}>
                        <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </div>
                    <h3 className="text-base font-bold mb-2" style={{ color: C.navy }}>Không tải được yêu cầu</h3>
                    <p className="text-sm mb-5" style={{ color: C.gray }}>{error}</p>
                    <button onClick={() => router.push('/user/requests')} className="w-full py-2.5 rounded-xl font-semibold text-sm text-white" style={{ background: C.orange }}>
                        Quay lại
                    </button>
                </div>
            </div>
        );
    }

    if (!status) return null;

    const statusStyle = STATUS_COLORS[status.status] || { bg: C.bg, text: C.gray, dot: C.gray };
    const isMatchingWithWindowOpen = (status.status === 'MATCHING' || status.status === 'SEARCHING') && !showQuoteSelection;
    const showLiveQuotes = isMatchingWithWindowOpen && liveQuotes.length > 0 && !acceptingId;

    return (
        <div className="min-h-screen" style={{ background: C.bg, fontFamily: 'Lexend, sans-serif' }}>

            {/* ── Sticky Header ── */}
            <header
                className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3"
                style={{ background: '#fff', borderBottom: `1px solid ${C.border}` }}
            >
                <button
                    onClick={() => router.push('/user/requests')}
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: C.bg, color: C.navy }}
                >
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div className="flex-1 min-w-0">
                    <h1 className="font-bold text-sm leading-tight" style={{ color: C.navy }}>Yêu cầu cứu hộ</h1>
                    <p className="text-xs truncate" style={{ color: C.gray }}>#{requestId.slice(0, 8).toUpperCase()}</p>
                </div>
                {/* Status chip */}
                <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0"
                    style={{ background: statusStyle.bg, color: statusStyle.text }}
                >
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: statusStyle.dot }}></div>
                    {STATUS_LABELS[status.status] || status.status}
                </div>
            </header>

            {/* ── Request Info Banner ── */}
            <div className="px-4 pt-4">
                <div className="bg-white rounded-2xl p-4 flex items-center gap-3" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: C.orangeLight }}>
                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: C.navy }}>
                            {status.incidentType ? (INCIDENT_LABELS[status.incidentType] || status.incidentType) : 'Cứu hộ khẩn cấp'}
                        </p>
                        {status.pickupLocation?.addressText && (
                            <p className="text-xs truncate mt-0.5" style={{ color: C.gray }}>
                                📍 {status.pickupLocation.addressText}
                            </p>
                        )}
                    </div>
                    <div className="text-right flex-shrink-0">
                        <p className="text-[10px]" style={{ color: C.gray }}>Tạo lúc</p>
                        <p className="text-xs font-medium" style={{ color: C.navy }}>
                            {status.createdAt ? new Date(status.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Main Content ── */}
            <div className="px-4 py-4 pb-8 max-w-2xl mx-auto space-y-4">

                {/* MATCHING state — countdown + optional live quotes below */}
                {isMatchingWithWindowOpen && (
                    <MatchingStatus
                        timeRemaining={timeRemaining}
                        searchPhase={status.searchPhase}
                        viewingProvidersCount={status.viewingProvidersCount}
                        quoteCount={status.quoteCount}
                        maxQuotes={status.maxQuotes}
                        quoteWindowOpen={status.quoteWindowOpen}
                        onCancel={handleCancel}
                        onViewQuotes={() => setShowQuoteSelection(true)}
                    />
                )}

                {/* ── Live Quote Cards (during countdown) ── */}
                {isMatchingWithWindowOpen && liveQuotes.length > 0 && (
                    <div className="space-y-3">
                        {/* Section header */}
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#22c55e' }} />
                            <p className="text-xs font-semibold" style={{ color: C.navy }}>
                                Báo giá mới nhận — Chọn ngay hoặc đợi thêm
                            </p>
                        </div>

                        {liveQuotes.map(quote => (
                            <LiveQuoteCard
                                key={quote.id}
                                quote={quote}
                                onAccept={handleAcceptLiveQuote}
                                isAccepting={acceptingId === quote.id}
                                isAnyAccepting={!!acceptingId}
                            />
                        ))}

                        {/* Hint */}
                        <p className="text-center text-[11px]" style={{ color: C.gray }}>
                            Đếm ngược vẫn chạy để chờ báo giá từ providers khác
                        </p>
                    </div>
                )}

                {/* MATCHING state — window closed + has quotes → full selection panel */}
                {(status.status === 'MATCHING' || status.status === 'SEARCHING') && showQuoteSelection && (
                    <QuoteSelectionPanel
                        requestId={requestId}
                        quoteCount={status.quoteCount ?? 0}
                        onQuoteAccepted={() => {
                            setShowQuoteSelection(false);
                        }}
                    />
                )}

                {/* ASSIGNED / IN_PROGRESS state */}
                {(status.status === 'ASSIGNED' || status.status === 'IN_PROGRESS') && status.assignedProvider && (
                    <AssignedProvider
                        provider={status.assignedProvider}
                        distance={status.matchedDistance}
                        eta={status.matchedEta}
                        requestStatus={status.status}
                        requestId={requestId}
                    />
                )}

                {/* ARRIVED: provider says they're here, ask customer to confirm */}
                {status.status === 'ARRIVED' && status.assignedProvider && (
                    <ArrivalConfirmation
                        requestId={requestId}
                        providerName={status.assignedProvider.name ?? 'Provider'}
                        onResponded={(confirmed) => {
                            // The hook will re-poll and update status automatically
                        }}
                    />
                )}

                {/* WORKING: customer confirmed, service in progress */}
                {status.status === 'WORKING' && (
                    <div className="bg-white rounded-2xl p-6 text-center" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                        <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: '#f0fdf4' }}>
                            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        <h3 className="text-sm font-bold mb-1" style={{ color: '#15803d' }}>Provider đang làm việc</h3>
                        <p className="text-xs mb-2" style={{ color: '#6b7280' }}>
                            Vui lòng quan sát và hỗ trợ provider trong quá trình sửa chữa.
                        </p>
                        <p className="text-xs" style={{ color: '#9ca3af' }}>
                            ⚡ Hãy yên tâm — provider của bạn đang cố gắng hết sức!
                        </p>
                    </div>
                )}

                {/* PAYMENT_PENDING: provider sent payment request */}
                {(status.status === 'PAYMENT_PENDING' || status.status === 'PAID') && status.assignedProvider && (
                    <PaymentRequestFetcher
                        requestId={requestId}
                        providerName={status.assignedProvider.name ?? 'Provider'}
                    />
                )}

                {/* COMPLETED: service done */}
                {status.status === 'COMPLETED' && (
                    <CompletedCard requestId={requestId} />
                )}

                {/* EXPIRED state */}
                {status.status === 'EXPIRED' && (
                    <ExpiredRetry
                        onRetry={handleRetry}
                        onCancel={handleCancel}
                        isRetrying={isRetrying}
                    />
                )}

                {/* CANCELLED state */}
                {status.status === 'CANCELLED' && (
                    <div className="bg-white rounded-2xl p-6 text-center" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                        <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: '#fef2f2' }}>
                            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <h3 className="text-sm font-bold mb-1" style={{ color: C.navy }}>Yêu cầu đã bị huỷ</h3>
                        <p className="text-xs mb-5" style={{ color: C.gray }}>Yêu cầu cứu hộ của bạn đã được huỷ thành công.</p>
                        <button
                            onClick={() => router.push('/user')}
                            className="w-full py-3 rounded-xl text-sm font-bold text-white"
                            style={{ background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})` }}
                        >
                            Về trang chủ
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
