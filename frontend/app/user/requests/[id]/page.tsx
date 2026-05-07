'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUserGuard } from '@/lib/guards';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRequestTracking } from '@/lib/hooks/useRequestTracking';
import MatchingStatus from '@/components/MatchingStatus';
import AssignedProvider from '@/components/AssignedProvider';
import ArrivalConfirmation from '@/components/ArrivalConfirmation';
import PaymentRequest from '@/components/PaymentRequest';
import CreateDisputeSheet from '@/components/CreateDisputeSheet';
import ExpiredRetry from '@/components/ExpiredRetry';
import QuoteSelectionPanel from '@/components/QuoteSelectionPanel';
import RescueProgressTimeline from '@/components/RescueProgressTimeline';
import AvatarImage from '@/components/AvatarImage';
import NearbyShopsSheet from '@/components/NearbyShopsSheet';
import { Clock, Banknote, User, Wrench, CheckCircle2, Image as ImageIcon, Play, Phone } from 'lucide-react';
import api, { userDisputeApi } from '@/lib/api';
import { displayOrderCode } from '@/lib/reconciliation';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';

const ProviderTrackingMap = dynamic(() => import('@/components/ProviderTrackingMap'), { ssr: false });

const C = {
    orange: '#f97316',
    orangeDark: '#ea6c0a',
    orangeLight: '#fff7ed',
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#f1f5f9',
    bg: '#f8fafc',
    blue: '#3b82f6',
    blueLight: '#eff6ff',
    green: '#16a34a',
    greenLight: '#f0fdf4',
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
    const { t, locale } = useLanguage();
    const numLocale = locale === 'vi' ? 'vi-VN' : 'en-US';
    const providerName = quote.provider.serviceName || quote.provider.name || t('user.tracking.paymentRequest.providerFallback');
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
                            {quote.price.toLocaleString(numLocale)}₫
                        </span>
                        <span className="text-[11px]" style={{ color: C.gray }}>·</span>
                        <span className="text-[11px]" style={{ color: C.gray }}>
                            {t('user.tracking.quotes.approxMinutes', { minutes: quote.estimatedArrivalMinutes })}
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
                    ) : t('user.tracking.quotes.acceptBtn')}
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
    const { t } = useLanguage();
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
        const pollId = setInterval(load, 5000);
        return () => { active = false; clearInterval(pollId); };
    }, [requestId]);

    if (loading) return (
        <div className="bg-white rounded-2xl p-6 text-center" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <p className="text-sm" style={{ color: '#6b7280' }}>{t('user.tracking.page.paymentLoading')}</p>
        </div>
    );
    if (!payment) return (
        <div className="bg-white rounded-2xl p-6 text-center" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <p className="text-sm" style={{ color: '#6b7280' }}>{t('user.tracking.page.paymentPendingEmpty')}</p>
        </div>
    );
    return <PaymentRequest requestId={requestId} payment={payment} providerName={providerName} />;
}

// ── Completed Card shown after job is COMPLETED ────────────────────────────

// ── Layout Components ──
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.orangeLight }}>
                {icon}
            </div>
            <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.gray }}>{label}</p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: C.navy }}>{value}</p>
            </div>
        </div>
    );
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <div className="px-5 py-4 flex items-center gap-2.5" style={{ borderBottom: `1px solid ${C.border}` }}>
                {icon}
                <h3 className="text-sm font-bold" style={{ color: C.navy }}>{title}</h3>
            </div>
            <div className="px-5 py-4 space-y-4">{children}</div>
        </div>
    );
}

function StarIcon({ filled, size = 32 }: { filled: boolean; size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? '#f59e0b' : 'none'} stroke={filled ? '#f59e0b' : '#d1d5db'} strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
    );
}

function CompletedCard({ requestId }: { requestId: string }) {
    const router = useRouter();
    const { t, locale } = useLanguage();
    const numLocale = locale === 'vi' ? 'vi-VN' : 'en-US';
    const timeLocale = locale === 'vi' ? 'vi-VN' : 'en-US';
    const [request, setRequest] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    // State for viewing photos in full-screen modal
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

    useEffect(() => {
        api.get(`/rescue-requests/${requestId}`)
            .then(res => setRequest(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [requestId]);

    const [showDispute, setShowDispute] = useState(false);
    const [existingDispute, setExistingDispute] = useState<{ id: string; status: string } | null>(null);

    useEffect(() => {
        let active = true;
        userDisputeApi
            .getMyDisputes()
            .then((res) => {
                if (!active) return;
                const found = (res.items as any[]).find((it) => it?.payment?.requestId === requestId);
                setExistingDispute(found ? { id: found.id, status: found.status } : null);
            })
            .catch(() => {
                if (active) setExistingDispute(null);
            });
        return () => {
            active = false;
        };
    }, [requestId, showDispute]);

    // Review state
    const [hoveredStar, setHoveredStar] = useState(0);
    const [selectedStar, setSelectedStar] = useState(0);
    const [comment, setComment] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [reviewSubmitted, setReviewSubmitted] = useState(false);

    if (loading) {
        return (
            <div className="px-5 py-8 text-center bg-white">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-3" style={{ borderColor: C.orange }}></div>
                <p className="text-sm font-medium" style={{ color: C.gray }}>{t('user.tracking.completed.loadingDetails')}</p>
            </div>
        );
    }

    if (!request) return null;

    const payment = request?.payment;
    const acceptedQuote = request?.quotes?.[0]; // backend only returns ACCEPTED
    const images = (request?.media ?? []).filter((m: any) => m.mediaType === 'IMAGE').map((m: any) => m.publicUrl);
    const videos = (request?.media ?? []).filter((m: any) => m.mediaType === 'VIDEO').map((m: any) => m.publicUrl);

    const quickTags: string[] = t('user.tracking.review.quickTags') as unknown as string[];

    const toggleTag = (tag: string) => {
        setSelectedTags(prev =>
            prev.includes(tag) ? prev.filter(tg => tg !== tag) : [...prev, tag]
        );
    };

    const handleReviewSubmit = async () => {
        if (selectedStar === 0) { toast.error(t('user.tracking.review.requireStars')); return; }
        setIsSubmitting(true);
        try {
            await api.post(`/rescue-requests/${requestId}/review`, {
                rating: selectedStar,
                comment: comment.trim() || undefined,
                tags: selectedTags,
            });
            setReviewSubmitted(true);
            toast.success(t('user.tracking.review.successToast'));
        } catch (err: any) {
            const msg = err.response?.data?.message || t('user.tracking.review.errorToast');
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
                    <h3 className="text-lg font-bold mb-1" style={{ color: '#15803d' }}>{t('user.tracking.completed.title')}</h3>
                    <p className="text-sm" style={{ color: '#166534' }}>
                        {t('user.tracking.completed.subtitle')}
                    </p>
                </div>

                {/* ── Request Details ── */}
                <div className="px-5 py-4 space-y-4 bg-white" style={{ borderBottom: `1px solid ${C.border}` }}>

                    {/* ── Timeline ── */}
                    <SectionCard title={t('user.tracking.timeline.title')} icon={<Clock size={16} style={{ color: C.blue }} />}>
                        <div className="space-y-0">
                            {[
                                { label: t('user.tracking.timeline.created'), time: request?.createdAt, done: true },
                                { label: t('user.tracking.timeline.assigned'), time: request?.assignedAt, done: !!request?.assignedAt },
                                { label: t('user.tracking.timeline.payment'), time: payment?.createdAt, done: !!payment },
                                { label: t('user.tracking.timeline.completed'), time: request?.completedAt || request?.updatedAt, done: true },
                            ].map((step, i, arr) => (
                                <div key={i} className="flex gap-3">
                                    <div className="flex flex-col items-center">
                                        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                                            style={{
                                                background: step.done ? C.orange : '#f1f5f9',
                                                border: `2px solid ${step.done ? C.orange : C.border}`,
                                            }}>
                                            {step.done
                                                ? <CheckCircle2 size={13} className="text-white" />
                                                : <Clock size={11} style={{ color: C.gray }} />
                                            }
                                        </div>
                                        {i < arr.length - 1 && (
                                            <div className="w-0.5 h-8 mt-0.5"
                                                style={{ background: step.done ? `${C.orange}40` : '#f1f5f9' }} />
                                        )}
                                    </div>
                                    <div className="pb-4">
                                        <p className="text-sm font-semibold" style={{ color: step.done ? C.navy : '#9ca3af' }}>
                                            {step.label}
                                        </p>
                                        <p className="text-xs mt-0.5" style={{ color: step.time ? C.gray : '#d1d5db' }}>
                                            {step.time ? new Date(step.time).toLocaleString(timeLocale, {
                                                day: '2-digit', month: '2-digit', year: 'numeric',
                                                hour: '2-digit', minute: '2-digit',
                                            }) : t('user.tracking.timeline.pending')}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </SectionCard>

                    {/* ── Provider Info ── */}
                    {request?.assignedProvider && (
                        <SectionCard title={t('user.tracking.providerInfo.title')} icon={<User size={16} style={{ color: C.blue }} />}>
                            <div className="flex items-center gap-3">
                                <AvatarImage
                                    name={request.assignedProvider.name}
                                    avatar={request.assignedProvider.avatar}
                                    className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                                    fallbackBackground={`linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`}
                                    initialsCount={1}
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold" style={{ color: C.navy }}>{request.assignedProvider.name}</p>
                                    <p className="text-xs mt-0.5" style={{ color: C.gray }}>{request.assignedProvider.phoneNumber || 'N/A'}</p>
                                </div>
                                {request.assignedProvider.phoneNumber && (
                                    <a href={`tel:${request.assignedProvider.phoneNumber}`}
                                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                                        style={{ background: C.greenLight }}>
                                        <Phone size={14} style={{ color: C.green }} />
                                    </a>
                                )}
                            </div>

                            <div className="space-y-3 mt-3 pt-3" style={{ borderTop: `1px dashed ${C.border}` }}>
                                {request.assignedProvider.licensePlate && (
                                    <InfoRow
                                        icon={<span style={{ color: C.orange, fontSize: 11, fontWeight: 700 }}>BSX</span>}
                                        label={t('user.tracking.providerInfo.licensePlate')}
                                        value={request.assignedProvider.licensePlate}
                                    />
                                )}
                                {(request.assignedProvider.vehicleColor || request.assignedProvider.vehicleType) && (
                                    <InfoRow
                                        icon={<span style={{ color: C.orange, fontSize: 11, fontWeight: 700 }}>XE</span>}
                                        label={t('user.tracking.providerInfo.vehicle')}
                                        value={[request.assignedProvider.vehicleColor, request.assignedProvider.vehicleType].filter(Boolean).join(' - ')}
                                    />
                                )}
                            </div>
                        </SectionCard>
                    )}

                    {/* ── Quote Info ── */}
                    {acceptedQuote && (
                        <SectionCard title={t('user.tracking.providerQuote.title')} icon={<Wrench size={16} style={{ color: C.orange }} />}>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <div className="rounded-xl p-3" style={{ background: C.bg }}>
                                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: C.gray }}>{t('user.tracking.providerQuote.price')}</p>
                                    <p className="text-lg font-bold" style={{ color: C.navy }}>{acceptedQuote.price.toLocaleString(numLocale)} đ</p>
                                </div>
                                <div className="rounded-xl p-3" style={{ background: C.bg }}>
                                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: C.gray }}>{t('user.tracking.providerQuote.eta')}</p>
                                    <p className="text-lg font-bold" style={{ color: C.navy }}>{t('user.tracking.providerQuote.etaMinutes', { minutes: acceptedQuote.estimatedArrivalMinutes })}</p>
                                </div>
                            </div>
                            {acceptedQuote.message && (
                                <div className="rounded-xl p-3" style={{ background: '#fff7ed', border: `1px solid #fed7aa` }}>
                                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: C.orange }}>{t('user.tracking.providerQuote.message')}</p>
                                    <p className="text-sm" style={{ color: C.navy }}>"{acceptedQuote.message}"</p>
                                </div>
                            )}
                        </SectionCard>
                    )}

                    {/* ── Payment Info ── */}
                    {payment && (
                        <SectionCard title={t('user.tracking.paymentInfo.title')} icon={<Banknote size={16} style={{ color: C.orange }} />}>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <div className="rounded-xl p-3" style={{ background: C.bg }}>
                                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: C.gray }}>{t('user.tracking.paymentInfo.methodLabel')}</p>
                                    <p className="text-sm font-bold" style={{ color: C.navy }}>
                                        {payment.paymentMethod === 'WALLET'
                                            ? t('user.tracking.paymentInfo.methodWallet')
                                            : payment.paymentMethod === 'CASH'
                                                ? t('user.tracking.paymentInfo.methodCash')
                                                : t('user.tracking.paymentInfo.methodQR')}
                                    </p>
                                </div>
                                <div className="rounded-xl p-3" style={{ background: C.bg }}>
                                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: C.gray }}>{t('user.tracking.paymentInfo.totalLabel')}</p>
                                    <p className="text-sm font-bold" style={{ color: C.orange }}>{payment.totalAmount.toLocaleString(numLocale)} đ</p>
                                </div>
                            </div>
                            <div className="rounded-xl overflow-hidden border" style={{ borderColor: C.border }}>
                                {[
                                    { label: t('user.tracking.paymentInfo.baseFee'), val: payment.baseFee },
                                    { label: t('user.tracking.paymentInfo.distanceFee'), val: payment.distanceFee },
                                    (payment.overtimeFee || 0) > 0 && { label: t('user.tracking.paymentInfo.overtimeFee'), val: payment.overtimeFee },
                                    (payment.otherFee || 0) > 0 && { label: t('user.tracking.paymentInfo.otherFee'), val: payment.otherFee },
                                ].filter(Boolean).map((row: any, i: number, arr) => (
                                    <div key={i} className="flex items-center justify-between px-4 py-2.5"
                                        style={{ borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                                        <span className="text-xs" style={{ color: C.gray }}>{row.label}</span>
                                        <span className="text-xs font-semibold" style={{ color: C.navy }}>{(row.val || 0).toLocaleString(numLocale)} đ</span>
                                    </div>
                                ))}
                                <div className="flex items-center justify-between px-4 py-3"
                                    style={{ background: '#f8fafc', borderTop: `1px solid ${C.border}` }}>
                                    <span className="text-sm font-bold" style={{ color: C.navy }}>{t('user.tracking.paymentInfo.totalPayment')}</span>
                                    <span className="text-sm font-bold" style={{ color: C.orange }}>{payment.totalAmount.toLocaleString(numLocale)} đ</span>
                                </div>
                            </div>
                            {/* Parsed surchargeNote breakdown */}
                            {(() => {
                                if (!payment.surchargeNote) return null;
                                try {
                                    const parsed = JSON.parse(payment.surchargeNote);
                                    const breakdown = parsed?.breakdown ?? [];
                                    const surcharges = parsed?.surcharges ?? [];
                                    if (breakdown.length === 0 && surcharges.length === 0) return null;
                                    return (
                                        <div className="mt-3 rounded-xl overflow-hidden border" style={{ borderColor: C.border }}>
                                            {breakdown.length > 0 && (
                                                <>
                                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: '#eff6ff', color: '#2563eb' }}>{t('user.tracking.paymentInfo.surchargeDetails')}</div>
                                    {breakdown.map((item: { label: string; amount: number }, i: number) => (
                                        <div key={i} className="flex justify-between px-3 py-2 text-xs"
                                            style={{ borderTop: `1px solid ${C.border}`, color: C.navy }}>
                                            <span style={{ color: C.gray }}>{item.label || t('user.tracking.paymentInfo.surchargeItemFallback', { index: i + 1 })}</span>
                                            <span className="font-semibold">{(item.amount || 0).toLocaleString(numLocale)}đ</span>
                                        </div>
                                    ))}
                                                </>
                                            )}
                                            {surcharges.length > 0 && (
                                                <>
                                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: '#fff7ed', color: C.orange }}>{t('user.tracking.paymentInfo.surchargeExtra')}</div>
                                    {surcharges.map((item: { label: string; amount: number }, i: number) => (
                                        <div key={i} className="flex justify-between px-3 py-2 text-xs"
                                            style={{ borderTop: `1px solid ${C.border}`, color: C.navy }}>
                                            <span style={{ color: C.gray }}>{item.label || t('user.tracking.paymentInfo.surchargeEntryFallback', { index: i + 1 })}</span>
                                            <span className="font-semibold" style={{ color: C.orange }}>+{(item.amount || 0).toLocaleString(numLocale)}đ</span>
                                        </div>
                                    ))}
                                                </>
                                            )}
                                        </div>
                                    );
                                } catch {
                                    return <p className="text-xs mt-3 italic" style={{ color: C.gray }}>{payment.surchargeNote}</p>;
                                }
                            })()}
                            {/* Payment photos from provider */}
                            {payment.photoUrls && payment.photoUrls.length > 0 && (
                                <div className="mt-4">
                                    <p className="text-xs font-semibold mb-2" style={{ color: C.navy }}>
                                        {t('user.tracking.paymentInfo.photoTitle')}
                                        <span className="font-normal ml-1" style={{ color: C.gray }}>{t('user.tracking.paymentInfo.photoCount', { count: payment.photoUrls.length })}</span>
                                    </p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {payment.photoUrls.map((url: string, i: number) => (
                                            <button key={i} onClick={() => setSelectedPhoto(url)}
                                                className="aspect-square rounded-xl overflow-hidden block outline-none focus:ring-2 focus:ring-orange-500"
                                                style={{ background: '#f1f5f9' }}
                                            >
                                                <img src={url} alt={t('user.tracking.mediaGallery.photoAlt', { index: i + 1 })} className="w-full h-full object-cover" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </SectionCard>
                    )}

                    {/* ── Media ── */}
                    {(images.length > 0 || videos.length > 0) && (
                        <SectionCard
                            title={t('user.tracking.mediaGallery.title', { count: images.length + videos.length })}
                            icon={<ImageIcon size={16} style={{ color: C.blue }} />}
                        >
                            {images.length > 0 && (
                                <div className="grid grid-cols-3 gap-2">
                                    {images.map((src: string, i: number) => (
                                        <div key={i} className="aspect-square rounded-xl overflow-hidden relative" style={{ background: '#f1f5f9' }}>
                                            <img src={src} alt={t('user.tracking.mediaGallery.photoAlt', { index: i + 1 })} className="w-full h-full object-cover" />
                                        </div>
                                    ))}
                                </div>
                            )}
                            {videos.length > 0 && (
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    {videos.map((src: string, i: number) => (
                                        <div key={i} className="rounded-xl overflow-hidden aspect-video bg-black relative">
                                            <video src={src} controls className="w-full h-full object-cover" />
                                            <div className="absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center"
                                                style={{ background: 'rgba(0,0,0,0.5)' }}>
                                                <Play size={10} className="text-white" style={{ marginLeft: 1 }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </SectionCard>
                    )}
                </div>

                {/* ── Rating block (primary action) ── */}
                <div className="px-5 pt-5 pb-4">
                    {(reviewSubmitted || request?.review) ? (
                        /* ── Thank-you state ── */
                        <div
                            className="flex flex-col items-center gap-2 py-4 rounded-2xl"
                            style={{ background: '#fffbeb' }}
                        >
                            <span style={{ fontSize: '28px' }}>⭐</span>
                            <p className="text-sm font-bold" style={{ color: '#92400e' }}>{t('user.tracking.review.thanksTitle')}</p>
                            <div className="flex gap-0.5 mt-1">
                                {[1, 2, 3, 4, 5].map(s => (
                                    <StarIcon key={s} filled={s <= (request?.review?.rating || selectedStar)} size={20} />
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
                                <p className="text-sm font-bold" style={{ color: C.navy }}>{t('user.tracking.review.formTitle')}</p>
                                <p className="text-[11px] mt-0.5" style={{ color: C.gray }}>{t('user.tracking.review.formHint')}</p>
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
                                    {(t('user.tracking.review.ratings') as unknown as string[])[selectedStar]}
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
                                            {quickTags.map(tag => {
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
                                            placeholder={t('user.tracking.review.commentPlaceholder')}
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
                                                    {t('user.tracking.review.submittingBtn')}
                                                </span>
                                            ) : t('user.tracking.review.submitBtn')}
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
                        {t('user.tracking.actions.homeBtn')}
                    </button>
                    {payment?.id && !existingDispute && (
                        <button
                            type="button"
                            onClick={() => setShowDispute(true)}
                            className="w-full py-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5"
                            style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }}
                        >
                            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            {t('user.tracking.actions.disputeBtn')}
                        </button>
                    )}
                    {payment?.id && existingDispute && (
                        <div className="space-y-2">
                            <div
                                className="w-full py-2 px-3 rounded-2xl text-xs font-semibold text-center"
                                style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }}
                            >
                                {t('user.tracking.dispute.pendingLabel')} · {(() => {
                                    const key = `user.tracking.dispute.statusLabels.${existingDispute.status}`;
                                    const label = t(key);
                                    return label === key ? existingDispute.status : label;
                                })()}
                            </div>
                            <button
                                type="button"
                                onClick={() => router.push(`/user/disputes/${existingDispute.id}`)}
                                className="w-full py-3 rounded-2xl text-xs font-semibold"
                                style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
                            >
                                {t('user.tracking.dispute.viewStatus')}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {payment?.id && (
                <CreateDisputeSheet
                    open={showDispute}
                    onClose={() => setShowDispute(false)}
                    requestId={requestId}
                    paymentId={payment.id}
                    totalAmount={payment.totalAmount}
                    commissionRate={payment.commissionRate}
                />
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

export default function RequestTrackingPage() {

    const router = useRouter();
    const params = useParams();
    const requestId = params.id as string;
    const { t, locale } = useLanguage();
    const { isReady } = useUserGuard();
    const [isRetrying, setIsRetrying] = useState(false);
    const [showQuoteSelection, setShowQuoteSelection] = useState(false);
    const [isNearbySheetOpen, setIsNearbySheetOpen] = useState(false);
    const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [showTrackingMap, setShowTrackingMap] = useState(false);

    // Grab user coords once for nearby shops
    useEffect(() => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => { }, // ignore errors silently
                { enableHighAccuracy: true, timeout: 8000 },
            );
        }
    }, []);

    // Live quotes state (during countdown)
    const [liveQuotes, setLiveQuotes] = useState<Quote[]>([]);
    const [acceptingId, setAcceptingId] = useState<string | null>(null);

    const { status, isLoading, error, timeRemaining, quoteWindowJustClosed, gracePeriodSecondsRemaining, cancelRequest } = useRequestTracking({
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

    // ── Auto-close tracking map when provider arrives ─────────────────────────
    useEffect(() => {
        if (showTrackingMap && status?.status && status.status !== 'IN_PROGRESS') {
            setShowTrackingMap(false);
            toast.success(t('user.tracking.page.mapMinimizedToast'));
        }
    }, [status?.status, showTrackingMap, t]);

    // ── Accept quote during countdown ────────────────────────────────────────
    const handleAcceptLiveQuote = async (quoteId: string) => {
        if (acceptingId) return;
        setAcceptingId(quoteId);
        try {
            await api.patch(`/rescue-requests/${requestId}/quotes/${quoteId}/respond`, {
                action: 'ACCEPT',
            });
            toast.success(t('user.tracking.quotes.successToast'));
            // Tracking hook will poll and catch ASSIGNED status automatically
        } catch (err: any) {
            const msg = err.response?.data?.message || t('user.tracking.quotes.errorToast');
            toast.error(msg);
            setAcceptingId(null);
        }
    };

    const handleCancel = async () => {
        const confirmed = window.confirm(t('user.tracking.page.cancelConfirm'));
        if (!confirmed) return;
        const success = await cancelRequest();
        if (success) {
            toast.success(t('user.tracking.page.cancelSuccess'));
            router.push('/user/requests');
        }
    };

    const handleRetry = () => {
        // Retry = create a new request from the home page
        router.push('/user');
    };

    if (!isReady || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-3" style={{ borderColor: C.orange }}></div>
                    <p className="text-sm" style={{ color: C.gray }}>{t('user.tracking.page.loading')}</p>
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
                    <h3 className="text-base font-bold mb-2" style={{ color: C.navy }}>{t('user.tracking.page.errorTitle')}</h3>
                    <p className="text-sm mb-5" style={{ color: C.gray }}>{error}</p>
                    <button onClick={() => router.push('/user/requests')} className="w-full py-2.5 rounded-xl font-semibold text-sm text-white" style={{ background: C.orange }}>
                        {t('user.tracking.page.backBtn')}
                    </button>
                </div>
            </div>
        );
    }

    if (!status) return null;

    const timeLocale = locale === 'vi' ? 'vi-VN' : 'en-US';
    const statusTKey = `user.tracking.status.${status.status}`;
    const statusLabelText = (() => {
        const s = t(statusTKey);
        return s === statusTKey ? status.status : s;
    })();
    const incidentTKey = status.incidentType ? `provider.incidents.${status.incidentType}` : '';
    const incidentLabelText = status.incidentType
        ? (() => {
            const s = t(incidentTKey);
            return s === incidentTKey ? status.incidentType! : s;
        })()
        : t('user.tracking.page.emergency');

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
                    <h1 className="font-bold text-sm leading-tight" style={{ color: C.navy }}>{t('user.tracking.title')}</h1>
                    <p className="text-xs truncate" style={{ color: C.gray }}>#{displayOrderCode(status.orderCode, requestId)}</p>
                </div>
                {/* Status chip */}
                <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0"
                    style={{ background: statusStyle.bg, color: statusStyle.text }}
                >
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: statusStyle.dot }}></div>
                    {statusLabelText}
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
                            {incidentLabelText}
                        </p>
                        {status.pickupLocation?.addressText && (
                            <p className="text-xs truncate mt-0.5" style={{ color: C.gray }}>
                                {status.pickupLocation.addressText}
                            </p>
                        )}
                    </div>
                    <div className="text-right flex-shrink-0">
                        <p className="text-[10px]" style={{ color: C.gray }}>{t('user.tracking.page.createdAt')}</p>
                        <p className="text-xs font-medium" style={{ color: C.navy }}>
                            {status.createdAt ? new Date(status.createdAt).toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Two-phase progress timeline (same UX as guest) ── */}
            <div className="px-4 pt-3 max-w-2xl mx-auto w-full">
                <RescueProgressTimeline
                    status={status.status}
                    quoteCount={status.quoteCount ?? 0}
                    labels={{
                        sent: t('user.tracking.progressTimeline.sent'),
                        searching: t('user.tracking.progressTimeline.searching'),
                        chooseQuote: t('user.tracking.progressTimeline.chooseQuote'),
                        moving: t('user.tracking.progressTimeline.moving'),
                        working: t('user.tracking.progressTimeline.working'),
                        payment: t('user.tracking.progressTimeline.payment'),
                        done: t('user.tracking.progressTimeline.done'),
                    }}
                />
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

                {/* Nearby Shops Banner — shown during MATCHING while waiting for providers */}
                {isMatchingWithWindowOpen && liveQuotes.length === 0 && (
                    <button
                        id="nearby-shops-matching-btn"
                        onClick={() => setIsNearbySheetOpen(true)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all active:scale-[0.98]"
                        style={{
                            background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
                            border: '1.5px solid #86efac',
                        }}
                    >
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: 'white', boxShadow: '0 2px 8px rgba(22,163,74,0.15)' }}
                        >
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </div>
                        <div className="flex-1 text-left">
                            <p className="text-sm font-bold" style={{ color: '#15803d' }}>
                                {t('user.tracking.page.nearbyWhileWaitingTitle')} — {t('user.dashboard.nearbyShops.cardTitle')}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: '#16a34a' }}>
                                {t('user.dashboard.nearbyShops.cardSubtitle')}
                            </p>
                        </div>
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                )}

                {/* ── Live Quote Cards (during countdown) ── */}
                {isMatchingWithWindowOpen && liveQuotes.length > 0 && (
                    <div className="space-y-3">
                        {/* Section header */}
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#22c55e' }} />
                            <p className="text-xs font-semibold" style={{ color: C.navy }}>
                                {t('user.tracking.quotes.newHeader')}
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
                            {t('user.tracking.quotes.countdownActive')}
                        </p>
                    </div>
                )}

                {/* MATCHING state — window closed + has quotes → full selection panel */}
                {(status.status === 'MATCHING' || status.status === 'SEARCHING') && showQuoteSelection && (
                    <QuoteSelectionPanel
                        requestId={requestId}
                        quoteCount={status.quoteCount ?? 0}
                        gracePeriodSecondsRemaining={gracePeriodSecondsRemaining}
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

                {/* ── Live Tracking Map CTA — only when provider is moving ── */}
                {status.status === 'IN_PROGRESS' && status.assignedProvider && status.pickupLocation && (
                    <button
                        id="open-tracking-map-btn"
                        onClick={() => setShowTrackingMap(true)}
                        className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all active:scale-[0.98]"
                        style={{
                            background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`,
                            boxShadow: `0 4px 16px ${C.orange}40`,
                        }}
                    >
                        <div className="relative flex-shrink-0">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white/20">
                                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={1.8}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                </svg>
                            </div>
                        </div>
                        <div className="flex-1 text-left">
                            <p className="font-bold text-sm text-white">
                                {t('user.tracking.page.openMapTitle')}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1.5">
                                <div className="w-1.5 h-1.5 rounded-full animate-pulse bg-white" />
                                <span className="text-[10px] font-semibold text-white">{t('user.tracking.page.liveBadge')}</span>
                                {status.matchedEta ? (
                                    <span className="text-[10px] text-white/80">
                                        {t('user.tracking.page.etaApprox', { minutes: status.matchedEta })}
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-white/80">
                                        {t('user.tracking.page.trackSubline')}
                                    </span>
                                )}
                            </div>
                        </div>
                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
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
                        <h3 className="text-sm font-bold mb-1" style={{ color: '#15803d' }}>{t('user.tracking.page.workingTitle')}</h3>
                        <p className="text-xs mb-2" style={{ color: '#6b7280' }}>
                            {t('user.tracking.page.workingDesc')}
                        </p>
                        <p className="text-xs" style={{ color: '#9ca3af' }}>
                            {t('user.tracking.page.workingNote')}
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
                        <h3 className="text-sm font-bold mb-1" style={{ color: C.navy }}>{t('user.tracking.page.cancelledTitle')}</h3>
                        <p className="text-xs mb-5" style={{ color: C.gray }}>{t('user.tracking.page.cancelledDesc')}</p>
                        <button
                            onClick={() => router.push('/user')}
                            className="w-full py-3 rounded-xl text-sm font-bold text-white"
                            style={{ background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})` }}
                        >
                            {t('user.tracking.page.homeBtn')}
                        </button>
                    </div>
                )}
            </div>

            {/* Nearby Shops Bottom Sheet */}
            <NearbyShopsSheet
                isOpen={isNearbySheetOpen}
                onClose={() => setIsNearbySheetOpen(false)}
                userLat={userCoords?.lat ?? status.pickupLocation?.lat}
                userLng={userCoords?.lng ?? status.pickupLocation?.lng}
            />

            {/* ── Real-time Provider Tracking Map (fullscreen overlay) ── */}
            {showTrackingMap && status.pickupLocation && (
                <ProviderTrackingMap
                    requestId={requestId}
                    customerLat={status.pickupLocation.lat}
                    customerLng={status.pickupLocation.lng}
                    customerAddress={status.pickupLocation.addressText}
                    providerName={status.assignedProvider?.name}
                    providerAvatar={status.assignedProvider?.avatar}
                    providerPhone={status.assignedProvider?.phoneNumber}
                    matchedEta={status.matchedEta}
                    onClose={() => setShowTrackingMap(false)}
                />
            )}
        </div>
    );
}
