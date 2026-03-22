'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useGuestGuard } from '@/lib/guards';
import { useLanguage } from '@/contexts/LanguageContext';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import GuestRegisterModal from '@/components/GuestRegisterModal';

const C = {
    orange: '#f97316',
    orangeDark: '#ea6c0a',
    orangeLight: '#fff7ed',
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#f1f5f9',
    bg: '#f8fafc',
    white: '#ffffff',
};

interface Quote {
    id: string;
    price: number;
    estimatedArrivalMinutes: number;
    message?: string;
    status: string;
    provider: {
        id: string;
        name: string;
        avatar?: string;
        serviceName?: string;
        phoneNumber?: string;
    };
}

interface RequestStatus {
    id: string;
    status: string;
    incidentType: string;
    pickupLocation: { addressText: string; lat: number; lng: number };
    createdAt: string;
    assignedProvider?: {
        id: string;
        name: string;
        fullName?: string;
        phoneNumber?: string;
        avatar?: string;
        averageRating?: number;
    };
    quoteCount: number;
    maxQuotes: number;
    quoteWindowOpen: boolean;
    quoteWindowTimeRemaining: number;
}

// --- Progress Timeline ---
function ProgressTimeline({ status }: { status: string }) {
    const { t } = useLanguage();
    const steps = [
        { key: 'sent', label: t('guest.status.timeline.sent'), statuses: ['CREATED'] },
        { key: 'searching', label: t('guest.status.timeline.searching'), statuses: ['MATCHING', 'SEARCHING', 'MATCHED'] },
        { key: 'gotQuote', label: t('guest.status.timeline.gotQuote'), statuses: ['ASSIGNED', 'ACCEPTED'] },
        { key: 'selected', label: t('guest.status.timeline.selected'), statuses: ['IN_PROGRESS', 'ARRIVED', 'WORKING', 'PAYMENT_PENDING'] },
        { key: 'done', label: t('guest.status.timeline.done'), statuses: ['PAID', 'COMPLETED'] },
    ];

    const currentIndex = steps.findIndex((s) => s.statuses.includes(status));
    const isCancelled = ['CANCELLED', 'REJECTED', 'EXPIRED'].includes(status);

    return (
        <div className="bg-white rounded-2xl px-5 py-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center justify-between relative">
                {/* connector line */}
                <div
                    className="absolute top-3.5 left-0 right-0 h-0.5 mx-4"
                    style={{ background: C.border, zIndex: 0 }}
                />
                {steps.map((step, i) => {
                    const isDone = !isCancelled && currentIndex > i;
                    const isActive = !isCancelled && currentIndex === i;
                    const dotBg = isDone ? '#16a34a' : isActive ? C.orange : C.border;
                    const labelColor = isDone ? '#16a34a' : isActive ? C.orange : C.gray;
                    return (
                        <div key={step.key} className="flex flex-col items-center" style={{ zIndex: 1, flex: 1 }}>
                            <div
                                className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                                style={{ background: dotBg, border: isActive ? `2px solid ${C.orange}` : 'none', boxShadow: isActive ? `0 0 0 3px ${C.orange}22` : undefined }}
                            >
                                {isDone && (
                                    <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            <p className="text-[9px] font-semibold text-center mt-1.5 leading-tight" style={{ color: labelColor, maxWidth: 40 }}>
                                {step.label}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// --- Waiting Utility Card ---
function WaitingUtilityCard() {
    const { t } = useLanguage();
    const tips = [
        { icon: '⏱', text: t('guest.status.waitingTips.avgTime') },
        { icon: '🔔', text: t('guest.status.waitingTips.keepPhone') },
        { icon: '📍', text: t('guest.status.waitingTips.updateLocation') },
    ];
    return (
        <div className="rounded-2xl p-4" style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe' }}>
            <p className="text-xs font-semibold mb-3" style={{ color: '#1e40af' }}>
                {t('guest.status.waitingTips.title')}
            </p>
            <div className="space-y-2">
                {tips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-2">
                        <span className="text-sm leading-tight">{tip.icon}</span>
                        <p className="text-xs leading-snug" style={{ color: '#1d4ed8' }}>{tip.text}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

// --- Safety Actions ---
function SafetyActions({ location }: { location?: { addressText: string; lat: number; lng: number } }) {
    const { t } = useLanguage();
    const HOTLINE = '19001000';

    const handleShareLocation = async () => {
        const text = location
            ? `Vị trí của tôi: ${location.addressText} (https://maps.google.com/?q=${location.lat},${location.lng})`
            : 'Tôi đang cần hỗ trợ cứu hộ.';
        if (navigator.share) {
            try {
                await navigator.share({ title: 'Vị trí cứu hộ', text });
            } catch {
                // user cancelled
            }
        } else {
            await navigator.clipboard.writeText(text);
            toast.success('Đã sao chép vị trí!');
        }
    };

    return (
        <div className="flex gap-2">
            <a
                href={`tel:${HOTLINE}`}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-[0.97]"
                style={{ background: '#dcfce7', color: '#16a34a', border: '1.5px solid #bbf7d0' }}
            >
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
                {t('guest.status.safetyActions.callHotline')}
            </a>
            <button
                onClick={handleShareLocation}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-[0.97]"
                style={{ background: '#eff6ff', color: '#3b82f6', border: '1.5px solid #bfdbfe' }}
            >
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {t('guest.status.safetyActions.shareLocation')}
            </button>
        </div>
    );
}

export default function GuestStatusPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { t } = useLanguage();
    const { guestSession, isReady } = useGuestGuard();

    const [statusData, setStatusData] = useState<RequestStatus | null>(null);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [loading, setLoading] = useState(true);
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [respondingQuote, setRespondingQuote] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [confirmingArrival, setConfirmingArrival] = useState(false);

    useEffect(() => {
        if (statusData?.quoteWindowTimeRemaining) {
            setTimeLeft(statusData.quoteWindowTimeRemaining);
        }
    }, [statusData?.quoteWindowTimeRemaining]);

    useEffect(() => {
        if (timeLeft <= 0) return;
        const timer = setInterval(() => {
            setTimeLeft(prev => Math.max(0, prev - 1));
        }, 1000);
        return () => clearInterval(timer);
    }, [timeLeft]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const fetchStatus = useCallback(async () => {
        try {
            const response = await api.get(`/guest/rescue-requests/${id}/status`);
            setStatusData(response.data);
        } catch (err: any) {
            if (err?.response?.status === 401) return;
            toast.error('Không thể tải trạng thái yêu cầu');
        } finally {
            setLoading(false);
        }
    }, [id]);

    const fetchQuotes = useCallback(async () => {
        try {
            const response = await api.get(`/guest/rescue-requests/${id}/quotes`);
            setQuotes(response.data || []);
        } catch {
            // ignore
        }
    }, [id]);

    useEffect(() => {
        if (!isReady) return;
        fetchStatus();
        fetchQuotes();
    }, [isReady, fetchStatus, fetchQuotes]);

    useEffect(() => {
        if (!isReady || !statusData) return;
        const activeStatuses = ['MATCHING', 'SEARCHING', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'ARRIVED', 'WORKING', 'PAYMENT_PENDING'];
        if (!activeStatuses.includes(statusData.status)) return;

        const interval = setInterval(() => {
            fetchStatus();
            if (['MATCHING', 'SEARCHING'].includes(statusData.status)) {
                fetchQuotes();
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [isReady, statusData, fetchStatus, fetchQuotes]);

    useEffect(() => {
        if (statusData?.status === 'COMPLETED') {
            const timer = setTimeout(() => setShowRegisterModal(true), 2000);
            return () => clearTimeout(timer);
        }
    }, [statusData?.status]);

    const handleRespondQuote = async (quoteId: string, action: 'ACCEPT' | 'REJECT') => {
        setRespondingQuote(quoteId);
        try {
            await api.patch(`/guest/rescue-requests/${id}/quotes/${quoteId}/respond`, { action });
            toast.success(action === 'ACCEPT' ? 'Đã chấp nhận báo giá!' : 'Đã từ chối báo giá');
            fetchStatus();
            fetchQuotes();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Có lỗi xảy ra');
        } finally {
            setRespondingQuote(null);
        }
    };

    const handleCancel = async () => {
        if (!confirm('Bạn có chắc muốn hủy yêu cầu không?')) return;
        try {
            await api.patch(`/guest/rescue-requests/${id}/cancel`);
            toast.success('Đã hủy yêu cầu');
            fetchStatus();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Không thể hủy yêu cầu');
        }
    };

    const handleGoToPayment = () => {
        router.push(`/guest/rescue/${id}/payment`);
    };

    const handleConfirmArrival = async (confirmed: boolean) => {
        setConfirmingArrival(true);
        try {
            if (confirmed) {
                await api.patch(`/guest/rescue-requests/${id}/confirm-arrival`);
                toast.success('Đã xác nhận provider đã đến!');
            } else {
                await api.patch(`/guest/rescue-requests/${id}/deny-arrival`);
                toast.success('Đã báo provider chưa đến nơi');
            }
            fetchStatus();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Có lỗi xảy ra');
        } finally {
            setConfirmingArrival(false);
        }
    };

    if (!isReady || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-2 mx-auto" style={{ borderColor: C.orange, borderTopColor: 'transparent' }} />
                    <p className="mt-4 text-sm" style={{ color: C.gray }}>Đang tải...</p>
                </div>
            </div>
        );
    }

    if (!statusData) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4" style={{ background: C.bg }}>
                <div className="text-center">
                    <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: '#f1f5f9' }}>
                        <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke={C.gray} strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <p className="text-sm" style={{ color: C.gray }}>{t('guest.errors.notFound')}</p>
                </div>
            </div>
        );
    }

    const pendingQuotes = quotes.filter((q) => q.status === 'PENDING');
    const isCompleted = statusData.status === 'COMPLETED';
    const isCancelled = ['CANCELLED', 'EXPIRED', 'REJECTED'].includes(statusData.status);
    const isPaymentPending = statusData.status === 'PAYMENT_PENDING';
    const canCancel = ['CREATED', 'MATCHING', 'SEARCHING'].includes(statusData.status);
    const isActiveStatus = ['MATCHING', 'SEARCHING', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'WORKING', 'PAYMENT_PENDING'].includes(statusData.status);
    const isSearching = ['MATCHING', 'SEARCHING'].includes(statusData.status);

    // i18n status labels
    const statusLabels: Record<string, string> = {
        CREATED: t('guest.status.statusLabels.CREATED'),
        MATCHING: t('guest.status.statusLabels.MATCHING'),
        SEARCHING: t('guest.status.statusLabels.SEARCHING'),
        MATCHED: t('guest.status.statusLabels.MATCHED'),
        ASSIGNED: t('guest.status.statusLabels.ASSIGNED'),
        ACCEPTED: t('guest.status.statusLabels.ACCEPTED'),
        IN_PROGRESS: t('guest.status.statusLabels.IN_PROGRESS'),
        ARRIVED: t('guest.status.statusLabels.ARRIVED'),
        WORKING: t('guest.status.statusLabels.WORKING'),
        PAYMENT_PENDING: t('guest.status.statusLabels.PAYMENT_PENDING'),
        PAID: t('guest.status.statusLabels.PAID'),
        COMPLETED: t('guest.status.statusLabels.COMPLETED'),
        CANCELLED: t('guest.status.statusLabels.CANCELLED'),
        REJECTED: t('guest.status.statusLabels.REJECTED'),
        EXPIRED: t('guest.status.statusLabels.EXPIRED'),
    };

    const statusBadge = isCompleted
        ? { bg: '#dcfce7', color: '#16a34a' }
        : isCancelled
        ? { bg: '#f1f5f9', color: C.gray }
        : isPaymentPending
        ? { bg: C.orangeLight, color: C.orange }
        : { bg: '#eff6ff', color: '#3b82f6' };

    return (
        <div className="min-h-screen" style={{ background: C.bg, fontFamily: 'Lexend, sans-serif', paddingBottom: '32px' }}>
            {/* Sticky Header */}
            <header className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3" style={{ background: C.white, borderBottom: `1px solid ${C.border}` }}>
                <button
                    onClick={() => router.back()}
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: C.bg, color: C.navy }}
                >
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div className="flex-1 min-w-0">
                    <h1 className="font-bold text-base leading-tight" style={{ color: C.navy }}>{t('guest.status.title')}</h1>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: C.orangeLight, color: C.orange }}>
                            {t('guest.status.guestBadge')}
                        </span>
                        <span className="text-xs truncate" style={{ color: C.gray }}>{guestSession?.phone}</span>
                    </div>
                </div>
            </header>

            <div className="max-w-md mx-auto px-4 py-5 space-y-4">

                {/* ── Status Card ── */}
                <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-mono" style={{ color: C.gray }}>#{id.slice(-8).toUpperCase()}</span>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: statusBadge.bg, color: statusBadge.color }}>
                            {statusLabels[statusData.status] || statusData.status}
                        </span>
                    </div>

                    <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: isCompleted ? '#dcfce7' : isCancelled ? '#f1f5f9' : C.orangeLight }}>
                            {isCompleted ? (
                                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            ) : isCancelled ? (
                                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={C.gray} strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            ) : (
                                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm" style={{ color: C.navy }}>
                                {statusLabels[statusData.status] || statusData.status}
                            </p>
                            <p className="text-xs mt-0.5 leading-snug" style={{ color: C.gray }}>{statusData.pickupLocation?.addressText}</p>
                        </div>
                    </div>

                    {/* Searching indicator with countdown */}
                    {isSearching && (
                        <div className="mt-4 rounded-xl p-4" style={{ background: C.orangeLight, border: `1px solid ${C.orange}20` }}>
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="flex space-x-1">
                                            <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: C.orange, animationDelay: '0ms' }} />
                                            <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: C.orange, animationDelay: '150ms' }} />
                                            <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: C.orange, animationDelay: '300ms' }} />
                                        </div>
                                        <span className="text-sm font-semibold" style={{ color: C.navy }}>Đang tìm cứu hộ...</span>
                                    </div>
                                    <p className="text-xs ml-4 pl-1" style={{ color: C.orangeDark }}>
                                        Đã nhận: <span className="font-bold">{statusData.quoteCount}/{statusData.maxQuotes || 5}</span> báo giá
                                    </p>
                                </div>
                                {timeLeft > 0 && (
                                    <div className="text-right flex flex-col items-end">
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl" style={{ background: C.white, border: `1.5px solid ${C.orange}30` }}>
                                            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <span className="text-sm font-mono font-bold" style={{ color: C.orange }}>{formatTime(timeLeft)}</span>
                                        </div>
                                        <p className="text-[10px] mt-1 font-semibold uppercase tracking-wider" style={{ color: C.orange }}>Còn lại</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Progress Timeline ── */}
                {!isCancelled && (
                    <ProgressTimeline status={statusData.status} />
                )}

                {/* ── Safety Actions (active statuses only) ── */}
                {isActiveStatus && (
                    <SafetyActions location={statusData.pickupLocation} />
                )}

                {/* ── Waiting Utility Card (searching + 0 quotes) ── */}
                {isSearching && pendingQuotes.length === 0 && (
                    <WaitingUtilityCard />
                )}

                {/* ── Quotes ── */}
                {pendingQuotes.length > 0 && (
                    <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: C.orangeLight }}>
                                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                            </div>
                            <h3 className="text-sm font-semibold" style={{ color: C.navy }}>
                                {t('guest.status.quotes.sectionTitle').replace('{count}', String(pendingQuotes.length))}
                            </h3>
                        </div>
                        <div className="space-y-3">
                            {pendingQuotes.map((quote) => (
                                <div key={quote.id} className="rounded-xl p-4" style={{ border: `1.5px solid ${C.border}` }}>
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.bg }}>
                                                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={C.gray} strokeWidth={1.8}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold" style={{ color: C.navy }}>{quote.provider.name}</p>
                                                <p className="text-xs" style={{ color: C.gray }}>{quote.provider.serviceName || t('guest.status.quotes.defaultService')}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-base font-bold" style={{ color: C.orange }}>{quote.price.toLocaleString('vi-VN')}đ</p>
                                            <p className="text-xs" style={{ color: C.gray }}>
                                                {t('guest.status.quotes.etaMinutes').replace('{min}', String(quote.estimatedArrivalMinutes))}
                                            </p>
                                        </div>
                                    </div>
                                    {quote.message && (
                                        <p className="text-xs mb-3 px-3 py-2 rounded-lg italic" style={{ color: C.gray, background: C.bg }}>"{quote.message}"</p>
                                    )}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleRespondQuote(quote.id, 'ACCEPT')}
                                            disabled={respondingQuote === quote.id}
                                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-50"
                                            style={{ background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)` }}
                                        >
                                            {respondingQuote === quote.id ? t('guest.status.quotes.processingBtn') : t('guest.status.quotes.acceptBtn')}
                                        </button>
                                        <button
                                            onClick={() => handleRespondQuote(quote.id, 'REJECT')}
                                            disabled={respondingQuote === quote.id}
                                            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-50"
                                            style={{ background: C.bg, color: C.gray, border: `1.5px solid ${C.border}` }}
                                        >
                                            {t('guest.status.quotes.rejectBtn')}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Provider Info ── */}
                {statusData.assignedProvider && (
                    <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                        <div className="flex items-center gap-2 mb-3">
                            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13l1.5-4.5A2 2 0 016.4 7h11.2a2 2 0 011.9 1.5L21 13m-18 0v5a1 1 0 001 1h1a1 1 0 001-1v-1h12v1a1 1 0 001 1h1a1 1 0 001-1v-5m-18 0h18M6 13h.01M18 13h.01" />
                            </svg>
                            <h3 className="text-sm font-semibold" style={{ color: C.navy }}>{t('guest.status.provider.sectionTitle')}</h3>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: C.bg }}>
                            <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.orangeLight }}>
                                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={1.8}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm" style={{ color: C.navy }}>
                                    {statusData.assignedProvider.fullName || statusData.assignedProvider.name}
                                </p>
                                {statusData.assignedProvider.averageRating && (
                                    <p className="text-xs mt-0.5" style={{ color: '#ca8a04' }}>
                                        ★ {statusData.assignedProvider.averageRating.toFixed(1)}
                                    </p>
                                )}
                            </div>
                            {statusData.assignedProvider.phoneNumber && (
                                <a
                                    href={`tel:${statusData.assignedProvider.phoneNumber}`}
                                    className="w-10 h-10 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
                                    style={{ background: '#dcfce7', color: '#16a34a' }}
                                >
                                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                                    </svg>
                                </a>
                            )}
                        </div>
                    </div>
                )}

                {/* ── IN_PROGRESS card ── */}
                {statusData.status === 'IN_PROGRESS' && statusData.assignedProvider && (
                    <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)', border: `1.5px solid ${C.orange}20` }}>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.orangeLight }}>
                                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm font-semibold" style={{ color: C.navy }}>{t('guest.status.inProgress.heading')}</p>
                                <p className="text-xs mt-0.5" style={{ color: C.gray }}>{t('guest.status.inProgress.hint')}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── WORKING card ── */}
                {statusData.status === 'WORKING' && (
                    <div className="bg-white rounded-2xl p-5 text-center" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)', border: '1.5px solid #bbf7d0' }}>
                        <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: '#dcfce7' }}>
                            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        <h3 className="text-sm font-bold mb-1" style={{ color: '#15803d' }}>{t('guest.status.working.heading')}</h3>
                        <p className="text-xs" style={{ color: C.gray }}>{t('guest.status.working.hint')}</p>
                    </div>
                )}

                {/* ── Payment Pending CTA ── */}
                {isPaymentPending && (
                    <div className="rounded-2xl p-5" style={{ background: C.orangeLight, border: `1.5px solid ${C.orange}30` }}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.white }}>
                                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <div>
                                <p className="font-semibold text-sm" style={{ color: C.navy }}>{t('guest.status.payment.heading')}</p>
                                <p className="text-xs mt-0.5" style={{ color: C.orangeDark }}>{t('guest.status.payment.subheading')}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleGoToPayment}
                            className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98]"
                            style={{ background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)`, boxShadow: `0 4px 16px ${C.orange}40` }}
                        >
                            {t('guest.status.payment.goBtn')}
                        </button>
                    </div>
                )}

                {/* ── Completed ── */}
                {isCompleted && (
                    <div className="rounded-2xl p-5 text-center" style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0' }}>
                        <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: '#dcfce7' }}>
                            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <p className="font-bold text-lg" style={{ color: '#15803d' }}>{t('guest.status.completed.title')}</p>
                        <p className="text-sm mt-1 mb-4" style={{ color: '#16a34a' }}>{t('guest.status.completed.subtitle')}</p>
                        <button
                            onClick={() => setShowRegisterModal(true)}
                            className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98]"
                            style={{ background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)`, boxShadow: `0 4px 16px ${C.orange}40` }}
                        >
                            {t('guest.register.registerBtn')}
                        </button>
                    </div>
                )}

                {/* ── Cancelled / Expired ── */}
                {isCancelled && (
                    <div className="rounded-2xl p-5 text-center" style={{ background: '#f8fafc', border: `1.5px solid ${C.border}` }}>
                        <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: '#f1f5f9' }}>
                            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke={C.gray} strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <p className="font-semibold text-sm" style={{ color: C.navy }}>{statusLabels[statusData.status]}</p>
                        <p className="text-xs mt-1" style={{ color: C.gray }}>{t('guest.status.cancelled.subtitle')}</p>
                    </div>
                )}

                {/* ── Cancel button ── */}
                {canCancel && (
                    <button
                        onClick={handleCancel}
                        className="w-full py-3 text-sm transition-colors rounded-xl"
                        style={{ color: C.gray, border: `1.5px solid ${C.border}`, background: C.white }}
                    >
                        {t('guest.status.cancelBtn')}
                    </button>
                )}
            </div>

            {/* ── ARRIVED bottom sheet ── */}
            {statusData.status === 'ARRIVED' && statusData.assignedProvider && (
                <div
                    className="fixed inset-0 z-50 flex items-end"
                    style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
                >
                    <div
                        className="w-full px-4 pb-8 pt-6"
                        style={{ background: C.white, borderRadius: '28px 28px 0 0', boxShadow: '0 -12px 48px rgba(0,0,0,0.20)' }}
                    >
                        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: C.border }} />
                        <div className="relative w-20 h-20 mx-auto mb-4">
                            <span className="absolute inset-0 rounded-full animate-ping opacity-60" style={{ background: C.orangeLight }} />
                            <div className="relative w-20 h-20 rounded-full flex items-center justify-center" style={{ background: C.orangeLight }}>
                                <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={1.8}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                        </div>
                        <h2 className="text-lg font-bold text-center mb-1" style={{ color: C.navy }}>{t('guest.status.arrived.title')}</h2>
                        <p className="text-sm text-center mb-1" style={{ color: C.gray }}>
                            <strong>{statusData.assignedProvider.fullName || statusData.assignedProvider.name}</strong> thông báo đã có mặt tại vị trí của bạn.
                        </p>
                        <p className="text-sm text-center mb-7" style={{ color: C.gray }}>
                            {t('guest.status.arrived.hint')}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => handleConfirmArrival(false)}
                                disabled={confirmingArrival}
                                className="py-4 rounded-2xl text-sm font-semibold border-2 flex items-center justify-center gap-2 transition-all active:scale-[0.97] disabled:opacity-50"
                                style={{ borderColor: '#fca5a5', color: '#dc2626', background: '#fef2f2' }}
                            >
                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#dc2626" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                {t('guest.status.arrived.denyBtn')}
                            </button>
                            <button
                                onClick={() => handleConfirmArrival(true)}
                                disabled={confirmingArrival}
                                className="py-4 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.97] disabled:opacity-50"
                                style={{ background: confirmingArrival ? '#9ca3af' : 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: confirmingArrival ? 'none' : '0 4px 16px rgba(22,163,74,0.35)' }}
                            >
                                {confirmingArrival ? (
                                    <>
                                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" /><path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                                        {t('guest.status.arrived.confirming')}
                                    </>
                                ) : (
                                    <>
                                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                        {t('guest.status.arrived.confirmBtn')}
                                    </>
                                )}
                            </button>
                        </div>
                        <p className="text-xs text-center mt-4" style={{ color: C.gray }}>{t('guest.status.arrived.support')}</p>
                    </div>
                </div>
            )}

            <GuestRegisterModal isOpen={showRegisterModal} onClose={() => setShowRegisterModal(false)} />
        </div>
    );
}
