'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { displayOrderCode } from '@/lib/reconciliation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    ArrowLeft, CheckCircle2, Clock, XCircle, MapPin, Phone,
    Banknote, Star, FileText, Wrench, Car, Calendar,
    RefreshCw, Image as ImageIcon, Play, User, ExternalLink, Wallet,
} from 'lucide-react';
import AvatarImage from '@/components/AvatarImage';


const C = {
    orange: '#f97316', orangeDark: '#ea6c0a', orangeLight: '#fff7ed',
    navy: '#1a1a2e', gray: '#6b7280', border: '#f1f5f9', bg: '#f4f6f9',
    green: '#16a34a', greenLight: '#f0fdf4',
    red: '#ef4444', redLight: '#fef2f2',
    blue: '#2563eb', blueLight: '#eff6ff',
    yellow: '#f59e0b',
};

function fmtVnd(n: number) {
    return new Intl.NumberFormat('vi-VN').format(n) + 'đ';
}

function fmtDateTime(iso: string) {
    return new Date(iso).toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

/* ── Lightbox ── */
function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={onClose}>
            <button className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.15)' }} onClick={onClose}>
                <XCircle className="w-5 h-5 text-white" />
            </button>
            <img src={src} alt="" className="max-w-full max-h-[90vh] rounded-xl object-contain"
                onClick={e => e.stopPropagation()} />
        </div>
    );
}

/* ── Stars ── */
function Stars({ rating }: { rating: number }) {
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} className="w-4 h-4"
                    fill={i <= rating ? C.yellow : 'none'}
                    stroke={i <= rating ? C.yellow : '#d1d5db'} />
            ))}
        </div>
    );
}

/* ── Info Row ── */
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

/* ── Section Card ── */
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

/* ── Status Badge ── */
/** Header badge when viewer is not the assigned provider — reflects *your* quote, not đơn hàng. */
function HistoryDetailLoserHeaderBadge({ req, quote, userId }: { req: any; quote: any; userId?: string }) {
    const { t } = useLanguage();
    const assignee = req.assignedProviderId ?? null;
    const qs = quote?.status;
    const pill = (bg: string, color: string, label: string) => (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold"
            style={{ background: bg, color }}>{label}</span>
    );
    if (!quote) {
        return pill('#f3f4f6', C.gray, t('provider.historyDetail.quoteStatusBadge.NOT_SELECTED'));
    }
    if (qs === 'REJECTED') {
        return pill('#fef2f2', '#b91c1c', t('provider.historyDetail.quoteStatusBadge.REJECTED'));
    }
    if (qs === 'PENDING' && req.status === 'MATCHING') {
        return pill('#fefce8', '#ca8a04', t('provider.historyDetail.quoteStatusBadge.AWAITING_CUSTOMER'));
    }
    if (qs === 'CANCELLED' || qs === 'EXPIRED') {
        return pill('#fff7ed', '#9a3412', t('provider.historyDetail.quoteStatusBadge.NOT_SELECTED'));
    }
    if (qs === 'PENDING' && assignee && userId && assignee !== userId) {
        return pill('#fff7ed', '#9a3412', t('provider.historyDetail.quoteStatusBadge.NOT_SELECTED'));
    }
    return pill('#fff7ed', '#9a3412', t('provider.historyDetail.quoteStatusBadge.NOT_SELECTED'));
}

function StatusBadge({ status }: { status: string }) {
    const { t } = useLanguage();
    const cfg: Record<string, { color: string; bg: string }> = {
        COMPLETED: { color: C.green, bg: C.greenLight },
        PAID: { color: '#7c3aed', bg: '#f5f3ff' },
        PAYMENT_PENDING: { color: '#ca8a04', bg: '#fefce8' },
        PROVIDER_CONFIRMED: { color: C.green, bg: C.greenLight },
        USER_CONFIRMED: { color: C.blue, bg: C.blueLight },
        PENDING: { color: '#ca8a04', bg: '#fefce8' },
        DISPUTED: { color: C.red, bg: C.redLight },
        IN_PROGRESS: { color: '#ca8a04', bg: '#fefce8' },
        WORKING: { color: '#ca8a04', bg: '#fefce8' },
        CANCELLED: { color: '#6b7280', bg: '#f3f4f6' },
        EXPIRED: { color: '#6b7280', bg: '#f3f4f6' },
    };
    const s = cfg[status] ?? { color: C.gray, bg: '#f3f4f6' };
    const label = t(`provider.historyDetail.statusBadge.${status}` as any) || status;
    return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold"
            style={{ background: s.bg, color: s.color }}>
            {label}
        </span>
    );
}

/* ═══════════════════════════ Main Page ═══════════════════════════ */
export default function HistoryJobDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { user, loading: authLoading } = useAuth();
    const { t } = useLanguage();
    const requestId = params.id as string;

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

    const fetchDetail = useCallback(async () => {
        if (!requestId) return;
        setLoading(true); setError('');
        try {
            // Get full request info via provider-view (includes user, media, location, etc.)
            const res = await api.get(`/rescue-requests/${requestId}/provider-view`);
            const req = res.data;

            let quote = null;
            try {
                const quotesRes = await api.get(`/rescue-requests/${requestId}/quotes`);
                const quotes = quotesRes.data ?? [];
                quote = quotes.find((q: any) => q.providerId === user?.id) ?? null;
            } catch { /* ignore */ }

            // Payment info (GET /rescue-requests/:id/payment)
            let payment = null;
            try {
                const payRes = await api.get(`/rescue-requests/${requestId}/payment`);
                payment = payRes.data;
            } catch { /* ignore */ }

            // Review: pull from the nested `review` field on the request if included
            // The service may or may not include it — degrade gracefully
            const review = req.review ?? null;

            setData({ req, quote, payment, review });
        } catch (e: any) {
            setError(e?.response?.data?.message || t('provider.historyDetail.loadError'));
        } finally {
            setLoading(false);
        }
    }, [requestId, user?.id]);

    useEffect(() => {
        if (!authLoading && !user) { router.push('/auth/login'); return; }
        if (user) fetchDetail();
    }, [authLoading, user, fetchDetail]);

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
                <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="w-8 h-8 animate-spin" style={{ color: C.orange }} />
                    <p className="text-sm" style={{ color: C.gray }}>{t('provider.historyDetail.loading')}</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4" style={{ background: C.bg }}>
                <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center" style={{ boxShadow: '0 1px 12px rgba(0,0,0,0.08)' }}>
                    <XCircle className="w-12 h-12 mx-auto mb-3" style={{ color: C.red }} />
                    <h2 className="text-lg font-bold mb-2" style={{ color: C.navy }}>{t('provider.historyDetail.notFoundTitle')}</h2>
                    <p className="text-sm mb-5" style={{ color: C.gray }}>{error}</p>
                    <button onClick={() => router.back()}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-white"
                        style={{ background: C.orange }}>
                        {t('provider.historyDetail.goBack')}
                    </button>
                </div>
            </div>
        );
    }

    const { req, quote, payment, review } = data;
    const isWinner = !!user?.id && req.assignedProviderId === user?.id;
    const isCompleted = isWinner && ['COMPLETED', 'PAID'].includes(req.status);
    // Treat COMPLETED + wallet-tx PENDING the same as PAID (waiting for disbursement)
    const isPendingDisbursement = isWinner && (
        req.status === 'PAID' ||
        (req.status === 'COMPLETED' && payment?.walletTxStatus === 'PENDING')
    );
    // Use actual payment amount (includes surcharges) when available, fall back to quote price
    const payAmt = payment?.totalAmount;
    const revenueAmount = isWinner
        ? (payAmt != null && payAmt > 0 ? payAmt : (quote?.price ?? 0))
        : (quote?.price ?? 0);
    const commissionRate = typeof payment?.commissionRate === 'number' ? payment.commissionRate : 0.2;
    const profit = Math.round(revenueAmount * (1 - commissionRate));
    const quoteProfit = quote ? Math.round(quote.price * (1 - commissionRate)) : 0;

    // Status label for rescue request
    const reqStatusCfg: Record<string, { color: string; bg: string }> = {
        COMPLETED: { color: C.green, bg: C.greenLight },
        PAID: { color: '#7c3aed', bg: '#f5f3ff' },
        PAYMENT_PENDING: { color: '#ca8a04', bg: '#fefce8' },
        CANCELLED: { color: '#6b7280', bg: '#f3f4f6' },
        IN_PROGRESS: { color: '#ca8a04', bg: '#fefce8' },
        WORKING: { color: '#ca8a04', bg: '#fefce8' },
        ARRIVED: { color: C.blue, bg: C.blueLight },
        ACCEPTED: { color: C.blue, bg: C.blueLight },
    };
    const reqStatusStyle = reqStatusCfg[req.status] ?? { color: C.gray, bg: '#f3f4f6' };
    const reqStatusLabel = t(`provider.historyDetail.statusBadge.${req.status}` as any) || req.status;
    const reqStatus = { ...reqStatusStyle, label: reqStatusLabel };

    // Payment status badge config (separate from job status)
    const paymentStatusBadge: { label: string; color: string; bg: string } | null =
        !isWinner
            ? null
            : payment?.walletTxStatus === 'COMPLETED'
                ? { label: t('provider.historyDetail.paymentBadge.COMPLETED' as any), color: C.green, bg: C.greenLight }
                : payment?.walletTxStatus === 'PENDING'
                    ? { label: t('provider.historyDetail.paymentBadge.PENDING' as any), color: '#7c3aed', bg: '#f5f3ff' }
                    : payment?.paymentMethod === 'CASH'
                        ? { label: t('provider.historyDetail.paymentBadge.CASH' as any), color: '#374151', bg: '#f3f4f6' }
                        : null;

    const images = Array.from(new Set((req.media ?? []).filter((m: any) => m.mediaType === 'IMAGE').map((m: any) => m.publicUrl as string))) as string[];
    const videos = Array.from(new Set((req.media ?? []).filter((m: any) => m.mediaType === 'VIDEO').map((m: any) => m.publicUrl as string))) as string[];

    return (
        <div className="min-h-screen" style={{ background: C.bg, fontFamily: "'Inter', 'Lexend', sans-serif" }}>

            {/* ── Header ── */}
            <div className="sticky top-0 z-20 bg-white flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: `1px solid ${C.border}` }}>
                <button onClick={() => router.back()}
                    className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-100"
                    style={{ color: C.navy }}>
                    <ArrowLeft size={18} />
                </button>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.gray }}>{t('provider.historyDetail.title')}</p>
                    <p className="text-sm font-bold truncate" style={{ color: C.navy }}>
                        #{displayOrderCode(req.orderCode, requestId)}
                    </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isWinner ? (
                        <>
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold"
                                style={{ background: reqStatus.bg, color: reqStatus.color }}>
                                {reqStatus.label}
                            </span>
                            {paymentStatusBadge && (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold"
                                    style={{ background: paymentStatusBadge.bg, color: paymentStatusBadge.color }}>
                                    {paymentStatusBadge.label}
                                </span>
                            )}
                        </>
                    ) : (
                        <HistoryDetailLoserHeaderBadge req={req} quote={quote} userId={user?.id} />
                    )}
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 py-5 space-y-4 pb-10">

                {/* ── Summary banner (chỉ khi bạn là CHV được giao và cuốc đã hoàn tất thanh toán) ── */}
                {isWinner && isCompleted && quote && (
                    <div className="rounded-2xl p-5 text-white"
                        style={{ background: `linear-gradient(135deg, ${C.navy} 0%, #16213e 60%, #0f3460 100%)` }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">{t('provider.historyDetail.banner.revenue')}</p>
                        <p className="text-3xl font-bold mb-1">{fmtVnd(revenueAmount)}</p>
                        <div className="flex items-center gap-2">
                            <span className="text-sm opacity-80">{t('provider.historyDetail.banner.profit')}</span>
                            <span className="text-sm font-bold" style={{ color: '#4ade80' }}>+{fmtVnd(profit)}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-3">
                            {isPendingDisbursement
                                ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: 'rgba(167,139,250,0.18)', color: '#c4b5fd' }}>
                                        <Clock size={10} />
                                        {t('provider.historyDetail.banner.disbursing')}
                                    </span>
                                )
                                : <span className="text-xs opacity-70">{t('provider.historyDetail.banner.completedAt')} {req.completedAt ? fmtDateTime(req.completedAt) : '—'}</span>
                            }
                        </div>
                    </div>
                )}

                {!isWinner && quote && (
                    <div className="rounded-2xl p-4" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}>
                        <p className="text-sm leading-relaxed" style={{ color: '#9a3412' }}>{t('provider.historyDetail.loserNote')}</p>
                    </div>
                )}

                {/* ── Customer info ── */}
                <SectionCard title={t('provider.historyDetail.sections.customerInfo')} icon={<User size={16} style={{ color: C.blue }} />}>
                    <div className="flex items-center gap-3">
                        <AvatarImage
                            name={req.user?.name || t('provider.historyDetail.customer.fallback')}
                            avatar={req.user?.avatar}
                            className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                            fallbackBackground={`linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`}
                            initialsCount={1}
                        />
                        <div className="flex-1 min-w-0">
                            <p className="font-bold" style={{ color: C.navy }}>{req.user?.name || t('provider.historyDetail.customer.fallback')}</p>
                            <p className="text-xs mt-0.5" style={{ color: C.gray }}>{req.contactPhone}</p>
                        </div>
                        {req.contactPhone && (
                            <a href={`tel:${req.contactPhone}`}
                                className="w-9 h-9 rounded-xl flex items-center justify-center"
                                style={{ background: C.greenLight }}>
                                <Phone size={14} style={{ color: C.green }} />
                            </a>
                        )}
                    </div>
                </SectionCard>

                {/* ── Rescue details ── */}
                <SectionCard title={t('provider.historyDetail.sections2.rescueDetails')} icon={<Wrench size={16} style={{ color: C.orange }} />}>
                    {req.incidentType && (
                        <InfoRow
                            icon={<FileText size={13} style={{ color: C.orange }} />}
                            label={t('provider.historyDetail.labels.incidentType')}
                            value={t(`provider.historyDetail.incidentLabels.${req.incidentType}` as any) ?? req.incidentType}
                        />
                    )}
                    {req.vehicleType && (
                        <InfoRow
                            icon={<Car size={13} style={{ color: C.orange }} />}
                            label={t('provider.historyDetail.labels.vehicleType')}
                            value={t(`provider.historyDetail.vehicleLabels.${req.vehicleType}` as any) ?? req.vehicleType}
                        />
                    )}
                    {(req.licensePlate?.trim() || req.user?.licensePlate) && (
                        <InfoRow
                            icon={<span style={{ color: C.orange, fontSize: 11, fontWeight: 700 }}>{t('provider.historyDetail.infoLabels2.bsx')}</span>}
                            label={t('provider.historyDetail.infoLabels2.licensePlate')}
                            value={req.licensePlate?.trim() || req.user?.licensePlate}
                        />
                    )}
                    {(req.vehicleColor?.trim() || req.user?.vehicleColor) && (
                        <InfoRow
                            icon={<span style={{ color: C.orange, fontSize: 11, fontWeight: 700 }}>{t('provider.historyDetail.infoLabels2.color')}</span>}
                            label={t('provider.historyDetail.infoLabels2.vehicleColor')}
                            value={req.vehicleColor?.trim() || req.user?.vehicleColor}
                        />
                    )}
                    {req.pickupLocation?.addressText && (
                        <InfoRow
                            icon={<MapPin size={13} style={{ color: C.orange }} />}
                            label={t('provider.historyDetail.labels.pickupLocation')}
                            value={req.pickupLocation.addressText}
                        />
                    )}
                    {req.dropoffLocation?.addressText && (
                        <InfoRow
                            icon={<MapPin size={13} style={{ color: C.orange }} />}
                            label={t('provider.historyDetail.infoLabels2.dropoffLocation')}
                            value={req.dropoffLocation.addressText}
                        />
                    )}
                    {req.description && (
                        <InfoRow
                            icon={<FileText size={13} style={{ color: C.orange }} />}
                            label={t('provider.historyDetail.labels.description')}
                            value={req.description}
                        />
                    )}
                    <InfoRow
                        icon={<Calendar size={13} style={{ color: C.orange }} />}
                        label={t('provider.historyDetail.labels.createdAt')}
                        value={fmtDateTime(req.createdAt)}
                    />
                </SectionCard>

                {/* ── Media ── */}
                {(images.length > 0 || videos.length > 0) && (
                    <SectionCard
                        title={t('provider.historyDetail.sections2.media').replace('{count}', String(images.length + videos.length))}
                        icon={<ImageIcon size={16} style={{ color: C.blue }} />}
                    >
                        {images.length > 0 && (
                            <div className="grid grid-cols-3 gap-2">
                                {images.map((src: string, i: number) => (
                                    <button key={i} onClick={() => setLightboxSrc(src)}
                                        className="aspect-square rounded-xl overflow-hidden relative group"
                                        style={{ background: '#f1f5f9' }}>
                                        <img src={src} alt={`Ảnh ${i + 1}`} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                            style={{ background: 'rgba(0,0,0,0.3)' }}>
                                            <ImageIcon className="w-5 h-5 text-white" />
                                        </div>
                                    </button>
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

                {/* ── Quote info ── */}
                {quote && (
                    <SectionCard title={t('provider.historyDetail.sections2.quote')} icon={<Banknote size={16} style={{ color: C.green }} />}>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl p-3" style={{ background: C.bg }}>
                                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: C.gray }}>{t('provider.historyDetail.quoteInfo.quotedPrice')}</p>
                                <p className="text-lg font-bold" style={{ color: C.navy }}>{fmtVnd(quote.price)}</p>
                            </div>
                            <div className="rounded-xl p-3" style={{ background: C.bg }}>
                                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: C.gray }}>{t('provider.historyDetail.quoteInfo.profit').replace('{rate}', String(Math.round((1 - commissionRate) * 100)))}</p>
                                {isWinner ? (
                                    <p className="text-lg font-bold" style={{ color: C.green }}>+{fmtVnd(quoteProfit)}</p>
                                ) : (
                                    <p className="text-sm font-semibold line-through" style={{ color: '#9ca3af' }}>+{fmtVnd(quoteProfit)}</p>
                                )}
                            </div>
                            {quote.estimatedArrivalMinutes && (
                                <div className="rounded-xl p-3" style={{ background: C.bg }}>
                                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: C.gray }}>{t('provider.historyDetail.quoteInfo.eta')}</p>
                                    <p className="text-lg font-bold" style={{ color: C.navy }}>{quote.estimatedArrivalMinutes} {t('provider.historyDetail.quoteInfo.minutes')}</p>
                                </div>
                            )}
                            <div className="rounded-xl p-3" style={{ background: C.bg }}>
                                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: C.gray }}>{t('provider.historyDetail.quoteInfo.status')}</p>
                                <StatusBadge status={quote.status} />
                            </div>
                        </div>
                        {quote.message && (
                            <div className="rounded-xl p-3" style={{ background: '#fff7ed', border: `1px solid #fed7aa` }}>
                                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: C.orange }}>{t('provider.historyDetail.quoteInfo.yourMessage')}</p>
                                <p className="text-sm" style={{ color: C.navy }}>{quote.message}</p>
                            </div>
                        )}
                    </SectionCard>
                )}

                {/* ── Payment (chỉ CHV được giao — tránh hiểu nhầm thu nhập khi thua báo giá) ── */}
                {payment && isWinner && (
                    <SectionCard title={t('provider.historyDetail.sections2.payment')} icon={<Banknote size={16} style={{ color: C.orange }} />}>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl p-3 col-span-2" style={{ background: C.bg }}>
                                <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: C.gray }}>{t('provider.historyDetail.payment.yourIncome')}</p>
                                {payment.walletTxStatus === 'COMPLETED'
                                    ? (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: C.greenLight, color: C.green }}>
                                            <CheckCircle2 size={12} /> {t('provider.historyDetail.payment.received')}
                                        </span>
                                    )
                                    : payment.walletTxStatus === 'PENDING'
                                        ? (
                                            <div className="rounded-xl p-3" style={{ background: '#f5f3ff', border: '1.5px solid #ddd6fe' }}>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Clock size={13} style={{ color: '#7c3aed' }} />
                                                    <span className="text-xs font-bold" style={{ color: '#7c3aed' }}>{t('provider.historyDetail.payment.disbursing')}</span>
                                                </div>
                                                <p className="text-[10px] leading-relaxed" style={{ color: '#8b5cf6' }}>{t('provider.historyDetail.payment.disbursingDesc')}</p>
                                            </div>
                                        )
                                        : <StatusBadge status={payment.status} />
                                }
                            </div>
                            <div className="rounded-xl p-3" style={{ background: C.bg }}>
                                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: C.gray }}>{t('provider.historyDetail.payment.method')}</p>
                                <p className="text-sm font-bold" style={{ color: C.navy }}>
                                    {payment.paymentMethod === 'CASH'
                                        ? t('provider.historyDetail.labels.cash')
                                        : payment.paymentMethod === 'WALLET'
                                            ? 'Ví điện tử RescueMe'
                                            : t('provider.historyDetail.labels.transfer')}
                                </p>
                            </div>
                            <div className="rounded-xl p-3" style={{ background: C.bg }}>
                                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: C.gray }}>{t('provider.historyDetail.payment.total')}</p>
                                <p className="text-sm font-bold" style={{ color: C.navy }}>{fmtVnd(payment.totalAmount)}</p>
                            </div>
                        </div>
                        {/* Fee breakdown */}
                        <div className="rounded-xl overflow-hidden border" style={{ borderColor: C.border }}>
                            {[
                                { label: t('provider.historyDetail.feeItems.base'), val: payment.baseFee },
                                { label: t('provider.historyDetail.feeItems.distance'), val: payment.distanceFee },
                                payment.overtimeFee > 0 && { label: t('provider.historyDetail.feeItems.overtime'), val: payment.overtimeFee },
                                payment.otherFee > 0 && { label: t('provider.historyDetail.feeItems.other'), val: payment.otherFee },
                            ].filter(Boolean).map((row: any, i: number, arr) => (
                                <div key={i} className="flex items-center justify-between px-4 py-2.5"
                                    style={{ borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                                    <span className="text-xs" style={{ color: C.gray }}>{row.label}</span>
                                    <span className="text-xs font-semibold" style={{ color: C.navy }}>{fmtVnd(row.val)}</span>
                                </div>
                            ))}
                            <div className="flex items-center justify-between px-4 py-3"
                                style={{ background: '#f8fafc', borderTop: `1px solid ${C.border}` }}>
                                <span className="text-sm font-bold" style={{ color: C.navy }}>{t('provider.historyDetail.feeItems.total')}</span>
                                <span className="text-sm font-bold" style={{ color: C.orange }}>{fmtVnd(payment.totalAmount)}</span>
                            </div>
                        </div>
                        {payment.note && (
                            <p className="text-xs mt-1" style={{ color: C.gray }}>{t('provider.historyDetail.payment.notes')} {payment.note}</p>
                        )}
                        {(() => {
                            if (!payment.surchargeNote) return null;
                            let breakdown: { label: string; amount: number }[] = [];
                            let surcharges: { label: string; amount: number }[] = [];
                            let rawText: string | null = null;
                            try {
                                const parsed = JSON.parse(payment.surchargeNote);
                                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                                    breakdown = parsed.breakdown ?? [];
                                    surcharges = parsed.surcharges ?? [];
                                } else if (Array.isArray(parsed)) {
                                    breakdown = parsed;
                                } else {
                                    rawText = payment.surchargeNote;
                                }
                            } catch {
                                rawText = payment.surchargeNote;
                            }
                            const items = [...breakdown, ...surcharges].filter(i => i.label || i.amount > 0);
                            if (items.length === 0 && !rawText) return null;
                            return (
                                <div className="rounded-xl overflow-hidden border mt-1" style={{ borderColor: C.border }}>
                                    <div className="px-3 py-1.5" style={{ background: '#fff7ed', borderBottom: `1px solid ${C.border}` }}>
                                        <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: C.orange }}>{t('provider.historyDetail.payment.surcharges')}</p>
                                    </div>
                                    {rawText ? (
                                        <p className="px-3 py-2 text-xs" style={{ color: C.gray }}>{rawText}</p>
                                    ) : items.map((item, i) => (
                                        <div key={i} className="flex items-center justify-between px-3 py-2"
                                            style={{ borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>
                                            <span className="text-xs" style={{ color: C.gray }}>{item.label || '—'}</span>
                                            <span className="text-xs font-semibold" style={{ color: C.navy }}>{fmtVnd(item.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}

                        {/* Link to wallet transaction */}
                        {payment.walletTxId && (
                            <button
                                onClick={() => router.push(`/provider/wallet/tx/${payment.walletTxId}`)}
                                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all active:scale-[0.98]"
                                style={{
                                    background: '#eff6ff',
                                    border: '1.5px solid #bfdbfe',
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#dbeafe' }}>
                                        <Wallet size={15} style={{ color: '#2563eb' }} />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs font-bold" style={{ color: '#1e40af' }}>{t('provider.historyDetail.payment.walletLink.title')}</p>
                                        <p className="text-[10px]" style={{ color: '#3b82f6' }}>
                                            {payment.walletTxType === 'CREDIT' ? t('provider.historyDetail.payment.walletLink.income') : t('provider.historyDetail.payment.walletLink.commission')}
                                            {payment.walletTxStatus && (
                                                <span className="ml-2 font-semibold">
                                                    &middot; {payment.walletTxStatus === 'COMPLETED' ? t('provider.historyDetail.payment.walletLink.completed') : payment.walletTxStatus === 'PENDING' ? t('provider.historyDetail.payment.walletLink.pending') : payment.walletTxStatus}
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <ExternalLink size={14} style={{ color: '#3b82f6' }} />
                            </button>
                        )}

                        {/* Payment photos */}
                        {payment.photoUrls?.length > 0 && (
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: C.gray }}>
                                    {t('provider.historyDetail.payment.photos').replace('{count}', String(payment.photoUrls.length))}
                                </p>
                                <div className="grid grid-cols-3 gap-2">
                                    {payment.photoUrls.map((src: string, i: number) => (
                                        <button key={i} onClick={() => setLightboxSrc(src)}
                                            className="aspect-square rounded-xl overflow-hidden"
                                            style={{ background: '#f1f5f9' }}>
                                            <img src={src} alt={`Ảnh ${i + 1}`} className="w-full h-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </SectionCard>
                )}

                {/* ── Review (đánh giá dành cho CHV làm cuốc) ── */}
                {review && isWinner && (
                    <SectionCard title={t('provider.historyDetail.sections2.review')} icon={<Star size={16} style={{ color: C.yellow }} />}>
                        <div className="flex items-center gap-3">
                            <Stars rating={review.rating} />
                            <span className="text-lg font-bold" style={{ color: C.navy }}>{review.rating}/5</span>
                        </div>
                        {review.comment && (
                            <div className="rounded-xl p-3" style={{ background: '#fefce8', border: '1px solid #fde68a' }}>
                                <p className="text-sm italic" style={{ color: '#78350f' }}>"{review.comment}"</p>
                            </div>
                        )}
                        {review.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {review.tags.map((tag: string) => (
                                    <span key={tag} className="px-2.5 py-1 rounded-full text-xs font-semibold"
                                        style={{ background: '#fef3c7', color: '#92400e' }}>
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                        <p className="text-xs" style={{ color: C.gray }}>
                            {t('provider.historyDetail.review.postedAt')} {fmtDateTime(review.createdAt)}
                        </p>
                    </SectionCard>
                )}

                {/* ── Timeline ── */}
                <SectionCard title={t('provider.historyDetail.sections2.timeline')} icon={<Clock size={16} style={{ color: C.blue }} />}>
                    <div className="space-y-0">
                        {[
                            { label: t('provider.historyDetail.timeline.created'), time: req.createdAt, done: true },
                            { label: t('provider.historyDetail.timeline.assigned'), time: req.assignedAt, done: !!req.assignedAt },
                            { label: t('provider.historyDetail.timeline.payment'), time: isWinner ? payment?.createdAt : undefined, done: !!payment && isWinner },
                            { label: t('provider.historyDetail.timeline.completed'), time: req.completedAt, done: isWinner && isCompleted },
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
                                    {step.time ? (
                                        <p className="text-xs mt-0.5" style={{ color: C.gray }}>{fmtDateTime(step.time)}</p>
                                    ) : (
                                        <p className="text-xs mt-0.5" style={{ color: '#d1d5db' }}>{t('provider.historyDetail.timeline.notDone')}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            </div>

            {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
        </div>
    );
}
