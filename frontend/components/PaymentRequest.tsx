'use client';

import { useState, useEffect, useRef } from 'react';
import ReactConfetti from 'react-confetti';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { GuestWalletLockedCard } from '@/components/rescue-flow/payment/GuestWalletLockedCard';
import { RESCUE_FLOW_COLORS } from '@/components/rescue-flow/tokens';

const C = {
    orange: '#f97316',
    orangeDark: '#ea6c0a',
    navy: '#1a1a2e',
    gray: '#6b7280',
    bg: '#f8fafc',
    border: '#f1f5f9',
    green: '#16a34a',
    greenLight: '#f0fdf4',
};

function fmt(n: number) {
    return n.toLocaleString('vi-VN') + 'đ';
}

interface Payment {
    id: string;
    totalAmount: number;
    baseFee: number;
    distanceFee: number;
    overtimeFee: number;
    otherFee: number;
    surchargeNote?: string | null;
    note?: string | null;
    photoUrls: string[];
    paymentMethod: 'CASH' | 'QR' | 'WALLET';
    status: string;
    userConfirmedAt?: string | null;
}

interface PaymentRequestProps {
    requestId: string;
    payment: Payment;
    providerName?: string | null;
    /** Guest JWT uses `/guest/rescue-requests/...` */
    paymentScope?: 'customer' | 'guest';
    /** After cash confirm / QR success / wallet pay — e.g. refetch request status */
    onPaymentComplete?: () => void;
}

export default function PaymentRequest({
    requestId,
    payment,
    providerName,
    paymentScope = 'customer',
    onPaymentComplete,
}: PaymentRequestProps) {
    const { t } = useLanguage();
    const apiBase =
        paymentScope === 'guest' ? `/guest/rescue-requests/${requestId}` : `/rescue-requests/${requestId}`;
    const [showBreakdown, setShowBreakdown] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [showDispute, setShowDispute] = useState(false);
    const [disputeReason, setDisputeReason] = useState('');
    const [isDisputing, setIsDisputing] = useState(false);
    const [done, setDone] = useState(false);
    // State for viewing photos in full-screen modal
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

    // Wallet balance (only fetched when paymentMethod === WALLET)
    const [walletBalance, setWalletBalance] = useState<number | null>(null);
    const [walletLoading, setWalletLoading] = useState(false);

    useEffect(() => {
        if (paymentScope === 'guest' || payment.paymentMethod !== 'WALLET') return;
        setWalletLoading(true);
        api.get('/user-wallet/me')
            .then(res => setWalletBalance(res.data.availableBalance ?? 0))
            .catch(() => setWalletBalance(0))
            .finally(() => setWalletLoading(false));
    }, [payment.paymentMethod, paymentScope]);

    // QR payment state (for QR payment method)
    const [qrData, setQrData] = useState<{
        qrUrl: string; transferCode: string; amount: number; expireAt: string; status: string;
    } | null>(null);
    const [secsLeft, setSecsLeft] = useState(0);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const cdRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const toastShownRef = useRef(false);
    const onPaymentCompleteRef = useRef(onPaymentComplete);
    useEffect(() => {
        onPaymentCompleteRef.current = onPaymentComplete;
    }, [onPaymentComplete]);

    useEffect(() => {
        if (payment.paymentMethod !== 'QR') return;
        api
            .get(`${apiBase}/payment/qr/status`)
            .then(res => {
                if (res.data.status === 'PENDING') {
                    setQrData(res.data);
                    // Countdown
                    const tick = () => {
                        const left = Math.max(0, Math.floor((new Date(res.data.expireAt).getTime() - Date.now()) / 1000));
                        setSecsLeft(left);
                    };
                    tick();
                    cdRef.current = setInterval(tick, 1000);
                    // Poll for completion
                    pollRef.current = setInterval(async () => {
                        try {
                            const s = await api.get(`${apiBase}/payment/qr/status`);
                            if (s.data.status === 'COMPLETED') {
                                clearInterval(pollRef.current!); pollRef.current = null;
                                clearInterval(cdRef.current!); cdRef.current = null;
                                if (!toastShownRef.current) {
                                    toastShownRef.current = true;
                                    toast.success('Đã thanh toán thành công! Cảm ơn bạn ủng hộ dịch vụ 🎉', { duration: 5000 });
                                }
                                setDone(true);
                                onPaymentCompleteRef.current?.();
                            } else if (s.data.status === 'EXPIRED') {
                                clearInterval(pollRef.current!); pollRef.current = null;
                                clearInterval(cdRef.current!); cdRef.current = null;
                                setQrData(prev => prev ? { ...prev, status: 'EXPIRED' } : null);
                            }
                        } catch { /* ignore */ }
                    }, 3000);
                } else if (res.data.status === 'COMPLETED') {
                    setDone(true);
                }
            })
            .catch(() => { /* QR not yet initiated */ });
        return () => {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            if (cdRef.current) { clearInterval(cdRef.current); cdRef.current = null; }
        };
    }, [requestId, payment.paymentMethod, apiBase]);

    const alreadyConfirmed = !!payment.userConfirmedAt || done;

    const handleConfirm = async () => {
        setIsConfirming(true);
        try {
            await api.patch(`${apiBase}/payment/confirm-sent`);
            toast.success('Xác nhận thành công!');
            setDone(true);
            onPaymentCompleteRef.current?.();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Xác nhận thất bại');
        } finally {
            setIsConfirming(false);
        }
    };

    const handleWalletConfirm = async () => {
        setIsConfirming(true);
        try {
            await api.patch(`${apiBase}/payment/wallet-confirm`);
            toast.success('Thanh toán ví thành công! 🎉');
            setDone(true);
            onPaymentCompleteRef.current?.();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Thanh toán thất bại');
        } finally {
            setIsConfirming(false);
        }
    };

    const handleDispute = async () => {
        if (!disputeReason.trim()) { toast.error('Vui lòng nhập lý do'); return; }
        setIsDisputing(true);
        try {
            await api.post(`${apiBase}/payment/dispute`, { reason: disputeReason });
            toast.success('Đã báo sự cố. Chúng tôi sẽ xem xét.');
            setShowDispute(false);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Gửi thất bại');
        } finally {
            setIsDisputing(false);
        }
    };

    // Parse surchargeNote: could be new {breakdown, surcharges} JSON or legacy array/text
    let breakdownItems: { label: string; amount: number }[] = [];
    let surchargeItems: { label: string; amount: number }[] = [];
    let surchargeText: string | null = null;

    if (payment.surchargeNote) {
        try {
            const parsed = JSON.parse(payment.surchargeNote);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                breakdownItems = parsed.breakdown ?? [];
                surchargeItems = parsed.surcharges ?? [];
            } else if (Array.isArray(parsed)) {
                breakdownItems = parsed;
            }
        } catch {
            surchargeText = payment.surchargeNote;
        }
    }

    const hasDetails = breakdownItems.length > 0 || surchargeItems.length > 0 || surchargeText ||
        payment.baseFee > 0 || payment.otherFee > 0;

    return (
        <>
            {/* Confetti burst when QR or WALLET payment is confirmed */}
            {done && (payment.paymentMethod === 'QR' || payment.paymentMethod === 'WALLET') && (
                <ReactConfetti
                    width={typeof window !== 'undefined' ? window.innerWidth : 400}
                    height={typeof window !== 'undefined' ? window.innerHeight : 800}
                    numberOfPieces={220}
                    recycle={false}
                    gravity={0.28}
                    colors={['#f97316', '#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#ffffff']}
                    style={{ position: 'fixed', top: 0, left: 0, zIndex: 200, pointerEvents: 'none' }}
                />
            )}

            {/* Main Card */}
            <div className="rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 12px rgba(0,0,0,0.08)' }}>
                {/* Header */}
                <div className="px-4 py-3 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #f97316, #ea6c0a)' }}>
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-xs text-white/80">{t('user.tracking.paymentRequest.title')}</p>
                        <p className="text-sm font-bold text-white">{providerName ?? t('user.tracking.paymentRequest.providerFallback')}</p>
                    </div>
                </div>

                {/* Body */}
                <div className="bg-white px-4 py-4">
                    {/* Total */}
                    <div className="text-center mb-4">
                        <p className="text-xs mb-1" style={{ color: C.gray }}>{t('user.tracking.paymentRequest.totalLabel')}</p>
                        <p className="text-3xl font-bold" style={{ color: C.orange }}>{fmt(payment.totalAmount)}</p>
                        <p className="text-xs mt-1" style={{ color: C.gray }}>
                            {t('user.tracking.paymentRequest.paidWith')} <span className="font-semibold">
                                {payment.paymentMethod === 'CASH' ? t('user.tracking.paymentRequest.methodCash')
                                    : payment.paymentMethod === 'WALLET' ? t('user.tracking.paymentRequest.methodWallet')
                                    : t('user.tracking.paymentRequest.methodQR')}
                            </span>
                        </p>
                    </div>

                    {/* Details toggle */}
                    {hasDetails && (
                        <button
                            onClick={() => setShowBreakdown(v => !v)}
                            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl mb-3"
                            style={{ background: C.bg }}
                        >
                            <span className="text-xs font-semibold" style={{ color: C.navy }}>
                                {t('user.tracking.paymentRequest.viewDetails')} {breakdownItems.length > 0 && `(${breakdownItems.length} ${t('user.tracking.paymentRequest.itemsCount')})`}
                                {surchargeItems.length > 0 && ` • ${surchargeItems.length} ${t('user.tracking.paymentRequest.surchargesCount')}`}
                            </span>
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.gray} strokeWidth={2.5}
                                className={`transition-transform ${showBreakdown ? 'rotate-180' : ''}`}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    )}

                    {showBreakdown && (
                        <div className="rounded-xl overflow-hidden mb-3" style={{ border: `1px solid ${C.border}` }}>
                            {breakdownItems.length > 0 && (
                                <>
                                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: '#eff6ff', color: '#2563eb' }}>
                                        Chi tiết
                                    </div>
                                    {breakdownItems.map(({ label, amount }: { label: string; amount: number }, i: number) => (
                                        <div key={i} className="flex justify-between px-3 py-2.5 text-sm"
                                            style={{ borderTop: `1px solid ${C.border}`, color: C.navy }}>
                                            <span style={{ color: C.gray }}>{label || `Mục ${i + 1}`}</span>
                                            <span className="font-semibold">{fmt(amount)}</span>
                                        </div>
                                    ))}
                                </>
                            )}

                            {breakdownItems.length === 0 && payment.baseFee > 0 && (
                                <div className="flex justify-between px-3 py-2.5 text-sm" style={{ color: C.navy }}>
                                    <span style={{ color: C.gray }}>{t('user.tracking.paymentRequest.serviceFee')}</span>
                                    <span className="font-semibold">{fmt(payment.baseFee)}</span>
                                </div>
                            )}

                            {surchargeItems.length > 0 && (
                                <>
                                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: '#fff7ed', color: C.orange }}>
                                        Phụ phí phát sinh
                                    </div>
                                    {surchargeItems.map(({ label, amount }: { label: string; amount: number }, i: number) => (
                                        <div key={i} className="flex justify-between px-3 py-2.5 text-sm"
                                            style={{ borderTop: `1px solid ${C.border}`, color: C.navy }}>
                                            <span style={{ color: C.gray }}>{label || `Khoản ${i + 1}`}</span>
                                            <span className="font-semibold" style={{ color: C.orange }}>+{fmt(amount)}</span>
                                        </div>
                                    ))}
                                </>
                            )}

                            {surchargeText && (
                                <div className="px-3 py-2 text-xs italic" style={{ color: C.gray, borderTop: `1px solid ${C.border}` }}>
                                    {surchargeText}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Note */}
                    {payment.note && (
                        <div className="px-3 py-2.5 rounded-xl mb-3 text-xs italic" style={{ background: C.bg, color: C.gray }}>
                            "{payment.note}"
                        </div>
                    )}

                    {/* ── Ảnh từ Provider ── */}
                    {payment.photoUrls && payment.photoUrls.length > 0 && (
                        <div className="mb-2">
                            <p className="text-xs font-semibold mb-2" style={{ color: C.navy }}>
                                 Ảnh hiện trường từ cứu hộ viên
                                <span className="font-normal ml-1" style={{ color: C.gray }}>({payment.photoUrls.length} ảnh)</span>
                            </p>
                            <div className="grid grid-cols-3 gap-1.5">
                                {payment.photoUrls.map((url: string, i: number) => (
                                    <button key={i} onClick={() => setSelectedPhoto(url)}
                                        className="aspect-square rounded-xl overflow-hidden block relative outline-none focus:ring-2 focus:ring-orange-500"
                                        style={{ background: '#f1f5f9' }}
                                    >
                                        <img src={url} alt={`Ảnh ${i + 1}`} className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Post-confirm finish state ─── */}
            {alreadyConfirmed && (
                <div className="mt-3">
                    <div
                        className="rounded-2xl p-4 mb-3 text-center"
                        style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '1.5px solid #86efac' }}
                    >
                        <div
                            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                            style={{ background: 'white', boxShadow: '0 2px 8px rgba(22,163,74,0.2)' }}
                        >
                            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <p className="text-sm font-bold mb-1" style={{ color: '#15803d' }}>
                            {t('user.tracking.paymentRequest.successTitle')}
                        </p>
                        <p className="text-xs" style={{ color: '#166534' }}
                            dangerouslySetInnerHTML={{
                                __html: payment.paymentMethod === 'WALLET'
                                    ? t('user.tracking.paymentRequest.walletSuccessDesc')
                                    : t('user.tracking.paymentRequest.cashSuccessDesc')
                            }}
                        />
                    </div>

                    <div
                        className="flex items-center justify-between px-4 py-3 rounded-xl"
                        style={{ background: C.bg }}
                    >
                        <span className="text-xs" style={{ color: C.gray }}>{t('user.tracking.paymentRequest.paidAmount')}</span>
                        <span className="text-base font-bold" style={{ color: C.orange }}>{fmt(payment.totalAmount)}</span>
                    </div>
                </div>
            )}


            {/* ─── Actions (not yet confirmed) ─── */}
            {!alreadyConfirmed && (
                <div className="mt-2 space-y-2">
                    {payment.paymentMethod === 'WALLET' && paymentScope === 'guest' ? (
                        <GuestWalletLockedCard
                            colors={RESCUE_FLOW_COLORS}
                            title={t('guest.payment.walletLocked')}
                            description={t('guest.payment.walletLockedDesc')}
                            ctaLabel={t('guest.payment.registerToUnlock')}
                        />
                    ) : payment.paymentMethod === 'WALLET' ? (
                        /* ── Wallet: show balance + confirm button ── */
                        <div className="space-y-3">
                            {/* Wallet balance card */}
                            <div
                                className="rounded-2xl p-4"
                                style={{
                                    background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                                    border: '1.5px solid #bfdbfe',
                                }}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#2563eb" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                    </svg>
                                    <p className="text-xs font-bold" style={{ color: '#1d4ed8' }}>Số dư ví của bạn</p>
                                </div>
                                {walletLoading ? (
                                    <p className="text-sm" style={{ color: '#6b7280' }}>Đang tải số dư...</p>
                                ) : (
                                    <>
                                        <p className="text-2xl font-extrabold" style={{ color: '#1d4ed8' }}>
                                            {walletBalance !== null ? fmt(walletBalance) : '--'}
                                        </p>
                                        {walletBalance !== null && walletBalance < payment.totalAmount && (
                                            <div
                                                className="mt-2 flex items-center gap-1.5 px-3 py-2 rounded-xl"
                                                style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}
                                            >
                                                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#dc2626" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                                <p className="text-xs font-semibold" style={{ color: '#dc2626' }}>
                                                    Số dư không đủ — cần thêm {fmt(payment.totalAmount - walletBalance)}
                                                </p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Confirm button */}
                            <button
                                onClick={handleWalletConfirm}
                                disabled={isConfirming || walletLoading || (walletBalance !== null && walletBalance < payment.totalAmount)}
                                className="w-full py-4 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                style={{
                                    background: (isConfirming || walletLoading || (walletBalance !== null && walletBalance < payment.totalAmount))
                                        ? C.gray
                                        : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                                    boxShadow: (isConfirming || walletLoading || (walletBalance !== null && walletBalance < payment.totalAmount))
                                        ? 'none'
                                        : '0 4px 16px rgba(37,99,235,0.4)',
                                }}
                            >
                                {isConfirming ? (
                                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                                        <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8H4z" />
                                    </svg>
                                ) : (
                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                )}
                                {isConfirming ? 'Đang xử lý...' : `Xác nhận thanh toán · ${fmt(payment.totalAmount)}`}
                            </button>

                            {/* Insufficient balance: link to top up */}
                            {walletBalance !== null && walletBalance < payment.totalAmount && (
                                <a
                                    href="/user/wallet"
                                    className="block w-full py-3 rounded-2xl text-sm font-semibold text-center transition-all"
                                    style={{ background: '#eff6ff', color: '#2563eb', border: '1.5px solid #bfdbfe' }}
                                >
                                    + Nạp thêm vào ví
                                </a>
                            )}
                        </div>
                    ) : payment.paymentMethod === 'QR' ? (
                        /* ── QR: show QR code for customer to scan ── */
                        qrData && qrData.status === 'PENDING' ? (
                            <div className="rounded-2xl overflow-hidden" style={{ border: '1.5px solid #f1f5f9' }}>
                                <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#fff7ed' }}>
                                    <div>
                                        <p className="text-xs font-bold" style={{ color: C.navy }}>Quét để thanh toán</p>
                                        <p className="text-xs" style={{ color: C.gray }}>Nội dung: <span className="font-mono font-bold" style={{ color: C.orange }}>{qrData.transferCode}</span></p>
                                    </div>
                                    <span className="text-sm font-bold tabular-nums px-2 py-1 rounded-lg" style={{
                                        background: secsLeft > 60 ? '#f0fdf4' : '#fef2f2',
                                        color: secsLeft > 60 ? '#16a34a' : '#dc2626',
                                    }}>
                                        {String(Math.floor(secsLeft / 60)).padStart(2, '0')}:{String(secsLeft % 60).padStart(2, '0')}
                                    </span>
                                </div>
                                <img src={qrData.qrUrl} alt="QR thanh toán" className="w-full" />
                                <p className="text-center text-xs py-2" style={{ color: C.gray }}>
                                    Số tiền: <span className="font-bold" style={{ color: C.orange }}>{fmt(qrData.amount)}</span> · Đang chờ xác nhận...
                                </p>
                            </div>
                        ) : qrData?.status === 'EXPIRED' ? (
                            <div className="rounded-2xl px-4 py-3 text-center text-sm" style={{ background: '#fef2f2', color: '#dc2626' }}>
                                QR đã hết hạn. Vui lòng yêu cầu provider gửi lại.
                            </div>
                        ) : (
                            <div className="rounded-2xl px-4 py-3 text-center text-sm" style={{ background: C.bg, color: C.gray }}>
                                Đang tải mã QR...
                            </div>
                        )
                    ) : (
                        /* ── Cash: keep existing confirm button ── */
                        <button
                            onClick={handleConfirm}
                            disabled={isConfirming}
                            className="w-full py-3.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                            style={{
                                background: isConfirming ? C.gray : `linear-gradient(135deg, ${C.green}, #15803d)`,
                                boxShadow: isConfirming ? 'none' : '0 4px 16px rgba(22,163,74,0.35)',
                            }}
                        >
                            {isConfirming ? (
                                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                                    <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>
                            ) : (
                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            )}
                            {t('user.tracking.paymentRequest.cashConfirmBtn')}
                        </button>
                    )}
                    {paymentScope !== 'guest' && (
                        <button
                            onClick={() => setShowDispute(true)}
                            className="w-full py-3 rounded-2xl text-sm font-semibold"
                            style={{ background: '#fef2f2', color: '#dc2626' }}
                        >
                            Báo sự cố
                        </button>
                    )}
                </div>
            )}

            {/* Dispute Modal */}
            {showDispute && (
                <div
                    className="fixed inset-0 z-[70] flex items-end"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                    onClick={() => setShowDispute(false)}
                >
                    <div
                        className="w-full px-4 pb-8 pt-5"
                        style={{ background: 'white', borderRadius: '24px 24px 0 0' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: C.border }} />
                        <h3 className="text-sm font-bold mb-1" style={{ color: C.navy }}>Báo sự cố thanh toán</h3>
                        <p className="text-xs mb-3" style={{ color: C.gray }}>Mô tả vấn đề bạn gặp phải, chúng tôi sẽ xem xét và liên hệ lại.</p>
                        <textarea
                            value={disputeReason}
                            onChange={e => setDisputeReason(e.target.value)}
                            placeholder="Ví dụ: Số tiền không khớp với thỏa thuận ban đầu..."
                            rows={3}
                            className="w-full py-2.5 px-3 rounded-xl text-sm outline-none resize-none mb-3"
                            style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.navy }}
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setShowDispute(false)}
                                className="py-3 rounded-2xl text-sm font-semibold"
                                style={{ background: C.bg, color: C.gray }}
                            >
                                Huỷ
                            </button>
                            <button
                                onClick={handleDispute}
                                disabled={isDisputing}
                                className="py-3 rounded-2xl text-sm font-bold text-white"
                                style={{ background: '#dc2626' }}
                            >
                                {isDisputing ? 'Đang gửi...' : 'Gửi báo cáo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Photo Viewer Modal */}
            {selectedPhoto && (
                <div
                    className="fixed inset-0 z-[80] flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(4px)' }}
                    onClick={() => setSelectedPhoto(null)}
                >
                    <button
                        onClick={() => setSelectedPhoto(null)}
                        className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center bg-white/10 text-white hover:bg-white/20"
                    >
                        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <img
                        src={selectedPhoto}
                        alt="View"
                        className="max-w-full max-h-full object-contain rounded-lg"
                        onClick={e => e.stopPropagation()}
                    />
                </div>
            )}
        </>
    );
}
