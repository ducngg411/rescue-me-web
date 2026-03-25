'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { isJobPaymentQrProviderTx } from '@/lib/providerWalletTxLabels';
import { useProviderGuard } from '@/lib/guards';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    ArrowLeft, CheckCircle2, Clock, XCircle,
    Banknote, Star, Image as ImageIcon, Play,
    Wrench, ExternalLink, RefreshCw, ChevronRight,
} from 'lucide-react';

const C = {
    orange: '#f97316',
    orangeDark: '#ea6c0a',
    orangeLight: '#fff7ed',
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#f1f5f9',
    bg: '#f8fafc',
    green: '#16a34a',
    greenLight: '#f0fdf4',
    red: '#ef4444',
    redLight: '#fef2f2',
};

function fmt(n: number) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency', currency: 'VND', minimumFractionDigits: 0,
    }).format(n);
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

// ── Media lightbox ──────────────────────────────────────────────────────────
function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
            onClick={onClose}
        >
            <button
                className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20"
                onClick={onClose}
            >
                <XCircle className="w-5 h-5 text-white" />
            </button>
            <img src={src} alt="" className="max-w-full max-h-full rounded-xl object-contain" onClick={e => e.stopPropagation()} />
        </div>
    );
}

// ── Star display ──────────────────────────────────────────────────────────
function Stars({ rating }: { rating: number }) {
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} className="w-4 h-4" fill={i <= rating ? '#f59e0b' : 'none'} stroke={i <= rating ? '#f59e0b' : '#d1d5db'} />
            ))}
        </div>
    );
}

export default function TxDetailPage() {
    useProviderGuard();
    const router = useRouter();
    const params = useParams();
    const { t } = useLanguage();
    const txId = params?.id as string;

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

    const fetchDetail = useCallback(async () => {
        if (!txId) return;
        setLoading(true); setError('');
        try {
            const res = await api.get(`/wallet/me/transactions/${txId}/details`);
            setData(res.data);
        } catch (e: any) {
            setError(e?.response?.data?.message || t('provider.txDetail.labels.loadError'));
        } finally {
            setLoading(false);
        }
    }, [txId]);

    useEffect(() => { fetchDetail(); }, [fetchDetail]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
                <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="w-8 h-8 animate-spin" style={{ color: C.orange }} />
                    <p className="text-sm" style={{ color: C.gray }}>{t('provider.txDetail.loading')}</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-5" style={{ background: C.bg }}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: C.redLight }}>
                    <XCircle className="w-8 h-8" style={{ color: C.red }} />
                </div>
                <p className="text-sm font-semibold text-center" style={{ color: C.navy }}>{error || t('provider.txDetail.notFoundError')}</p>
                <button onClick={() => router.back()} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: C.orange }}>
                    {t('provider.txDetail.goBack')}
                </button>
            </div>
        );
    }

    const { transaction: tx, jobDetail: job } = data;
    const isCredit = tx.type === 'CREDIT';
    const jobPaymentDisplayDesc =
        tx.referenceType === 'JOB_PAYMENT' && tx.referenceId
            ? (isJobPaymentQrProviderTx(tx.description)
                ? t('provider.wallet.txDesc.jobPaymentQr').replace(
                    '{id}',
                    String(tx.referenceId).slice(0, 8).toUpperCase(),
                )
                : t('provider.wallet.txDesc.jobPaymentWallet').replace(
                    '{id}',
                    String(tx.referenceId).slice(0, 8).toUpperCase(),
                ))
            : null;
    const statusConfig = {
        PENDING: { label: t('provider.txDetail.statusLabels.PENDING' as any), bg: '#fefce8', color: '#ca8a04', Icon: Clock },
        COMPLETED: { label: t('provider.txDetail.statusLabels.COMPLETED' as any), bg: C.greenLight, color: C.green, Icon: CheckCircle2 },
        FAILED: { label: t('provider.txDetail.statusLabels.FAILED' as any), bg: C.redLight, color: C.red, Icon: XCircle },
    }[tx.status as 'PENDING' | 'COMPLETED' | 'FAILED'] ?? { label: tx.status, bg: C.bg, color: C.gray, Icon: Clock };

    const images = (job?.media ?? []).filter((m: any) => m.mediaType === 'IMAGE');
    const videos = (job?.media ?? []).filter((m: any) => m.mediaType === 'VIDEO');
    const allVideosRaw = [...videos, ...(job?.videoUrls ?? []).map((url: string) => ({ publicUrl: url, mediaType: 'VIDEO' }))];
    const allVideos = Array.from(new Map(allVideosRaw.map((v: any) => [v.publicUrl || v.url, v])).values());

    // Parse surchargeNote for breakdown
    let breakdown: { label: string; amount: number }[] = [];
    let surcharges: { label: string; amount: number }[] = [];
    if (job?.payment?.surchargeNote) {
        try {
            const parsed = JSON.parse(job.payment.surchargeNote);
            breakdown = parsed.breakdown ?? [];
            surcharges = parsed.surcharges ?? [];
        } catch { /* not JSON, ignore */ }
    }

    return (
        <div className="min-h-screen pb-10" style={{ background: C.bg, fontFamily: 'Lexend, sans-serif' }}>
            {/* Header */}
            <div className="sticky top-0 z-20 px-4 py-3 flex items-center gap-3" style={{ background: 'white', borderBottom: `1px solid ${C.border}`, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                <button onClick={() => router.back()} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-colors">
                    <ArrowLeft className="w-4 h-4" style={{ color: C.navy }} />
                </button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-sm font-bold truncate" style={{ color: C.navy }}>{t('provider.txDetail.title')}</h1>
                    <p className="text-[10px] font-mono" style={{ color: C.gray }}>#{tx.id.slice(0, 16).toUpperCase()}</p>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: statusConfig.bg, color: statusConfig.color }}>
                    <statusConfig.Icon className="w-3 h-3" />
                    {statusConfig.label}
                </div>
            </div>

            <div className="px-4 pt-5 space-y-4 max-w-lg mx-auto">

                {/* ── Transaction Summary Card ── */}
                <div className="rounded-2xl overflow-hidden" style={{ background: 'white', boxShadow: '0 1px 12px rgba(0,0,0,0.07)' }}>
                    <div className="px-5 py-5 flex flex-col items-center" style={{ background: isCredit ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)' : 'linear-gradient(135deg, #fff1f2, #ffe4e6)' }}>
                        <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ background: 'white', boxShadow: `0 2px 12px ${isCredit ? '#16a34a' : '#ef4444'}30` }}>
                            {isCredit
                                ? <CheckCircle2 className="w-7 h-7" style={{ color: C.green }} />
                                : <Banknote className="w-7 h-7" style={{ color: C.red }} />}
                        </div>
                        <p className="text-3xl font-bold mb-1" style={{ color: isCredit ? C.green : C.red }}>
                            {isCredit ? '+' : '−'}{fmt(tx.amount)}
                        </p>
                        <p className="text-xs font-medium" style={{ color: '#6b7280' }}>
                            {t(`provider.txDetail.refLabels.${tx.referenceType}` as any)}
                        </p>
                    </div>
                    <div className="px-5 py-4 space-y-3">
                        <Row label={t('provider.txDetail.rowLabels.date')} value={fmtDate(tx.createdAt)} />
                        <Row label={t('provider.txDetail.rowLabels.type')} value={isCredit ? t('provider.txDetail.rowLabels.credit') : t('provider.txDetail.rowLabels.debit')} />
                        <Row label={t('provider.txDetail.labels.status')} value={statusConfig.label} valueColor={statusConfig.color} />
                        {(jobPaymentDisplayDesc || tx.description) && (
                            <Row
                                label={t('provider.txDetail.rowLabels.description')}
                                value={jobPaymentDisplayDesc ?? tx.description}
                            />
                        )}
                        {tx.holdReleaseAt && (
                            <Row label={t('provider.txDetail.rowLabels.disbursedAt')} value={fmtDate(tx.holdReleaseAt)} valueColor={C.orange} />
                        )}
                        <div className="flex items-center justify-between pt-1" style={{ borderTop: `1px dashed ${C.border}` }}>
                            <span className="text-[10px] font-mono" style={{ color: '#94a3b8' }}>TX#{tx.id.slice(0, 20).toUpperCase()}</span>
                        </div>
                    </div>
                </div>

                {/* ── Job Details Card ── */}
                {job && (
                    <div className="rounded-2xl overflow-hidden" style={{ background: 'white', boxShadow: '0 1px 12px rgba(0,0,0,0.07)' }}>
                        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.border}` }}>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: C.orangeLight }}>
                                    <Wrench className="w-4 h-4" style={{ color: C.orange }} />
                                </div>
                                <h2 className="text-sm font-bold" style={{ color: C.navy }}>{t('provider.txDetail.job.title')}</h2>
                            </div>
                            <button
                                onClick={() => router.push(`/provider/history/${job.id}`)}
                                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                                style={{ background: C.orangeLight, color: C.orange }}
                            >
                                {t('provider.txDetail.job.viewBtn')} <ChevronRight className="w-3 h-3" />
                            </button>
                        </div>
                        <div className="px-5 py-4 space-y-3">
                            <Row label={t('provider.txDetail.job.id')} value={`#${job.id.slice(0, 10).toUpperCase()}`} mono />
                            {job.incidentType && <Row label={t('provider.txDetail.labels.incidentType')} value={t(`provider.txDetail.incidentLabels.${job.incidentType}` as any) || job.incidentType} />}
                            {job.vehicleType && <Row label={t('provider.txDetail.job.vehicleTypeLabel')} value={job.vehicleType === 'CAR' ? ` ${t('provider.txDetail.job.vehicleCar')}` : ` ${t('provider.txDetail.job.vehicleMotorcycle')}`} />}
                            {job.createdAt && <Row label={t('provider.txDetail.job.createdAt')} value={fmtDate(job.createdAt)} />}
                            {job.completedAt && <Row label={t('provider.txDetail.job.completedAt')} value={fmtDate(job.completedAt)} />}
                            {job.description && (
                                <div>
                                    <p className="text-xs mb-1" style={{ color: C.gray }}>{t('provider.txDetail.job.descriptionLabel')}</p>
                                    <p className="text-sm italic" style={{ color: C.navy }}>"{job.description}"</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Payment Breakdown ── */}
                {job?.payment && (
                    <div className="rounded-2xl overflow-hidden" style={{ background: 'white', boxShadow: '0 1px 12px rgba(0,0,0,0.07)' }}>
                        <SectionHeader icon={<Banknote className="w-4 h-4" style={{ color: C.green }} />} title={t('provider.txDetail.payment.title')} bg={C.greenLight} />
                        <div className="px-5 py-4 space-y-3">
                            <Row label={t('provider.txDetail.payment.method')} value={
                                job.payment.paymentMethod === 'QR' ? ` ${t('provider.txDetail.payment.transfer')}`
                                    : job.payment.paymentMethod === 'WALLET' ? ' Ví điện tử RescueMe'
                                        : ` ${t('provider.txDetail.payment.cash')}`
                            } />
                            {job.payment.baseFee > 0 && <Row label={t('provider.txDetail.payment.basePrice')} value={fmt(job.payment.baseFee)} />}
                            {breakdown.map((b, i) => (
                                <Row key={i} label={b.label || t('provider.txDetail.payment.basePrice')} value={fmt(b.amount)} />
                            ))}
                            {surcharges.map((s, i) => (
                                <Row key={i} label={t('provider.txDetail.payment.surcharge').replace('{label}', s.label)} value={`+${fmt(s.amount)}`} valueColor={C.orange} />
                            ))}
                            <div className="flex items-center justify-between pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
                                <span className="text-sm font-bold" style={{ color: C.navy }}>{t('provider.txDetail.payment.total')}</span>
                                <span className="text-base font-bold" style={{ color: C.orange }}>{fmt(job.payment.totalAmount)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs" style={{ color: C.gray }}>Phí nền tảng (10%)</span>
                                <span className="text-xs font-semibold" style={{ color: '#ef4444' }}>−{fmt(Math.round(job.payment.totalAmount * 0.1))}</span>
                            </div>
                            <div className="flex items-center justify-between pt-1" style={{ borderTop: `1px dashed ${C.border}` }}>
                                <span className="text-xs font-semibold" style={{ color: C.gray }}>{t('provider.txDetail.payment.netIncome')}</span>
                                <span className="text-sm font-bold" style={{ color: C.green }}>+{fmt(Math.round(job.payment.totalAmount * 0.9))}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Media Gallery ── */}
                {(images.length > 0 || allVideos.length > 0) && (
                    <div className="rounded-2xl overflow-hidden" style={{ background: 'white', boxShadow: '0 1px 12px rgba(0,0,0,0.07)' }}>
                        <SectionHeader icon={<ImageIcon className="w-4 h-4" style={{ color: '#7c3aed' }} />} title={t('provider.txDetail.media.title').replace('{count}', String(images.length + allVideos.length))} bg="#f5f3ff" />
                        <div className="px-4 py-4">
                            {images.length > 0 && (
                                <>
                                    <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: C.gray }}>{t('provider.txDetail.media.photos')}</p>
                                    <div className="grid grid-cols-3 gap-2 mb-3">
                                        {images.map((img: any, i: number) => (
                                            <button
                                                key={i}
                                                onClick={() => setLightboxSrc(img.publicUrl)}
                                                className="aspect-square rounded-xl overflow-hidden relative group"
                                                style={{ border: `1px solid ${C.border}` }}
                                            >
                                                <img src={img.publicUrl} alt={img.fileName} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                                                    <ExternalLink className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                            {allVideos.length > 0 && (
                                <>
                                    <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: C.gray }}>{t('provider.txDetail.media.videos')}</p>
                                    <div className="space-y-2">
                                        {allVideos.map((v: any, i: number) => (
                                            <a
                                                key={i}
                                                href={v.publicUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:opacity-80"
                                                style={{ background: C.bg }}
                                            >
                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#ede9fe' }}>
                                                    <Play className="w-4 h-4" style={{ color: '#7c3aed' }} />
                                                </div>
                                                <span className="text-xs font-medium truncate flex-1" style={{ color: C.navy }}>
                                                    {v.fileName || `Video ${i + 1}`}
                                                </span>
                                                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.gray }} />
                                            </a>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Review ── */}
                {job?.review && (
                    <div className="rounded-2xl overflow-hidden" style={{ background: 'white', boxShadow: '0 1px 12px rgba(0,0,0,0.07)' }}>
                        <SectionHeader icon={<Star className="w-4 h-4" style={{ color: '#f59e0b' }} />} title={t('provider.txDetail.review.title')} bg="#fefce8" />
                        <div className="px-5 py-4 space-y-3">
                            <div className="flex items-center gap-3">
                                <Stars rating={job.review.rating} />
                                <span className="text-sm font-bold" style={{ color: C.navy }}>{job.review.rating}/5</span>
                            </div>
                            {job.review.comment && (
                                <p className="text-sm italic px-3 py-2 rounded-xl" style={{ background: C.bg, color: C.navy }}>
                                    "{job.review.comment}"
                                </p>
                            )}
                            {job.review.tags?.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {job.review.tags.map((tag: string, i: number) => (
                                        <span key={i} className="px-2 py-1 rounded-full text-xs font-medium" style={{ background: '#fef3c7', color: '#92400e' }}>
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                            <p className="text-[10px]" style={{ color: C.gray }}>{t('provider.txDetail.review.postedAt')} {fmtDate(job.review.createdAt)}</p>
                        </div>
                    </div>
                )}

            </div>

            {/* Lightbox */}
            {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
        </div>
    );
}

// ── Shared sub-components ────────────────────────────────────────────────────
function Row({ label, value, valueColor, mono }: {
    label: string; value: string; valueColor?: string; mono?: boolean;
}) {
    return (
        <div className="flex items-start justify-between gap-4">
            <span className="text-xs flex-shrink-0" style={{ color: C.gray }}>{label}</span>
            <span
                className={`text-xs font-semibold text-right ${mono ? 'font-mono' : ''}`}
                style={{ color: valueColor ?? C.navy }}
            >
                {value}
            </span>
        </div>
    );
}

function SectionHeader({ icon, title, bg }: { icon: React.ReactNode; title: string; bg: string }) {
    return (
        <div className="px-5 py-3.5 flex items-center gap-2" style={{ background: bg, borderBottom: `1px solid ${C.border}` }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white">{icon}</div>
            <h2 className="text-sm font-bold" style={{ color: C.navy }}>{title}</h2>
        </div>
    );
}

