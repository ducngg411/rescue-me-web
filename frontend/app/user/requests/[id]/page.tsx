'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUserGuard } from '@/lib/guards';
import { useRequestTracking } from '@/lib/hooks/useRequestTracking';
import MatchingStatus from '@/components/MatchingStatus';
import AssignedProvider from '@/components/AssignedProvider';
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
                    className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})` }}
                >
                    {initials}
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
            toast.success('✅ Đã chọn báo giá! Provider đang chuẩn bị đến.');
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
        <div className="min-h-screen" style={{ background: C.bg, fontFamily: 'Poppins, sans-serif' }}>

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

                {/* ASSIGNED state */}
                {(status.status === 'ASSIGNED' || status.status === 'IN_PROGRESS') && status.assignedProvider && (
                    <AssignedProvider
                        provider={status.assignedProvider}
                        distance={status.matchedDistance}
                        eta={status.matchedEta}
                        requestStatus={status.status}
                    />
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
