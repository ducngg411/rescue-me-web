'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUserGuard } from '@/lib/guards';
import { useRequestTracking } from '@/lib/hooks/useRequestTracking';
import MatchingStatus from '@/components/MatchingStatus';
import AssignedProvider from '@/components/AssignedProvider';
import ExpiredRetry from '@/components/ExpiredRetry';
import QuoteSelectionPanel from '@/components/QuoteSelectionPanel';
import toast from 'react-hot-toast';

const C = {
    orange: '#f97316',
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
    IN_PROGRESS: 'Đang thực hiện',
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

export default function RequestTrackingPage() {
    const router = useRouter();
    const params = useParams();
    const requestId = params.id as string;
    const { isReady } = useUserGuard();
    const [isRetrying, setIsRetrying] = useState(false);
    const [showQuoteSelection, setShowQuoteSelection] = useState(false);

    const { status, isLoading, error, timeRemaining, quoteWindowJustClosed, cancelRequest, retryRequest } = useRequestTracking({
        requestId,
        enabled: isReady,
    });

    // Auto-switch to quote selection when countdown ends with quotes available
    useEffect(() => {
        if (quoteWindowJustClosed && (status?.quoteCount ?? 0) > 0) {
            setShowQuoteSelection(true);
        }
    }, [quoteWindowJustClosed, status?.quoteCount]);

    // Handle page reload: if window already closed + quotes already present, show selection immediately
    useEffect(() => {
        if (!showQuoteSelection && status &&
            (status.status === 'MATCHING' || status.status === 'SEARCHING') &&
            status.quoteWindowOpen === false &&
            (status.quoteCount ?? 0) > 0) {
            setShowQuoteSelection(true);
        }
    }, [status?.quoteWindowOpen, status?.quoteCount, status?.status]);

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

                {/* MATCHING state — quote window still open OR no quotes yet */}
                {(status.status === 'MATCHING' || status.status === 'SEARCHING') && !showQuoteSelection && (
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

                {/* MATCHING state — window closed + has quotes → show quote selection */}
                {(status.status === 'MATCHING' || status.status === 'SEARCHING') && showQuoteSelection && (
                    <QuoteSelectionPanel
                        requestId={requestId}
                        quoteCount={status.quoteCount ?? 0}
                        onQuoteAccepted={() => {
                            setShowQuoteSelection(false);
                            // Polling in useRequestTracking will catch ASSIGNED status
                        }}
                    />
                )}

                {/* ASSIGNED state */}
                {status.status === 'ASSIGNED' && status.assignedProvider && (
                    <AssignedProvider
                        provider={status.assignedProvider}
                        distance={status.matchedDistance}
                        eta={status.matchedEta}
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
                        <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: '#fef2f2' }}>
                            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </div>
                        <h3 className="text-base font-bold mb-1" style={{ color: C.navy }}>Đã huỷ yêu cầu</h3>
                        <p className="text-sm mb-5" style={{ color: C.gray }}>Yêu cầu của bạn đã được huỷ thành công</p>
                        <div className="flex gap-3">
                            <button onClick={() => router.push('/user/requests')} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: C.bg, color: C.gray, border: `1px solid ${C.border}` }}>
                                Danh sách
                            </button>
                            <button onClick={() => router.push('/user/create-request')} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: C.orange }}>
                                Tạo lại
                            </button>
                        </div>
                    </div>
                )}

                {/* COMPLETED state */}
                {status.status === 'COMPLETED' && (
                    <div className="bg-white rounded-2xl p-6 text-center" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                        <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: '#f0fdf4' }}>
                            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <h3 className="text-base font-bold mb-1" style={{ color: C.navy }}>Hoàn thành!</h3>
                        <p className="text-sm mb-5" style={{ color: C.gray }}>Yêu cầu cứu hộ đã hoàn thành</p>
                        {status.assignedProvider && <AssignedProvider provider={status.assignedProvider} />}
                        <button onClick={() => router.push('/user')} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white mt-4" style={{ background: C.orange }}>
                            Về trang chủ
                        </button>
                    </div>
                )}

                {/* IN_PROGRESS / ACCEPTED state */}
                {['IN_PROGRESS', 'ACCEPTED'].includes(status.status) && (
                    <div className="space-y-4">
                        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#3b82f6' }}></div>
                                <span className="text-sm font-semibold" style={{ color: C.navy }}>
                                    {STATUS_LABELS[status.status]}
                                </span>
                            </div>
                            <p className="text-sm" style={{ color: C.gray }}>Provider đang trên đường tới hoặc đang xử lý yêu cầu của bạn.</p>
                        </div>
                        {status.assignedProvider && (
                            <AssignedProvider
                                provider={status.assignedProvider}
                                distance={status.matchedDistance}
                                eta={status.matchedEta}
                            />
                        )}
                    </div>
                )}

            </div>
        </div>
    );
}
