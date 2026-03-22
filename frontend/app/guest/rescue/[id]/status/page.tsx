'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useGuestGuard } from '@/lib/guards';
import { useLanguage } from '@/contexts/LanguageContext';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import GuestRegisterModal from '@/components/GuestRegisterModal';
import MatchingStatus from '@/components/MatchingStatus';
import AssignedProvider from '@/components/AssignedProvider';
import QuoteSelectionPanel from '@/components/QuoteSelectionPanel';
import ArrivalConfirmation from '@/components/ArrivalConfirmation';
import PaymentRequest from '@/components/PaymentRequest';
import RescueProgressTimeline from '@/components/RescueProgressTimeline';
import { matchingQuoteWindowSecondsRemaining } from '@/lib/matchingQuoteWindowCountdown';

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
    quoteWindowExpiresAt?: string | null;
    quoteWindowClosedAt?: string | null;
    expiresAt?: string | null;
    searchPhase?: number;
    viewingProvidersCount?: number;
    matchedDistance?: number;
    matchedEta?: number;
}

// --- Waiting Utility Card ---
function WaitingUtilityCard() {
    const { t } = useLanguage();
    const tips = [
        { icon: '', text: t('guest.status.waitingTips.avgTime') },
        { icon: '', text: t('guest.status.waitingTips.keepPhone') },
        { icon: '', text: t('guest.status.waitingTips.updateLocation') },
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

    const handleShareLocation = async () => {
        const url = location
            ? `https://maps.google.com/?q=${location.lat},${location.lng}`
            : '';
        const text = location
            ? t('guest.status.safetyActions.shareLocationWithCoords', {
                  address: location.addressText,
                  url,
              })
            : t('guest.status.safetyActions.shareLocationFallback');
        if (navigator.share) {
            try {
                await navigator.share({
                    title: t('guest.status.safetyActions.shareLocationTitle'),
                    text,
                });
            } catch {
                // user cancelled
            }
        } else {
            await navigator.clipboard.writeText(text);
            toast.success(t('guest.status.safetyActions.shareLocationCopied'));
        }
    };

    return (
        <button
            type="button"
            onClick={handleShareLocation}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition-all active:scale-[0.97]"
            style={{ background: '#eff6ff', color: '#3b82f6', border: '1.5px solid #bfdbfe' }}
        >
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {t('guest.status.safetyActions.shareLocationForFamily')}
        </button>
    );
}

function GuestPaymentRequestFetcher({
    requestId,
    providerName,
    onRefresh,
}: {
    requestId: string;
    providerName: string;
    onRefresh: () => void;
}) {
    const { t } = useLanguage();
    const [payment, setPayment] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                const res = await api.get(`/guest/rescue-requests/${requestId}/payment`);
                if (active) setPayment(res.data);
            } catch {
                if (active) setPayment(null);
            } finally {
                if (active) setLoading(false);
            }
        };
        load();
        const timer = setInterval(load, 5000);
        return () => {
            active = false;
            clearInterval(timer);
        };
    }, [requestId]);

    if (loading) {
        return (
            <div className="rounded-2xl bg-white p-6 text-center" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                <p className="text-sm" style={{ color: C.gray }}>{t('common.loading')}</p>
            </div>
        );
    }
    if (!payment) {
        return (
            <div className="rounded-2xl bg-white p-6 text-center" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                <p className="mb-1 text-sm font-medium" style={{ color: C.navy }}>{t('guest.payment.noPaymentYet')}</p>
                <p className="text-xs" style={{ color: C.gray }}>{t('guest.payment.noPaymentReason')}</p>
            </div>
        );
    }
    return (
        <PaymentRequest
            requestId={requestId}
            payment={payment}
            providerName={providerName}
            paymentScope="guest"
            onPaymentComplete={onRefresh}
        />
    );
}

export default function GuestStatusPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { t } = useLanguage();
    const { guestSession, isReady } = useGuestGuard();

    const [statusData, setStatusData] = useState<RequestStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const statusRef = useRef(statusData);
    statusRef.current = statusData;

    useEffect(() => {
        const s = statusData;
        const active = s?.status === 'MATCHING' && s.quoteWindowOpen === true;
        if (!active) {
            setTimeLeft(0);
            return;
        }

        const tick = () => matchingQuoteWindowSecondsRemaining(statusRef.current);
        setTimeLeft(tick());
        const timer = setInterval(() => setTimeLeft(tick()), 1000);
        return () => clearInterval(timer);
    }, [
        statusData?.status,
        statusData?.quoteWindowOpen,
        statusData?.quoteWindowExpiresAt,
        statusData?.expiresAt,
    ]);

    const fetchStatus = useCallback(async () => {
        try {
            const response = await api.get(`/guest/rescue-requests/${id}/status`);
            setStatusData(response.data);
        } catch (err: any) {
            if (err?.response?.status === 401) return;
            toast.error(t('guest.errors.generic'));
        } finally {
            setLoading(false);
        }
    }, [id, t]);

    useEffect(() => {
        if (!isReady) return;
        fetchStatus();
    }, [isReady, fetchStatus]);

    useEffect(() => {
        if (!isReady || !statusData) return;
        const activeStatuses = ['MATCHING', 'SEARCHING', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'ARRIVED', 'WORKING', 'PAYMENT_PENDING'];
        if (!activeStatuses.includes(statusData.status)) return;

        const interval = setInterval(() => {
            fetchStatus();
        }, 5000);

        return () => clearInterval(interval);
    }, [isReady, statusData, fetchStatus]);

    useEffect(() => {
        if (statusData?.status === 'COMPLETED') {
            const timer = setTimeout(() => setShowRegisterModal(true), 2000);
            return () => clearTimeout(timer);
        }
    }, [statusData?.status]);

    const handleCancel = async () => {
        if (!confirm(t('user.tracking.page.cancelConfirm'))) return;
        try {
            await api.patch(`/guest/rescue-requests/${id}/cancel`);
            toast.success(t('user.tracking.page.cancelSuccess'));
            fetchStatus();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || t('guest.errors.generic'));
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

                </div>

                {/* ── Progress Timeline ── */}
                <RescueProgressTimeline
                    status={statusData.status}
                    quoteCount={statusData.quoteCount ?? 0}
                    labels={{
                        sent: t('guest.status.timeline.sent'),
                        searching: t('guest.status.timeline.searching'),
                        chooseQuote: t('guest.status.timeline.chooseQuote'),
                        moving: t('guest.status.timeline.moving'),
                        working: t('guest.status.timeline.working'),
                        payment: t('guest.status.timeline.payment'),
                        done: t('guest.status.timeline.done'),
                    }}
                />

                {/* ── Safety Actions (active statuses only) ── */}
                {isActiveStatus && (
                    <SafetyActions location={statusData.pickupLocation} />
                )}

                {/* ── Matching (shared UI with customer) ── */}
                {isSearching && (
                    <MatchingStatus
                        timeRemaining={timeLeft}
                        searchPhase={statusData.searchPhase ?? 1}
                        viewingProvidersCount={statusData.viewingProvidersCount ?? 0}
                        quoteCount={statusData.quoteCount ?? 0}
                        maxQuotes={statusData.maxQuotes ?? 3}
                        quoteWindowOpen={statusData.quoteWindowOpen}
                        onCancel={handleCancel}
                    />
                )}

                {/* ── Waiting Utility Card (searching + 0 quotes) ── */}
                {isSearching && (statusData.quoteCount ?? 0) === 0 && (
                    <WaitingUtilityCard />
                )}

                {/* ── Quotes (shared panel) ── */}
                {['MATCHING', 'SEARCHING', 'ASSIGNED', 'ACCEPTED'].includes(statusData.status) &&
                    (statusData.quoteCount ?? 0) > 0 && (
                        <QuoteSelectionPanel
                            requestId={id}
                            requestScope="guest"
                            quoteCount={statusData.quoteCount ?? 0}
                            enableReject
                            onQuoteAccepted={() => fetchStatus()}
                            onQuoteRejected={() => fetchStatus()}
                        />
                    )}

                {/* ── Assigned provider (chat uses guestSessionId as Firestore sender id) ── */}
                {(statusData.status === 'ASSIGNED' || statusData.status === 'IN_PROGRESS') && statusData.assignedProvider && (
                    <AssignedProvider
                        provider={{
                            id: statusData.assignedProvider.id,
                            name: statusData.assignedProvider.name ?? statusData.assignedProvider.fullName ?? null,
                            avatar: statusData.assignedProvider.avatar ?? null,
                            serviceName: null,
                            serviceTypes: [],
                            phoneNumber: statusData.assignedProvider.phoneNumber ?? null,
                            pricePerKm: null,
                            baseFee: null,
                            isOnline: true,
                            averageRating: statusData.assignedProvider.averageRating ?? null,
                            reviewCount: 0,
                        }}
                        distance={statusData.matchedDistance}
                        eta={statusData.matchedEta}
                        requestStatus={statusData.status}
                        requestId={id}
                        chatCustomerId={guestSession?.guestSessionId}
                        chatCustomerName={
                            guestSession?.phone
                                ? t('guest.chat.senderName', { phone: guestSession.phone })
                                : undefined
                        }
                    />
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

                {/* ── Thanh toán (inline giống customer — không cần sang trang riêng) ── */}
                {(isPaymentPending || statusData.status === 'PAID') && statusData.assignedProvider && (
                    <GuestPaymentRequestFetcher
                        requestId={id}
                        providerName={
                            statusData.assignedProvider.name ||
                            statusData.assignedProvider.fullName ||
                            'Provider'
                        }
                        onRefresh={fetchStatus}
                    />
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

                        <div className="rounded-xl p-4 mb-4 text-left" style={{ background: C.white, border: `1px solid #bbf7d0` }}>
                            <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#15803d' }}>
                                {t('guest.status.completed.benefitsTitle')}
                            </p>
                            <ul className="space-y-2.5 text-sm" style={{ color: C.navy }}>
                                {(['benefit1', 'benefit2', 'benefit3', 'benefit4'] as const).map((key) => (
                                    <li key={key} className="flex gap-2.5 items-start">
                                        <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: '#22c55e' }}>✓</span>
                                        <span className="leading-snug">{t(`guest.status.completed.${key}`)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="space-y-2.5">
                            <button
                                type="button"
                                onClick={() => setShowRegisterModal(true)}
                                className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98]"
                                style={{ background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)`, boxShadow: `0 4px 16px ${C.orange}40` }}
                            >
                                {t('guest.register.registerBtn')}
                            </button>
                            <button
                                type="button"
                                onClick={() => router.push('/')}
                                className="w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.98]"
                                style={{ color: C.navy, border: `1.5px solid ${C.border}`, background: C.white }}
                            >
                                {t('guest.status.completed.homeBtn')}
                            </button>
                        </div>
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

            {statusData.status === 'ARRIVED' && statusData.assignedProvider && (
                <ArrivalConfirmation
                    requestScope="guest"
                    requestId={id}
                    providerName={statusData.assignedProvider.fullName || statusData.assignedProvider.name || 'Provider'}
                    onResponded={(confirmed) => {
                        fetchStatus();
                        if (confirmed) {
                            toast.success(t('guest.status.arrived.toastConfirmed'));
                        } else {
                            toast.success(t('guest.status.arrived.toastDenied'));
                        }
                    }}
                />
            )}

            <GuestRegisterModal isOpen={showRegisterModal} onClose={() => setShowRegisterModal(false)} />
        </div>
    );
}
