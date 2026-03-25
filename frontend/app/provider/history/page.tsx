'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import api from '@/lib/api';
import { displayOrderCode } from '@/lib/reconciliation';
import ProviderLayout from '@/components/ProviderLayout';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import AvatarImage from '@/components/AvatarImage';
import PendingVerificationScreen from '@/components/PendingVerificationScreen';
import {
    Search, ChevronRight, ChevronLeft, Calendar,
    TrendingUp, TrendingDown, CheckCircle2, XCircle,
    Clock, Star, Filter, Download, ArrowLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import RescueMeLogo from '@/components/RescueMeLogo';

/* ─────────────────────── Types ─────────────────────── */
type RequestStatus =
    | 'CREATED' | 'MATCHING' | 'MATCHED' | 'ASSIGNED'
    | 'ACCEPTED' | 'IN_PROGRESS' | 'WORKING' | 'ARRIVED'
    | 'COMPLETED' | 'PAID' | 'CANCELLED' | 'FAILED' | 'EXPIRED'
    | 'PAYMENT_PENDING';

type IncidentType =
    | 'BREAKDOWN' | 'ACCIDENT' | 'FLAT_TIRE' | 'BATTERY_DEAD'
    | 'OUT_OF_FUEL' | 'LOCKED_OUT' | 'OTHER';

interface Quote {
    id: string;
    status: string;
    price: number;
    estimatedTime: number;
    createdAt: string;
    rescueRequest: {
        id: string;
        orderCode?: string | null;
        status: RequestStatus;
        /** Người được giao cuốc — khác provider hiện tại nếu bạn thua báo giá */
        assignedProviderId?: string | null;
        incidentType: IncidentType;
        description: string | null;
        pickupAddress: string | null;
        createdAt: string;
        completedAt?: string | null;
        user: { id: string; name: string | null; phoneNumber: string | null; avatar?: string | null } | null;
        contactPhone?: string | null;
        payment?: { id: string; totalAmount: number; baseFee: number; distanceFee: number; otherFee: number; status: string; paymentMethod?: string; walletTxStatus?: string | null } | null;
    };
}

interface DayStat { date: string; revenue: number; profit: number; }
interface HistoryStats {
    weeklyRevenue: DayStat[];
    todayProfit: number;
    yesterdayProfit: number;
    profitChangePercent: number;
    successRate: number;
    totalCompleted: number;
    totalAccepted: number;
    avgRating: number | null;
    reviewCount: number;
}

/* ─────────────────────── Constants ──────────────────── */
const C = {
    orange: '#f97316', orangeLight: '#fff7ed', orangeDark: '#ea580c',
    navy: '#1a1a2e', gray: '#6b7280', border: '#e2e8f0',
    bg: '#f4f6f9', green: '#16a34a', greenLight: '#f0fdf4',
    red: '#ef4444', redLight: '#fef2f2', blue: '#2563eb', blueLight: '#eff6ff',
    yellow: '#f59e0b',
};

const INCIDENT_LABELS: Record<IncidentType, string> = {
    BREAKDOWN: 'Hỏng xe', ACCIDENT: 'Tai nạn', FLAT_TIRE: 'Lốp xe',
    BATTERY_DEAD: 'Kích bình', OUT_OF_FUEL: 'Hết xăng',
    LOCKED_OUT: 'Khóa xe', OTHER: 'Khác',
};

const INCIDENT_COLORS: Record<IncidentType, { bg: string; color: string }> = {
    BREAKDOWN: { bg: '#fef3c7', color: '#92400e' },
    ACCIDENT: { bg: '#fee2e2', color: '#991b1b' },
    FLAT_TIRE: { bg: '#ede9fe', color: '#5b21b6' },
    BATTERY_DEAD: { bg: '#dbeafe', color: '#1e40af' },
    OUT_OF_FUEL: { bg: '#d1fae5', color: '#065f46' },
    LOCKED_OUT: { bg: '#fce7f3', color: '#9d174d' },
    OTHER: { bg: '#f0fdf4', color: '#166534' },
};

const PAGE_SIZE = 10;

/* ─────────────────────── Formatters ────────────────── */
function fmtVnd(n: number) {
    return new Intl.NumberFormat('vi-VN').format(n) + 'đ';
}
function fmtDate(iso: string) {
    const d = new Date(iso);
    return {
        date: d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        time: d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };
}
function fmtShortDate(iso: string) {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/* ─────────────────────── Sub-components ────────────── */

/** Trạng thái hiển thị theo báo giá của provider (tránh “Đã phân công” khi khách chọn CHV khác). */
function HistoryRowStatusBadge({ q, providerId }: { q: Quote; providerId: string | undefined }) {
    const { t } = useLanguage();
    const req = q.rescueRequest;
    const assignee = req.assignedProviderId ?? null;
    const qs = q.status;

    const pill = (bg: string, color: string, dot: string, label: string) => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: bg, color }}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dot }} />
            {label}
        </span>
    );

    if (qs === 'REJECTED') {
        return pill('#fef2f2', '#b91c1c', '#b91c1c', t('provider.history.quoteStatusBadge.REJECTED'));
    }
    if (qs === 'PENDING' && req.status === 'MATCHING') {
        return pill('#fefce8', '#ca8a04', '#ca8a04', t('provider.history.quoteStatusBadge.AWAITING_CUSTOMER'));
    }
    if (qs === 'CANCELLED' || qs === 'EXPIRED') {
        return pill('#fff7ed', '#9a3412', '#ea580c', t('provider.history.quoteStatusBadge.NOT_SELECTED'));
    }
    if (qs === 'PENDING' && assignee && providerId && assignee !== providerId) {
        return pill('#fff7ed', '#9a3412', '#ea580c', t('provider.history.quoteStatusBadge.NOT_SELECTED'));
    }
    if (qs === 'ACCEPTED' && assignee === providerId) {
        return <StatusBadge status={req.status} />;
    }
    return <StatusBadge status={req.status} />;
}

function StatusBadge({ status }: { status: RequestStatus }) {
    const { t } = useLanguage();
    const cfg: Record<string, { label: string; dot: string; color: string; bg: string }> = {
        COMPLETED: { label: t('provider.history.statusBadge.COMPLETED'), dot: C.green, color: C.green, bg: C.greenLight },
        PAID: { label: t('provider.history.statusBadge.PAID'), dot: '#7c3aed', color: '#7c3aed', bg: '#f5f3ff' },
        PAYMENT_PENDING: { label: t('provider.history.statusBadge.PAYMENT_PENDING'), dot: C.yellow, color: '#ca8a04', bg: '#fefce8' },
        IN_PROGRESS: { label: t('provider.history.statusBadge.IN_PROGRESS'), dot: C.yellow, color: '#ca8a04', bg: '#fefce8' },
        WORKING: { label: t('provider.history.statusBadge.WORKING'), dot: C.yellow, color: '#ca8a04', bg: '#fefce8' },
        ARRIVED: { label: t('provider.history.statusBadge.ARRIVED'), dot: C.blue, color: C.blue, bg: C.blueLight },
        CANCELLED: { label: t('provider.history.statusBadge.CANCELLED'), dot: '#9ca3af', color: '#6b7280', bg: '#f9fafb' },
        EXPIRED: { label: t('provider.history.statusBadge.EXPIRED'), dot: '#9ca3af', color: '#6b7280', bg: '#f9fafb' },
        FAILED: { label: t('provider.history.statusBadge.FAILED'), dot: C.red, color: C.red, bg: C.redLight },
        ACCEPTED: { label: t('provider.history.statusBadge.ACCEPTED'), dot: C.blue, color: C.blue, bg: C.blueLight },
        ASSIGNED: { label: t('provider.history.statusBadge.ASSIGNED'), dot: C.blue, color: C.blue, bg: C.blueLight },
        MATCHING: { label: t('provider.history.statusBadge.MATCHING'), dot: C.yellow, color: '#ca8a04', bg: '#fefce8' },
    };
    const s = cfg[status] ?? { label: status, dot: C.gray, color: C.gray, bg: '#f3f4f6' };
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ background: s.bg, color: s.color }}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
            {s.label}
        </span>
    );
}

function PaymentBadge({ walletTxStatus, paymentMethod }: { walletTxStatus?: string | null; paymentMethod?: string }) {
    const { t } = useLanguage();

    // WALLET: instant settlement, never shows "chờ giải ngân"
    if (paymentMethod === 'WALLET') {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: C.greenLight, color: C.green }}>
                Ví điện tử · Đã nhận
            </span>
        );
    }
    // QR: show disbursement status
    if (paymentMethod === 'QR') {
        if (walletTxStatus === 'COMPLETED') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ background: C.greenLight, color: C.green }}>
                    {t('provider.history.paymentBadge.disbursed')}
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: '#f5f3ff', color: '#7c3aed' }}>
                {t('provider.history.paymentBadge.waitingDisbursement')}
            </span>
        );
    }
    if (paymentMethod === 'CASH') {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: '#f3f4f6', color: '#374151' }}>
                {t('provider.history.paymentBadge.cash')}
            </span>
        );
    }
    return null;
}

/* ─── Bar Chart ──── */
const CHART_H = 120; // px – bar area (increased for better visibility)
const LABEL_H = 16;  // px – label row

function MiniBarChart({ data }: { data: DayStat[] }) {
    const { t } = useLanguage();
    const [hover, setHover] = useState<{ idx: number; x: number; y: number } | null>(null);

    if (!data || data.length === 0) {
        return (
            <div className="h-20 flex items-center justify-center">
                <p className="text-xs" style={{ color: C.gray }}>{t('provider.history.chart.noData')}</p>
            </div>
        );
    }

    const maxVal = Math.max(...data.map(d => d.revenue), 1);
    // Show at most 7 date labels regardless of period to prevent overflow
    const showEvery = data.length <= 7 ? 1 : data.length <= 14 ? 2 : Math.ceil(data.length / 7);

    return (
        <div className="mt-1">
            {/* Legend */}
            <div className="flex items-center gap-3 mb-2 justify-end text-[10px] font-medium" style={{ color: C.gray }}>
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm" style={{ background: C.orange }}></div>
                    <span>{t('provider.history.chart.revenue')}</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm" style={{ background: C.green }}></div>
                    <span>{t('provider.history.chart.profit')}</span>
                </div>
            </div>

            {/* Fixed-position tooltip – never clipped by overflow */}
            {hover && (
                <div
                    style={{
                        position: 'fixed',
                        left: hover.x,
                        top: hover.y - 65, // Adjust up for taller tooltip
                        transform: 'translateX(-50%)',
                        background: C.navy,
                        color: 'white',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '6px 10px',
                        borderRadius: '7px',
                        whiteSpace: 'nowrap',
                        zIndex: 9999,
                        pointerEvents: 'none',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    }}
                >
                    <div style={{ paddingBottom: 4, marginBottom: 4, borderBottom: '1px solid #4b5563', textAlign: 'center' }}>
                        {fmtShortDate(data[hover.idx].date)}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '2px' }}>
                        <span style={{ color: '#fdba74' }}>{t('provider.history.chart.revenue')}:</span>
                        <span>{fmtVnd(data[hover.idx].revenue)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                        <span style={{ color: '#86efac' }}>{t('provider.history.chart.profit')}:</span>
                        <span>{fmtVnd(data[hover.idx].profit)}</span>
                    </div>
                    <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        borderLeft: '5px solid transparent',
                        borderRight: '5px solid transparent',
                        borderTop: `5px solid ${C.navy}`,
                    }} />
                </div>
            )}

            {/* Scrollable bar area */}
            <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        height: `${CHART_H + LABEL_H}px`,
                        gap: '6px', // Increased gap for clustered bars
                        // Each group needs more space
                        minWidth: `${data.length * 30}px`,
                    }}
                >
                    {data.map((d, i) => {
                        const revH = d.revenue > 0 ? Math.max(Math.round((d.revenue / maxVal) * CHART_H), 4) : 2;
                        const proH = d.profit > 0 ? Math.max(Math.round((d.profit / maxVal) * CHART_H), 4) : 2;
                        const isToday = i === data.length - 1;
                        const isHovered = hover?.idx === i;
                        const showLabel = i % showEvery === 0 || i === data.length - 1;

                        return (
                            <div
                                key={d.date}
                                style={{
                                    flex: 1,
                                    height: `${CHART_H + LABEL_H}px`,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'flex-end',
                                    cursor: 'default',
                                }}
                                onMouseEnter={e => setHover({ idx: i, x: e.clientX, y: e.clientY })}
                                onMouseMove={e => setHover(h => h ? { ...h, x: e.clientX, y: e.clientY } : null)}
                                onMouseLeave={() => setHover(null)}
                            >
                                {/* Clustered Bars */}
                                <div style={{
                                    display: 'flex',
                                    width: '100%',
                                    gap: '2px', // gap between rev and pro bar
                                    alignItems: 'flex-end',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}>
                                    {/* Revenue Bar */}
                                    <div
                                        style={{
                                            flex: 1,
                                            maxWidth: '12px',
                                            height: `${revH}px`,
                                            borderRadius: '2px 2px 0 0',
                                            background: isHovered || isToday
                                                ? `linear-gradient(to top, ${C.orangeDark}, ${C.orange})`
                                                : d.revenue > 0 ? 'rgba(249,115,22,0.4)' : '#f1f5f9',
                                            transition: 'background 0.18s, opacity 0.18s',
                                            opacity: hover !== null && !isHovered && !isToday ? 0.55 : 1,
                                        }}
                                    />
                                    {/* Profit Bar */}
                                    <div
                                        style={{
                                            flex: 1,
                                            maxWidth: '12px',
                                            height: `${proH}px`,
                                            borderRadius: '2px 2px 0 0',
                                            background: isHovered || isToday
                                                ? `linear-gradient(to top, #16a34a, #4ade80)`
                                                : d.profit > 0 ? 'rgba(34,197,94,0.4)' : '#f1f5f9',
                                            transition: 'background 0.18s, opacity 0.18s',
                                            opacity: hover !== null && !isHovered && !isToday ? 0.55 : 1,
                                        }}
                                    />
                                </div>
                                {/* Date label row */}
                                <div style={{ height: `${LABEL_H}px`, display: 'flex', alignItems: 'center', marginTop: '2px' }}>
                                    <span
                                        style={{
                                            fontSize: '8px',
                                            lineHeight: 1,
                                            color: isToday ? C.orange : C.gray,
                                            visibility: showLabel ? 'visible' : 'hidden',
                                            userSelect: 'none',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {fmtShortDate(d.date)}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

/* ─── Avatar ──── */
function Avatar({ name, avatar }: { name: string, avatar?: string | null }) {
    const initials = name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
    const hue = name.charCodeAt(0) * 37 % 360;
    return (
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 bg-cover bg-center"
            style={{ background: avatar ? `url(${avatar}) center/cover` : `hsl(${hue},60%,50%)` }}>
            {!avatar && initials}
        </div>
    );
}

/* ═══════════════════ Main Page ═══════════════════ */
export default function ProviderHistoryPage() {
    const router = useRouter();
    const { t } = useLanguage();
    const { user, loading: authLoading } = useAuth();

    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [stats, setStats] = useState<HistoryStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);

    const [search, setSearch] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [filterService, setFilterService] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [page, setPage] = useState(1);
    const [period, setPeriod] = useState<7 | 14 | 30>(7);

    const initials = (user?.name || user?.email || 'P').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

    useEffect(() => {
        if (!authLoading && !user) router.push('/auth/login');
    }, [authLoading, user, router]);

    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const res = await api.get('/rescue-requests/provider/quotes');
                setQuotes(res.data ?? []);
            } catch { /* ignore */ }
            finally { setLoading(false); }
        })();
    }, [user]);

    useEffect(() => {
        if (!user) return;
        setStatsLoading(true);
        (async () => {
            try {
                const res = await api.get(`/me/provider/history-stats?days=${period}`);
                setStats(res.data);
            } catch { /* ignore */ }
            finally { setStatsLoading(false); }
        })();
    }, [user, period]);

    /* ── Filtering ── */
    const filtered = useMemo(() => {
        return quotes.filter(q => {
            const req = q.rescueRequest;
            const customerName = (req.user?.name ?? 'khách vãng lai').toLowerCase();
            const phone = req.user?.phoneNumber ?? req.contactPhone ?? '';
            const srch = search.toLowerCase();
            const assignee = req.assignedProviderId ?? null;
            const isWonJob = q.status === 'ACCEPTED' && assignee === user?.id;
            const lostQuote = ['CANCELLED', 'EXPIRED', 'REJECTED'].includes(q.status);

            if (srch && !customerName.includes(srch) && !phone.includes(srch) && !req.id.toLowerCase().includes(srch)) return false;
            if (filterDate) {
                const qDate = new Date(q.createdAt).toISOString().slice(0, 10);
                if (qDate !== filterDate) return false;
            }
            if (filterService !== 'all' && req.incidentType !== filterService) return false;
            if (filterStatus !== 'all') {
                const rs = req.status;
                if (filterStatus === 'completed') {
                    if (!isWonJob || (rs !== 'COMPLETED' && rs !== 'PAID')) return false;
                } else if (filterStatus === 'pending') {
                    if (!isWonJob || rs !== 'PAYMENT_PENDING') return false;
                } else if (filterStatus === 'active') {
                    if (q.status === 'PENDING' && rs === 'MATCHING') return true;
                    if (isWonJob && ['IN_PROGRESS', 'WORKING', 'ARRIVED', 'ASSIGNED'].includes(rs)) return true;
                    return false;
                } else if (filterStatus === 'cancelled') {
                    if (lostQuote) return true;
                    if (rs === 'CANCELLED' || rs === 'EXPIRED' || rs === 'FAILED') return true;
                    return false;
                }
            }
            return true;
        });
    }, [quotes, search, filterDate, filterService, filterStatus, user?.id]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const resetPage = () => setPage(1);

    /* ── CSV Export ── */
    const handleExportCsv = () => {
        if (filtered.length === 0) { toast.error(t('provider.history.noExport')); return; }

        const STATUS_LABELS: Record<string, string> = {
            COMPLETED: t('provider.history.statusBadge.COMPLETED'), PAID: t('provider.history.statusBadge.COMPLETED'),
            PAYMENT_PENDING: t('provider.history.statusBadge.PAYMENT_PENDING'), CANCELLED: t('provider.history.statusBadge.CANCELLED'),
            EXPIRED: t('provider.history.statusBadge.EXPIRED'), FAILED: t('provider.history.statusBadge.FAILED'),
            IN_PROGRESS: t('provider.history.statusBadge.IN_PROGRESS'), WORKING: t('provider.history.statusBadge.WORKING'),
            ARRIVED: t('provider.history.statusBadge.ARRIVED'), ACCEPTED: t('provider.history.statusBadge.ACCEPTED'),
            ASSIGNED: t('provider.history.statusBadge.ASSIGNED'), MATCHING: t('provider.history.statusBadge.MATCHING'),
        };

        const headers = ['#', 'Date', 'Time', t('provider.history.tableHeader.customer'), 'Phone', t('provider.history.tableHeader.service'), `${t('provider.history.chart.revenue')} (₫)`, `${t('provider.history.chart.profit')} (₫)`, t('provider.history.tableHeader.status')];

        const rows = filtered.map((q, idx) => {
            const req = q.rescueRequest;
            const { date, time } = fmtDate(q.createdAt);
            const assignee = req.assignedProviderId ?? null;
            const isWonJob = q.status === 'ACCEPTED' && assignee === user?.id;
            const isCompleted = isWonJob && (req.status === 'COMPLETED' || req.status === 'PAID');
            const revenueAmount = isWonJob ? (req.payment?.totalAmount ?? q.price) : q.price;
            const profit = isCompleted ? Math.round((req.payment?.totalAmount ?? q.price) * 0.9) : 0;
            let statusLabel = STATUS_LABELS[req.status] ?? req.status;
            if (q.status === 'REJECTED') statusLabel = t('provider.history.quoteStatusBadge.REJECTED');
            else if (q.status === 'PENDING' && req.status === 'MATCHING') statusLabel = t('provider.history.quoteStatusBadge.AWAITING_CUSTOMER');
            else if (q.status === 'CANCELLED' || q.status === 'EXPIRED') statusLabel = t('provider.history.quoteStatusBadge.NOT_SELECTED');
            else if (q.status === 'PENDING' && assignee && user?.id && assignee !== user.id) {
                statusLabel = t('provider.history.quoteStatusBadge.NOT_SELECTED');
            } else if (isWonJob) statusLabel = STATUS_LABELS[req.status] ?? req.status;
            return [
                idx + 1,
                date,
                time,
                req.user?.name ?? t('provider.history.customerFallback'),
                req.user?.phoneNumber ?? req.contactPhone ?? '',
                (t(`provider.incidents.${req.incidentType}`) || req.incidentType),
                revenueAmount,
                profit,
                statusLabel,
            ];
        });

        const escape = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
        const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');

        // BOM for Excel UTF-8 compatibility
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lichsu_cuuho_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(t('provider.history.exported').replace('{count}', String(filtered.length)));
    };

    if (authLoading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
                <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: C.orange }} />
            </div>
        );
    }

    // Block PENDING providers — no history yet
    if (user.verificationStatus === 'PENDING') return <PendingVerificationScreen />;

    const todayProfit = stats?.todayProfit ?? 0;
    const profitChange = stats?.profitChangePercent ?? 0;
    const weeklyRevenueTotal = stats?.weeklyRevenue?.reduce((s, d) => s + d.revenue, 0) ?? 0;
    const weeklyProfitTotal = stats?.weeklyRevenue?.reduce((s, d) => s + d.profit, 0) ?? 0;

    return (
        <ProviderLayout activeTab="/provider/history">
            <div className="min-h-screen" style={{ background: C.bg, fontFamily: "'Inter', 'Lexend', sans-serif" }}>

                {/* ── Header (matches settings page pattern) ── */}
                <header
                    className="flex items-center justify-between px-4 py-3 flex-shrink-0 sticky top-0 z-20"
                    style={{ background: '#ffffff', borderBottom: `1px solid ${C.border}` }}
                >
                    {/* Mobile: back arrow + RescueMe | Desktop: page title */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/provider/active')}
                            className="flex md:hidden items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 transition-colors"
                            style={{ color: C.navy }}
                        >
                            <ArrowLeft style={{ width: 18, height: 18 }} />
                        </button>
                        <div className="flex md:hidden items-center gap-2">
                            <RescueMeLogo size={24} textClass="hidden" />
                        </div>
                        <h2 className="hidden md:block text-base font-semibold" style={{ color: C.navy }}>{t('provider.history.title')}</h2>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
                            <span className="text-xs font-medium" style={{ color: '#64748b' }}>{t('provider.history.systemOk')}</span>
                        </div>
                        <LanguageSwitcher />
                        <button className="p-1.5 rounded-lg" style={{ color: '#94a3b8' }}>
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                        </button>
                        <AvatarImage
                            name={user?.name || user?.email || 'Provider'}
                            avatar={user?.avatar}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            fallbackBackground={C.orange}
                            initialsCount={1}
                        />
                    </div>
                </header>

                <div className="max-w-6xl mx-auto px-4 pt-5 pb-28">

                    {/* ── Title row ── */}
                    <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
                        <div>
                            <h1 className="text-xl font-bold" style={{ color: C.navy }}>{t('provider.history.title')}</h1>
                            <p className="text-sm mt-0.5" style={{ color: C.gray }}>{t('provider.history.subtitle')}</p>
                        </div>
                        <button
                            onClick={handleExportCsv}
                            disabled={filtered.length === 0}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all hover:shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ borderColor: C.border, color: C.gray, background: 'white' }}
                        >
                            <Download size={14} />
                            {t('provider.history.exportCsv')}
                        </button>
                    </div>

                    {/* ── Stats Row ── */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">

                        {/* Revenue chart card */}
                        <div className="bg-white rounded-2xl p-5 shadow-sm border" style={{ borderColor: C.border }}>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.gray }}>
                                        {t('provider.history.chart.revenueProfit')}
                                    </p>
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-bold"
                                        style={{ background: '#fef2f2', color: '#ef4444' }}>
                                        {t('provider.history.chart.platformFee')}
                                    </span>
                                </div>
                                <select
                                    className="text-xs font-semibold border rounded-lg px-2 py-1 outline-none"
                                    style={{ borderColor: C.border, color: C.navy }}
                                    value={period}
                                    onChange={e => setPeriod(Number(e.target.value) as 7 | 14 | 30)}
                                >
                                    <option value={7}>{t('provider.history.chart.days7')}</option>
                                    <option value={14}>{t('provider.history.chart.days14')}</option>
                                    <option value={30}>{t('provider.history.chart.days30')}</option>
                                </select>
                            </div>
                            <div className="flex items-baseline gap-2 mt-1">
                                <p className="text-2xl font-bold" style={{ color: C.navy }}>
                                    {fmtVnd(weeklyRevenueTotal)}
                                </p>
                                <span className="text-xl font-bold" style={{ color: C.green }}>
                                    / +{fmtVnd(weeklyProfitTotal)}
                                </span>
                            </div>
                            <p className="text-xs mb-3" style={{ color: C.green }}>
                                {(stats?.successRate ?? 0).toFixed(1)}% {t('provider.history.successRate.successful')}
                            </p>
                            {statsLoading ? (
                                <div className="h-20 flex items-center justify-center">
                                    <div className="w-5 h-5 rounded-full border-2 animate-spin"
                                        style={{ borderColor: C.orange, borderTopColor: 'transparent' }} />
                                </div>
                            ) : (
                                <MiniBarChart data={stats?.weeklyRevenue ?? []} />
                            )}
                        </div>

                        {/* Today profit */}
                        <div className="bg-white rounded-2xl p-5 shadow-sm border flex flex-col justify-between" style={{ borderColor: C.border }}>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: C.gray }}>
                                    {t('provider.history.todayProfit.label')}
                                </p>
                                <p className="text-3xl font-bold" style={{ color: C.navy }}>{fmtVnd(todayProfit)}</p>
                            </div>
                            <div className="mt-4">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs" style={{ color: C.gray }}>{t('provider.history.todayProfit.vsYesterday')}</span>
                                    <span className="text-xs font-bold flex items-center gap-1"
                                        style={{ color: profitChange >= 0 ? C.green : C.red }}>
                                        {profitChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                        {profitChange >= 0 ? '+' : ''}{profitChange}%
                                    </span>
                                </div>
                                <div className="w-full rounded-full h-1.5" style={{ background: '#f1f5f9' }}>
                                    <div className="h-1.5 rounded-full transition-all"
                                        style={{
                                            width: `${Math.min(Math.abs(profitChange), 100)}%`,
                                            background: profitChange >= 0 ? C.green : C.red,
                                        }} />
                                </div>
                            </div>
                        </div>

                        {/* Success rate + Rating stacked */}
                        <div className="flex flex-col gap-3">
                            {/* Success Rate */}
                            <div className="bg-white rounded-2xl p-4 shadow-sm border flex-1" style={{ borderColor: C.border }}>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: C.blueLight }}>
                                        <CheckCircle2 size={18} style={{ color: C.blue }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.gray }}>
                                            {t('provider.history.successRate.label')}
                                        </p>
                                        <p className="text-xl font-bold" style={{ color: C.navy }}>
                                            {statsLoading ? '...' : `${(stats?.successRate ?? 0).toFixed(1)}%`}
                                        </p>
                                    </div>
                                </div>
                                {!statsLoading && stats && (
                                    <div className="mt-3 flex items-center gap-3 text-xs" style={{ color: C.gray }}>
                                        <span className="flex items-center gap-1">
                                            <CheckCircle2 size={11} style={{ color: C.green }} />
                                            {stats.totalCompleted} {t('provider.history.successRate.successful')}
                                        </span>
                                        <span>·</span>
                                        <span className="flex items-center gap-1">
                                            <XCircle size={11} style={{ color: C.red }} />
                                            {stats.totalAccepted - stats.totalCompleted} {t('provider.history.successRate.failed')}
                                        </span>
                                        <span>·</span>
                                        <span>{stats.totalAccepted} {t('provider.history.successRate.total')}</span>
                                    </div>
                                )}
                            </div>

                            {/* Avg Rating */}
                            <div className="bg-white rounded-2xl p-4 shadow-sm border flex-1" style={{ borderColor: C.border }}>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#fefce8' }}>
                                        <Star size={18} style={{ color: C.yellow }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.gray }}>
                                            {t('provider.history.avgRating.label')}
                                        </p>
                                        <p className="text-xl font-bold" style={{ color: C.navy }}>
                                            {statsLoading ? '...' : stats?.avgRating != null ? `${stats.avgRating}/5.0` : t('provider.history.avgRating.noRating')}
                                        </p>
                                    </div>
                                </div>
                                {!statsLoading && stats && stats.reviewCount > 0 && (
                                    <p className="mt-2 text-xs" style={{ color: C.gray }}>
                                        {t('provider.history.avgRating.fromReviews').replace('{count}', String(stats.reviewCount))}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Filter bar ── */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm border mb-4 flex flex-wrap gap-3 items-center"
                        style={{ borderColor: C.border }}>
                        <div className="flex-1 min-w-52 relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94a3b8' }} />
                            <input
                                type="text"
                                placeholder={t('provider.history.filter.searchPlaceholder')}
                                className="w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm outline-none"
                                style={{ borderColor: C.border, color: C.navy }}
                                value={search}
                                onChange={e => { setSearch(e.target.value); resetPage(); }}
                            />
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm"
                            style={{ borderColor: C.border }}>
                            <Calendar size={13} style={{ color: C.gray }} />
                            <input type="date" className="outline-none text-sm" style={{ color: C.navy }}
                                value={filterDate}
                                onChange={e => { setFilterDate(e.target.value); resetPage(); }} />
                        </div>
                        <select
                            className="px-3 py-2.5 rounded-xl border text-sm outline-none font-medium"
                            style={{ borderColor: C.border, color: C.navy }}
                            value={filterService}
                            onChange={e => { setFilterService(e.target.value); resetPage(); }}
                        >
                            <option value="all">{t('provider.history.filter.allServices')}</option>
                            {(Object.keys(INCIDENT_LABELS) as IncidentType[]).map((k) => (
                                <option key={k} value={k}>{t(`provider.incidents.${k}`)}</option>
                            ))}
                        </select>
                        <select
                            className="px-3 py-2.5 rounded-xl border text-sm outline-none font-medium"
                            style={{ borderColor: C.border, color: C.navy }}
                            value={filterStatus}
                            onChange={e => { setFilterStatus(e.target.value); resetPage(); }}
                        >
                            <option value="all">{t('provider.history.filter.allStatuses')}</option>
                            <option value="completed">{t('provider.history.filter.completed')}</option>
                            <option value="pending">{t('provider.history.filter.waitingPayment')}</option>
                            <option value="active">{t('provider.history.filter.inProgress')}</option>
                            <option value="cancelled">{t('provider.history.filter.cancelled')}</option>
                        </select>
                        <button className="p-2.5 rounded-xl border" style={{ borderColor: C.border }}>
                            <Filter size={15} style={{ color: C.gray }} />
                        </button>
                    </div>

                    {/* ── Table ── */}
                    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden" style={{ borderColor: C.border }}>
                        {/* Desktop header */}
                        <div className="hidden md:grid grid-cols-[160px_1fr_130px_160px_120px_130px_52px] gap-4 px-5 py-3"
                            style={{ borderBottom: `1px solid ${C.border}`, background: '#f8fafc' }}>
                            {[t('provider.history.tableHeader.dateId'), t('provider.history.tableHeader.customer'), t('provider.history.tableHeader.service'), t('provider.history.tableHeader.revenueProfit'), t('provider.history.tableHeader.status'), t('provider.history.tableHeader.payment'), ''].map((h, i) => (
                                <span key={i} className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.gray }}>{h}</span>
                            ))}
                        </div>

                        {/* Rows */}
                        {loading ? (
                            <div className="flex justify-center items-center py-16">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: C.orange }} />
                            </div>
                        ) : pageItems.length === 0 ? (
                            <div className="text-center py-16">
                                <Clock size={36} className="mx-auto mb-3" style={{ color: '#e2e8f0' }} />
                                <p className="font-semibold" style={{ color: C.navy }}>{t('provider.history.empty')}</p>
                                <p className="text-sm mt-1" style={{ color: C.gray }}>{t('provider.history.emptySub')}</p>
                            </div>
                        ) : (
                            <div>
                                {pageItems.map((q, idx) => {
                                    const req = q.rescueRequest;
                                    const { date, time } = fmtDate(q.createdAt);
                                    const assignee = req.assignedProviderId ?? null;
                                    const isWonJob = q.status === 'ACCEPTED' && assignee === user?.id;
                                    const lostQuote = ['CANCELLED', 'EXPIRED', 'REJECTED'].includes(q.status);
                                    const revenueAmount = isWonJob ? (req.payment?.totalAmount ?? q.price) : q.price;
                                    const profit = Math.round(revenueAmount * 0.9);
                                    const incColor = INCIDENT_COLORS[req.incidentType] ?? { bg: '#f3f4f6', color: C.gray };
                                    const isCompleted = isWonJob && (req.status === 'COMPLETED' || req.status === 'PAID');
                                    const isPending = isWonJob && req.status === 'PAYMENT_PENDING';
                                    const showStrike = lostQuote || (isWonJob && ['CANCELLED', 'EXPIRED', 'FAILED'].includes(req.status));

                                    return (
                                        <div key={q.id} style={{ borderTop: idx > 0 ? `1px solid #f1f5f9` : 'none' }}>
                                            <button
                                                onClick={() => router.push(`/provider/history/${req.id}`)}
                                                className="w-full text-left transition-colors hover:bg-gray-50/70 active:bg-gray-100/70"
                                            >
                                                {/* Desktop */}
                                                <div className="hidden md:grid grid-cols-[160px_1fr_130px_160px_120px_130px_52px] gap-4 items-center px-5 py-4">
                                                    <div>
                                                        <p className="text-sm font-semibold" style={{ color: C.navy }}>{date}</p>
                                                        <p className="text-xs mt-0.5" style={{ color: C.gray }}>{time}</p>
                                                        <p className="text-[10px] mt-1 font-mono font-bold" style={{ color: '#94a3b8' }}>#{displayOrderCode(req.orderCode, req.id)}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <Avatar name={req.user?.name ?? 'K'} avatar={req.user?.avatar} />
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold truncate" style={{ color: C.navy }}>
                                                                {req.user?.name ?? t('provider.history.customerFallback')}
                                                            </p>
                                                            {(req.user?.phoneNumber ?? req.contactPhone) && (
                                                                <p className="text-xs truncate" style={{ color: C.gray }}>
                                                                    {req.user?.phoneNumber ?? req.contactPhone}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold w-fit"
                                                        style={{ background: incColor.bg, color: incColor.color }}>
                                                        {t(`provider.incidents.${req.incidentType}`) || req.incidentType}
                                                    </span>
                                                    <div>
                                                        {isPending ? (
                                                            <p className="text-sm font-bold" style={{ color: C.orange }}>{t('provider.history.waitingPayment')}</p>
                                                        ) : showStrike ? (
                                                            <p className="text-sm line-through" style={{ color: '#9ca3af' }}>{fmtVnd(q.price)}</p>
                                                        ) : isWonJob ? (
                                                            <>
                                                                <p className="text-sm font-bold" style={{ color: C.navy }}>{fmtVnd(revenueAmount)}</p>
                                                                {revenueAmount !== q.price && (
                                                                    <p className="text-[10px]" style={{ color: C.gray }}>{t('provider.history.quoteLabel')}: {fmtVnd(q.price)}</p>
                                                                )}
                                                                {isCompleted && (
                                                                    <p className="text-xs font-semibold mt-0.5" style={{ color: C.green }}>+{fmtVnd(profit)} {t('provider.history.profitLabel')}</p>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <>
                                                                <p className="text-sm font-bold" style={{ color: C.navy }}>{fmtVnd(q.price)}</p>
                                                                {q.status === 'PENDING' && (
                                                                    <p className="text-[10px]" style={{ color: C.gray }}>{t('provider.history.revenueHint.yourQuoteOnly')}</p>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                    <HistoryRowStatusBadge q={q} providerId={user?.id} />
                                                    {isWonJob ? (
                                                        <PaymentBadge walletTxStatus={req.payment?.walletTxStatus} paymentMethod={req.payment?.paymentMethod} />
                                                    ) : (
                                                        <span className="text-xs text-center" style={{ color: '#cbd5e1' }}>—</span>
                                                    )}
                                                    <div className="flex justify-center">
                                                        <ChevronRight size={15} style={{ color: '#cbd5e1' }} />
                                                    </div>
                                                </div>

                                                {/* Mobile */}
                                                <div className="md:hidden px-4 py-4">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex items-center gap-3 min-w-0">
                                            <Avatar name={req.user?.name ?? 'K'} avatar={req.user?.avatar} />
                                            <div className="min-w-0">
                                                <p className="font-semibold text-sm truncate" style={{ color: C.navy }}>
                                                    {req.user?.name ?? t('provider.history.customerFallback')}
                                                </p>
                                                                <p className="text-xs" style={{ color: C.gray }}>{date} · {time}</p>
                                                                <p className="text-[10px] font-mono font-bold mt-0.5" style={{ color: '#94a3b8' }}>#{displayOrderCode(req.orderCode, req.id)}</p>
                                                            </div>
                                                        </div>
                                                        <ChevronRight size={15} style={{ color: '#cbd5e1', flexShrink: 0 }} />
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                                                            style={{ background: incColor.bg, color: incColor.color }}>
                                                            {t(`provider.incidents.${req.incidentType}`) || req.incidentType}
                                                        </span>
                                                        <HistoryRowStatusBadge q={q} providerId={user?.id} />
                                                        {isWonJob ? (
                                                            <PaymentBadge walletTxStatus={req.payment?.walletTxStatus} paymentMethod={req.payment?.paymentMethod} />
                                                        ) : null}
                                                        <span className="ml-auto text-sm font-bold"
                                                            style={{ color: showStrike ? '#9ca3af' : C.navy }}>
                                                            {fmtVnd(isWonJob ? revenueAmount : q.price)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Pagination */}
                        {!loading && filtered.length > 0 && (
                            <div className="flex items-center justify-between px-5 py-3.5 flex-wrap gap-3"
                                style={{ borderTop: `1px solid #f1f5f9`, background: '#fafafa' }}>
                                <p className="text-sm" style={{ color: C.gray }}>
                                    {t('provider.history.ordersCount')
                                        .replace('{min}', String(Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)))
                                        .replace('{max}', String(Math.min(page * PAGE_SIZE, filtered.length)))
                                        .replace('{total}', String(filtered.length))}
                                </p>
                                <div className="flex items-center gap-1">
                                    <button
                                        disabled={page === 1}
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        className="w-8 h-8 rounded-lg flex items-center justify-center border transition-all disabled:opacity-40"
                                        style={{ borderColor: C.border, color: C.navy }}
                                    >
                                        <ChevronLeft size={14} />
                                    </button>
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let p: number;
                                        if (totalPages <= 5) p = i + 1;
                                        else if (page <= 3) p = i + 1;
                                        else if (page >= totalPages - 2) p = totalPages - 4 + i;
                                        else p = page - 2 + i;
                                        return (
                                            <button key={p} onClick={() => setPage(p)}
                                                className="w-8 h-8 rounded-lg text-sm font-semibold border transition-all"
                                                style={{
                                                    background: p === page ? C.orange : 'white',
                                                    color: p === page ? 'white' : C.navy,
                                                    borderColor: p === page ? C.orange : C.border,
                                                }}>
                                                {p}
                                            </button>
                                        );
                                    })}
                                    {totalPages > 5 && page < totalPages - 2 && (
                                        <>
                                            <span style={{ color: C.gray }} className="px-1 text-xs">...</span>
                                            <button onClick={() => setPage(totalPages)}
                                                className="w-8 h-8 rounded-lg text-sm font-semibold border transition-all"
                                                style={{ background: 'white', color: C.navy, borderColor: C.border }}>
                                                {totalPages}
                                            </button>
                                        </>
                                    )}
                                    <button
                                        disabled={page === totalPages}
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        className="w-8 h-8 rounded-lg flex items-center justify-center border transition-all disabled:opacity-40"
                                        style={{ borderColor: C.border, color: C.navy }}
                                    >
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </ProviderLayout>
    );
}
