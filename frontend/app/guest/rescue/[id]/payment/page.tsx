'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useGuestGuard } from '@/lib/guards';
import { useLanguage } from '@/contexts/LanguageContext';
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
    white: '#ffffff',
};

interface Payment {
    id: string;
    totalAmount: number;
    baseFee: number;
    distanceFee: number;
    overtimeFee: number;
    otherFee: number;
    paymentMethod: string;
    status: string;
    userConfirmedAt?: string;
    providerConfirmedAt?: string;
    surchargeNote?: string;
    note?: string;
    photoUrls?: string[];
    qrTransferCode?: string;
    qrUrl?: string;
    qrExpireAt?: string;
    qrStatus?: string;
}

// --- QR Progress Timeline ---
function QrProgressTimeline({ qrStatus, paymentStatus }: { qrStatus?: string; paymentStatus: string }) {
    const { t } = useLanguage();
    const isCompleted = paymentStatus === 'COMPLETED' || paymentStatus === 'PROVIDER_CONFIRMED';

    // Steps: created → waiting → confirming → done
    // qrStatus: PENDING, PAID, EXPIRED
    const steps = [
        { key: 'created', label: t('guest.payment.qrProgress.created') },
        { key: 'waiting', label: t('guest.payment.qrProgress.waiting') },
        { key: 'confirming', label: t('guest.payment.qrProgress.confirming') },
        { key: 'done', label: t('guest.payment.qrProgress.done') },
    ];

    const currentStep = isCompleted ? 3 : qrStatus === 'PAID' ? 2 : 1;

    return (
        <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
            <div className="flex items-center justify-between relative">
                <div
                    className="absolute top-3 left-0 right-0 h-0.5 mx-3"
                    style={{ background: C.border, zIndex: 0 }}
                />
                {steps.map((step, i) => {
                    const isDone = currentStep > i;
                    const isActive = currentStep === i;
                    const dotBg = isDone ? '#16a34a' : isActive ? C.orange : C.border;
                    const labelColor = isDone ? '#16a34a' : isActive ? C.orange : C.gray;
                    return (
                        <div key={step.key} className="flex flex-col items-center" style={{ zIndex: 1, flex: 1 }}>
                            <div
                                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                                style={{
                                    background: dotBg,
                                    boxShadow: isActive ? `0 0 0 3px ${C.orange}22` : undefined,
                                }}
                            >
                                {isDone ? (
                                    <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : isActive ? (
                                    <div className="w-2 h-2 rounded-full bg-white" />
                                ) : null}
                            </div>
                            <p className="text-[9px] font-semibold text-center mt-1.5 leading-tight" style={{ color: labelColor, maxWidth: 44 }}>
                                {step.label}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

const FeeRow = ({ label, amount }: { label: string; amount: number }) =>
    amount > 0 ? (
        <div className="flex justify-between text-sm py-1">
            <span style={{ color: C.gray }}>{label}</span>
            <span style={{ color: C.navy }}>{amount.toLocaleString('vi-VN')}đ</span>
        </div>
    ) : null;

export default function GuestPaymentPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { t } = useLanguage();
    const { isReady } = useGuestGuard();

    const [payment, setPayment] = useState<Payment | null>(null);
    const [loading, setLoading] = useState(true);
    const [confirming, setConfirming] = useState(false);
    const [refreshCountdown, setRefreshCountdown] = useState(15);

    const fetchPayment = useCallback(async () => {
        try {
            const response = await api.get(`/guest/rescue-requests/${id}/payment`);
            setPayment(response.data);
        } catch (err: any) {
            if (err?.response?.status !== 401) {
                toast.error('Không thể tải thông tin thanh toán');
            }
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (!isReady) return;
        fetchPayment();
    }, [isReady, fetchPayment]);

    // Poll QR payment status
    useEffect(() => {
        if (!payment || payment.paymentMethod !== 'QR' || payment.status === 'COMPLETED') return;
        const interval = setInterval(async () => {
            try {
                const response = await api.get(`/guest/rescue-requests/${id}/payment/qr/status`);
                if (response.data?.status === 'COMPLETED') {
                    fetchPayment();
                    clearInterval(interval);
                }
            } catch {
                // ignore
            }
        }, 3000);
        return () => clearInterval(interval);
    }, [payment, id, fetchPayment]);

    // Auto-refresh countdown when no payment yet
    useEffect(() => {
        if (payment || loading) return;
        setRefreshCountdown(15);
        const countdownInterval = setInterval(() => {
            setRefreshCountdown((prev) => {
                if (prev <= 1) {
                    fetchPayment();
                    return 15;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(countdownInterval);
    }, [payment, loading, fetchPayment]);

    const handleConfirmSent = async () => {
        setConfirming(true);
        try {
            await api.patch(`/guest/rescue-requests/${id}/payment/confirm-sent`);
            toast.success('Đã xác nhận thanh toán!');
            fetchPayment();
        } catch (err: any) {
            const msg = err?.response?.data?.message;
            if (msg?.includes('WALLET') || msg?.includes('wallet')) {
                toast.error(t('guest.errors.walletBlocked'));
            } else {
                toast.error(msg || 'Không thể xác nhận thanh toán');
            }
        } finally {
            setConfirming(false);
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

    if (!payment) {
        return (
            <div className="min-h-screen flex flex-col" style={{ background: C.bg, fontFamily: 'Lexend, sans-serif' }}>
                <header className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3" style={{ background: C.white, borderBottom: `1px solid ${C.border}` }}>
                    <button
                        onClick={() => router.push(`/guest/rescue/${id}/status`)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: C.bg, color: C.navy }}
                    >
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h1 className="font-bold text-base" style={{ color: C.navy }}>{t('guest.payment.title')}</h1>
                </header>
                <div className="flex-1 flex items-center justify-center px-4">
                    <div className="w-full max-w-xs text-center">
                        {/* Icon */}
                        <div className="w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center" style={{ background: C.orangeLight }}>
                            <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                            </svg>
                        </div>
                        {/* Title */}
                        <p className="font-bold text-base mb-1" style={{ color: C.navy }}>{t('guest.payment.noPaymentYet')}</p>
                        {/* Reason */}
                        <p className="text-sm mb-5 leading-snug" style={{ color: C.gray }}>{t('guest.payment.noPaymentReason')}</p>
                        {/* Countdown */}
                        <div className="flex items-center justify-center gap-2 mb-5 px-4 py-2.5 rounded-xl" style={{ background: C.orangeLight }}>
                            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.orange }} />
                            <p className="text-xs font-medium" style={{ color: C.orangeDark }}>
                                {t('guest.payment.refreshIn').replace('{sec}', String(refreshCountdown))}
                            </p>
                        </div>
                        {/* Back button */}
                        <button
                            onClick={() => router.push(`/guest/rescue/${id}/status`)}
                            className="w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                            style={{ background: C.white, color: C.navy, border: `1.5px solid ${C.border}` }}
                        >
                            {t('guest.payment.backToStatus')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const isCompleted = payment.status === 'COMPLETED' || payment.status === 'PROVIDER_CONFIRMED';
    const isUserConfirmed = !!payment.userConfirmedAt;

    const PAYMENT_METHOD_LABELS: Record<string, string> = {
        CASH: t('guest.payment.cashLabel'),
        QR: t('guest.payment.qrLabel'),
        WALLET: t('guest.payment.walletLocked'),
    };

    return (
        <div className="min-h-screen pb-8" style={{ background: C.bg, fontFamily: 'Lexend, sans-serif' }}>
            {/* Sticky Header */}
            <header className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3" style={{ background: C.white, borderBottom: `1px solid ${C.border}` }}>
                <button
                    onClick={() => router.push(`/guest/rescue/${id}/status`)}
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: C.bg, color: C.navy }}
                >
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div>
                    <h1 className="font-bold text-base leading-tight" style={{ color: C.navy }}>{t('guest.payment.title')}</h1>
                    <p className="text-xs" style={{ color: C.gray }}>{PAYMENT_METHOD_LABELS[payment.paymentMethod] || payment.paymentMethod}</p>
                </div>
            </header>

            <div className="max-w-md mx-auto px-4 py-5 space-y-4">

                {/* ── Payment Summary ── */}
                <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: C.orangeLight }}>
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                        </div>
                        <h3 className="text-sm font-semibold" style={{ color: C.navy }}>{t('guest.payment.detailsTitle')}</h3>
                    </div>

                    <div className="space-y-0.5">
                        <FeeRow label={t('guest.payment.feeBase')} amount={payment.baseFee} />
                        <FeeRow label={t('guest.payment.feeDistance')} amount={payment.distanceFee} />
                        <FeeRow label={t('guest.payment.feeOvertime')} amount={payment.overtimeFee} />
                        <FeeRow label={t('guest.payment.feeOther')} amount={payment.otherFee} />
                    </div>

                    <div className="flex justify-between items-center pt-3 mt-2" style={{ borderTop: `1.5px solid ${C.border}` }}>
                        <span className="font-semibold text-sm" style={{ color: C.navy }}>{t('guest.payment.totalLabel')}</span>
                        <span className="font-bold text-xl" style={{ color: C.orange }}>
                            {payment.totalAmount.toLocaleString('vi-VN')}đ
                        </span>
                    </div>

                    {payment.note && (
                        <p className="mt-3 text-xs px-3 py-2 rounded-lg" style={{ color: C.gray, background: C.bg }}>
                            {t('guest.payment.noteLabel')}: {payment.note}
                        </p>
                    )}
                </div>

                {/* ── WALLET locked for guests ── */}
                {payment.paymentMethod === 'WALLET' ? (
                    <div className="rounded-2xl p-5" style={{ background: '#fefce8', border: '1.5px solid #fde68a' }}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#fef9c3' }}>
                                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#ca8a04" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <div>
                                <p className="font-semibold text-sm" style={{ color: C.navy }}>{t('guest.payment.walletLocked')}</p>
                                <p className="text-xs mt-0.5" style={{ color: '#92400e' }}>{t('guest.payment.walletLockedDesc')}</p>
                            </div>
                        </div>
                        <a
                            href="/auth/register"
                            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm text-white transition-all"
                            style={{ background: 'linear-gradient(135deg,#d97706,#b45309)' }}
                        >
                            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                            {t('guest.payment.registerToUnlock')}
                        </a>
                    </div>

                ) : isCompleted ? (
                    <div className="rounded-2xl p-5 text-center" style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0' }}>
                        <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: '#dcfce7' }}>
                            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <p className="font-bold text-sm" style={{ color: '#15803d' }}>{t('guest.payment.completedTitle')}</p>
                        <p className="text-xs mt-1" style={{ color: '#16a34a' }}>{t('guest.payment.completedSubtitle')}</p>
                    </div>

                ) : payment.paymentMethod === 'CASH' ? (
                    <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.orangeLight }}>
                                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <div>
                                <p className="font-semibold text-sm" style={{ color: C.navy }}>{t('guest.payment.cashLabel')}</p>
                                <p className="text-xs mt-0.5" style={{ color: C.gray }}>{t('guest.payment.cashInstruction')}</p>
                            </div>
                        </div>
                        {!isUserConfirmed ? (
                            <button
                                onClick={handleConfirmSent}
                                disabled={confirming}
                                className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98] disabled:opacity-50"
                                style={{ background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)`, boxShadow: `0 4px 16px ${C.orange}40` }}
                            >
                                {confirming ? t('guest.payment.confirmingBtn') : t('guest.payment.confirmSentBtn')}
                            </button>
                        ) : (
                            <div className="rounded-xl p-3 text-center" style={{ background: C.orangeLight }}>
                                <p className="text-sm font-medium" style={{ color: C.orangeDark }}>{t('guest.payment.cashPendingProvider')}</p>
                            </div>
                        )}
                    </div>

                ) : payment.paymentMethod === 'QR' ? (
                    <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#eff6ff' }}>
                                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#3b82f6" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                </svg>
                            </div>
                            <div>
                                <p className="font-semibold text-sm" style={{ color: C.navy }}>{t('guest.payment.qrLabel')}</p>
                                <p className="text-xs mt-0.5" style={{ color: C.gray }}>{t('guest.payment.qrInstruction')}</p>
                            </div>
                        </div>
                        {payment.qrUrl ? (
                            <div className="text-center">
                                <img
                                    src={payment.qrUrl}
                                    alt="QR code thanh toán"
                                    className="mx-auto w-56 h-56 object-contain rounded-xl"
                                    style={{ border: `1.5px solid ${C.border}` }}
                                />
                                {payment.qrTransferCode && (
                                    <p className="mt-3 text-xs" style={{ color: C.gray }}>
                                        {t('guest.payment.qrContent')}: <span className="font-mono font-semibold" style={{ color: C.navy }}>{payment.qrTransferCode}</span>
                                    </p>
                                )}
                                <p className="mt-2 text-xs" style={{ color: C.gray }}>{t('guest.payment.qrAutoConfirm')}</p>

                                {/* QR Progress Timeline */}
                                <QrProgressTimeline qrStatus={payment.qrStatus} paymentStatus={payment.status} />
                            </div>
                        ) : (
                            <div className="text-center py-6">
                                <div className="animate-spin rounded-full h-10 w-10 border-2 mx-auto mb-3" style={{ borderColor: C.orange, borderTopColor: 'transparent' }} />
                                <p className="text-sm" style={{ color: C.gray }}>Đang chờ provider khởi tạo QR...</p>
                            </div>
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
