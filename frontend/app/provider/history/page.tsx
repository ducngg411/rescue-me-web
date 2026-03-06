'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import ProviderLayout from '@/components/ProviderLayout';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import {
    Search, ChevronRight, ChevronLeft, Calendar,
    TrendingUp, TrendingDown, CheckCircle2, XCircle,
    Clock, Star, Filter, Download,
} from 'lucide-react';
import toast from 'react-hot-toast';

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
        status: RequestStatus;
        incidentType: IncidentType;
        description: string | null;
        pickupAddress: string | null;
        createdAt: string;
        completedAt?: string | null;
        user: { id: string; name: string | null; phoneNumber: string | null };
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

function StatusBadge({ status }: { status: RequestStatus }) {
    const cfg: Record<string, { label: string; dot: string; color: string; bg: string }> = {
        COMPLETED: { label: 'Hoàn thành', dot: C.green, color: C.green, bg: C.greenLight },
        PAID: { label: 'Hoàn thành', dot: C.green, color: C.green, bg: C.greenLight },
        PAYMENT_PENDING: { label: 'Chờ thanh toán', dot: C.yellow, color: '#ca8a04', bg: '#fefce8' },
        IN_PROGRESS: { label: 'Đang xử lý', dot: C.yellow, color: '#ca8a04', bg: '#fefce8' },
        WORKING: { label: 'Đang xử lý', dot: C.yellow, color: '#ca8a04', bg: '#fefce8' },
        ARRIVED: { label: 'Đã đến', dot: C.blue, color: C.blue, bg: C.blueLight },
        CANCELLED: { label: 'Đã hủy', dot: '#9ca3af', color: '#6b7280', bg: '#f9fafb' },
        EXPIRED: { label: 'Hết hạn', dot: '#9ca3af', color: '#6b7280', bg: '#f9fafb' },
        FAILED: { label: 'Thất bại', dot: C.red, color: C.red, bg: C.redLight },
        ACCEPTED: { label: 'Đã nhận', dot: C.blue, color: C.blue, bg: C.blueLight },
        ASSIGNED: { label: 'Được giao', dot: C.blue, color: C.blue, bg: C.blueLight },
        MATCHING: { label: 'Đang tìm', dot: C.yellow, color: '#ca8a04', bg: '#fefce8' },
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

/* ─── Bar Chart ──── */
const CHART_H = 64; // px – bar area
const LABEL_H = 16; // px – label row

function MiniBarChart({ data }: { data: DayStat[] }) {
    const [hover, setHover] = useState<{ idx: number; x: number; y: number } | null>(null);

    if (!data || data.length === 0) {
        return (
            <div className="h-20 flex items-center justify-center">
                <p className="text-xs" style={{ color: C.gray }}>Chưa có dữ liệu doanh thu</p>
            </div>
        );
    }

    const maxVal = Math.max(...data.map(d => d.revenue), 1);
    // Show at most 7 date labels regardless of period to prevent overflow
    const showEvery = data.length <= 7 ? 1 : data.length <= 14 ? 2 : Math.ceil(data.length / 7);

    return (
        <>
            {/* Fixed-position tooltip – never clipped by overflow */}
            {hover && (
                <div
                    style={{
                        position: 'fixed',
                        left: hover.x,
                        top: hover.y - 40,
                        transform: 'translateX(-50%)',
                        background: C.navy,
                        color: 'white',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '4px 9px',
                        borderRadius: '7px',
                        whiteSpace: 'nowrap',
                        zIndex: 9999,
                        pointerEvents: 'none',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    }}
                >
                    {fmtShortDate(data[hover.idx].date)}: {fmtVnd(data[hover.idx].revenue)}
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
                        gap: '3px',
                        // Each bar needs at least 18 px so labels don't smash together
                        minWidth: `${data.length * 18}px`,
                    }}
                >
                    {data.map((d, i) => {
                        const barH = d.revenue > 0
                            ? Math.max(Math.round((d.revenue / maxVal) * CHART_H), 4)
                            : 2;
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
                                {/* Bar */}
                                <div
                                    style={{
                                        width: '100%',
                                        height: `${barH}px`,
                                        borderRadius: '3px 3px 0 0',
                                        background: isHovered
                                            ? `linear-gradient(to top, ${C.orangeDark}, ${C.orange})`
                                            : isToday
                                            ? `linear-gradient(to top, ${C.orangeDark}, ${C.orange})`
                                            : d.revenue > 0 ? 'rgba(249,115,22,0.32)' : '#f1f5f9',
                                        transition: 'background 0.18s, opacity 0.18s',
                                        opacity: hover !== null && !isHovered && !isToday ? 0.55 : 1,
                                        flexShrink: 0,
                                    }}
                                />
                                {/* Date label row – fixed height keeps bars flush */}
                                <div style={{ height: `${LABEL_H}px`, display: 'flex', alignItems: 'center' }}>
                                    <span
                                        style={{
                                            fontSize: '8px',
                                            lineHeight: 1,
                                            color: isToday ? C.orange : C.gray,
                                            visibility: showLabel ? 'visible' : 'hidden',
                                            userSelect: 'none',
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
        </>
    );
}

/* ─── Avatar ──── */
function Avatar({ name }: { name: string }) {
    const initials = name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
    const hue = name.charCodeAt(0) * 37 % 360;
    return (
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ background: `hsl(${hue},60%,50%)` }}>
            {initials}
        </div>
    );
}

/* ═══════════════════ Main Page ═══════════════════ */
export default function ProviderHistoryPage() {
    const router = useRouter();
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
            const customerName = req.user.name?.toLowerCase() ?? '';
            const phone = req.user.phoneNumber ?? '';
            const srch = search.toLowerCase();

            if (srch && !customerName.includes(srch) && !phone.includes(srch) && !req.id.toLowerCase().includes(srch)) return false;
            if (filterDate) {
                const qDate = new Date(q.createdAt).toISOString().slice(0, 10);
                if (qDate !== filterDate) return false;
            }
            if (filterService !== 'all' && req.incidentType !== filterService) return false;
            if (filterStatus !== 'all') {
                const rs = req.status;
                if (filterStatus === 'completed' && rs !== 'COMPLETED' && rs !== 'PAID') return false;
                if (filterStatus === 'pending' && rs !== 'PAYMENT_PENDING') return false;
                if (filterStatus === 'active' && !['IN_PROGRESS', 'WORKING', 'ARRIVED', 'ACCEPTED', 'ASSIGNED', 'MATCHING'].includes(rs)) return false;
                if (filterStatus === 'cancelled' && rs !== 'CANCELLED' && rs !== 'EXPIRED' && rs !== 'FAILED') return false;
            }
            return true;
        });
    }, [quotes, search, filterDate, filterService, filterStatus]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const resetPage = () => setPage(1);

    /* ── CSV Export ── */
    const handleExportCsv = () => {
        if (filtered.length === 0) { toast.error('Không có dữ liệu để xuất'); return; }

        const STATUS_LABELS: Record<string, string> = {
            COMPLETED: 'Hoàn thành', PAID: 'Hoàn thành',
            PAYMENT_PENDING: 'Chờ thanh toán', CANCELLED: 'Đã hủy',
            EXPIRED: 'Hết hạn', FAILED: 'Thất bại',
            IN_PROGRESS: 'Đang xử lý', WORKING: 'Đang xử lý',
            ARRIVED: 'Đã đến', ACCEPTED: 'Đã nhận',
            ASSIGNED: 'Được giao', MATCHING: 'Đang tìm',
        };

        const headers = ['STT', 'Ngày', 'Giờ', 'Khách hàng', 'Số điện thoại', 'Loại dịch vụ', 'Doanh thu (đ)', 'Lợi nhuận ước tính (đ)', 'Trạng thái'];

        const rows = filtered.map((q, idx) => {
            const req = q.rescueRequest;
            const { date, time } = fmtDate(q.createdAt);
            const isCompleted = req.status === 'COMPLETED' || req.status === 'PAID';
            const profit = isCompleted ? Math.round(q.price * 0.9) : 0;
            return [
                idx + 1,
                date,
                time,
                req.user.name ?? 'Khách hàng',
                req.user.phoneNumber ?? '',
                INCIDENT_LABELS[req.incidentType] ?? req.incidentType,
                q.price,
                profit,
                STATUS_LABELS[req.status] ?? req.status,
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
        toast.success(`Đã xuất ${filtered.length} đơn hàng`);
    };

    if (authLoading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
                <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: C.orange }} />
            </div>
        );
    }

    const todayProfit = stats?.todayProfit ?? 0;
    const profitChange = stats?.profitChangePercent ?? 0;
    const weeklyTotal = stats?.weeklyRevenue?.reduce((s, d) => s + d.revenue, 0) ?? 0;

    return (
        <ProviderLayout activeTab="/provider/history">
            <div className="min-h-screen" style={{ background: C.bg, fontFamily: "'Inter', 'Poppins', sans-serif" }}>

                {/* ── Header (matches settings page pattern) ── */}
                <header
                    className="flex items-center justify-between px-4 py-3 flex-shrink-0 sticky top-0 z-20"
                    style={{ background: '#ffffff', borderBottom: `1px solid ${C.border}` }}
                >
                    <div className="flex items-center gap-2 md:hidden">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: C.orange }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                <path d="M12 2L4 7v10l8 5 8-5V7L12 2z" fill="white" opacity="0.9" />
                            </svg>
                        </div>
                        <span className="font-bold text-sm" style={{ color: C.navy }}>RescueMe</span>
                    </div>
                    <h2 className="hidden md:block text-base font-semibold" style={{ color: C.navy }}>Lịch sử công việc</h2>

                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
                            <span className="text-xs font-medium" style={{ color: '#64748b' }}>Hệ thống hoạt động</span>
                        </div>
                        <LanguageSwitcher />
                        <button className="p-1.5 rounded-lg" style={{ color: '#94a3b8' }}>
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                        </button>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ background: C.orange }}>
                            {initials.charAt(0)}
                        </div>
                    </div>
                </header>

                <div className="max-w-6xl mx-auto px-4 pt-5 pb-28">

                    {/* ── Title row ── */}
                    <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
                        <div>
                            <h1 className="text-xl font-bold" style={{ color: C.navy }}>Lịch sử công việc</h1>
                            <p className="text-sm mt-0.5" style={{ color: C.gray }}>Quản lý và theo dõi hiệu suất cứu hộ của bạn.</p>
                        </div>
                        <button
                            onClick={handleExportCsv}
                            disabled={filtered.length === 0}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all hover:shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ borderColor: C.border, color: C.gray, background: 'white' }}
                        >
                            <Download size={14} />
                            Xuất CSV
                        </button>
                    </div>

                    {/* ── Stats Row ── */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">

                        {/* Revenue chart card */}
                        <div className="bg-white rounded-2xl p-5 shadow-sm border" style={{ borderColor: C.border }}>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.gray }}>
                                    Doanh thu
                                </p>
                                <select
                                    className="text-xs font-semibold border rounded-lg px-2 py-1 outline-none"
                                    style={{ borderColor: C.border, color: C.navy }}
                                    value={period}
                                    onChange={e => setPeriod(Number(e.target.value) as 7 | 14 | 30)}
                                >
                                    <option value={7}>7 ngày</option>
                                    <option value={14}>14 ngày</option>
                                    <option value={30}>30 ngày</option>
                                </select>
                            </div>
                            <p className="text-2xl font-bold" style={{ color: C.navy }}>{fmtVnd(weeklyTotal)}</p>
                            <p className="text-xs mb-3" style={{ color: C.green }}>
                                {(stats?.successRate ?? 0).toFixed(1)}% tỷ lệ thành công
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
                                    Lợi nhuận hôm nay
                                </p>
                                <p className="text-3xl font-bold" style={{ color: C.navy }}>{fmtVnd(todayProfit)}</p>
                            </div>
                            <div className="mt-4">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs" style={{ color: C.gray }}>So với hôm qua</span>
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
                                            Tỷ lệ thành công
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
                                            {stats.totalCompleted} thành công
                                        </span>
                                        <span>·</span>
                                        <span className="flex items-center gap-1">
                                            <XCircle size={11} style={{ color: C.red }} />
                                            {stats.totalAccepted - stats.totalCompleted} thất bại
                                        </span>
                                        <span>·</span>
                                        <span>{stats.totalAccepted} tổng</span>
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
                                            Đánh giá trung bình
                                        </p>
                                        <p className="text-xl font-bold" style={{ color: C.navy }}>
                                            {statsLoading ? '...' : stats?.avgRating != null ? `${stats.avgRating}/5.0` : 'Chưa có'}
                                        </p>
                                    </div>
                                </div>
                                {!statsLoading && stats && stats.reviewCount > 0 && (
                                    <p className="mt-2 text-xs" style={{ color: C.gray }}>
                                        Từ {stats.reviewCount} đánh giá của khách hàng
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
                                placeholder="Tìm kiếm khách hàng, mã đơn..."
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
                            <option value="all">Tất cả dịch vụ</option>
                            {Object.entries(INCIDENT_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                            ))}
                        </select>
                        <select
                            className="px-3 py-2.5 rounded-xl border text-sm outline-none font-medium"
                            style={{ borderColor: C.border, color: C.navy }}
                            value={filterStatus}
                            onChange={e => { setFilterStatus(e.target.value); resetPage(); }}
                        >
                            <option value="all">Tất cả trạng thái</option>
                            <option value="completed">Hoàn thành</option>
                            <option value="pending">Chờ thanh toán</option>
                            <option value="active">Đang xử lý</option>
                            <option value="cancelled">Đã hủy</option>
                        </select>
                        <button className="p-2.5 rounded-xl border" style={{ borderColor: C.border }}>
                            <Filter size={15} style={{ color: C.gray }} />
                        </button>
                    </div>

                    {/* ── Table ── */}
                    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden" style={{ borderColor: C.border }}>
                        {/* Desktop header */}
                        <div className="hidden md:grid grid-cols-[140px_1fr_130px_160px_140px_52px] gap-4 px-5 py-3"
                            style={{ borderBottom: `1px solid ${C.border}`, background: '#f8fafc' }}>
                            {['NGÀY / GIỜ', 'KHÁCH HÀNG', 'LOẠI DỊCH VỤ', 'DOANH THU / LÃI', 'TRẠNG THÁI', ''].map((h, i) => (
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
                                <p className="font-semibold" style={{ color: C.navy }}>Không có đơn hàng nào</p>
                                <p className="text-sm mt-1" style={{ color: C.gray }}>Thử thay đổi bộ lọc hoặc tìm kiếm khác.</p>
                            </div>
                        ) : (
                            <div>
                                {pageItems.map((q, idx) => {
                                    const req = q.rescueRequest;
                                    const { date, time } = fmtDate(q.createdAt);
                                    const profit = Math.round(q.price * 0.9);
                                    const incColor = INCIDENT_COLORS[req.incidentType] ?? { bg: '#f3f4f6', color: C.gray };
                                    const isCompleted = req.status === 'COMPLETED' || req.status === 'PAID';
                                    const isPending = req.status === 'PAYMENT_PENDING';
                                    const isCancelled = ['CANCELLED', 'EXPIRED', 'FAILED'].includes(req.status);

                                    return (
                                        <div key={q.id} style={{ borderTop: idx > 0 ? `1px solid #f1f5f9` : 'none' }}>
                                            <button
                                                onClick={() => router.push(`/provider/history/${req.id}`)}
                                                className="w-full text-left transition-colors hover:bg-gray-50/70 active:bg-gray-100/70"
                                            >
                                                {/* Desktop */}
                                                <div className="hidden md:grid grid-cols-[140px_1fr_130px_160px_140px_52px] gap-4 items-center px-5 py-4">
                                                    <div>
                                                        <p className="text-sm font-semibold" style={{ color: C.navy }}>{date}</p>
                                                        <p className="text-xs mt-0.5" style={{ color: C.gray }}>{time}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <Avatar name={req.user.name ?? 'K'} />
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold truncate" style={{ color: C.navy }}>
                                                                {req.user.name ?? 'Khách hàng'}
                                                            </p>
                                                            {req.user.phoneNumber && (
                                                                <p className="text-xs truncate" style={{ color: C.gray }}>
                                                                    {req.user.phoneNumber}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold w-fit"
                                                        style={{ background: incColor.bg, color: incColor.color }}>
                                                        {INCIDENT_LABELS[req.incidentType] ?? req.incidentType}
                                                    </span>
                                                    <div>
                                                        {isPending ? (
                                                            <p className="text-sm font-bold" style={{ color: C.orange }}>Chờ thanh toán</p>
                                                        ) : isCancelled ? (
                                                            <p className="text-sm line-through" style={{ color: '#9ca3af' }}>{fmtVnd(q.price)}</p>
                                                        ) : (
                                                            <>
                                                                <p className="text-sm font-bold" style={{ color: C.navy }}>{fmtVnd(q.price)}</p>
                                                                {isCompleted && (
                                                                    <p className="text-xs font-semibold mt-0.5" style={{ color: C.green }}>
                                                                        +{fmtVnd(profit)} lãi
                                                                    </p>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                    <StatusBadge status={req.status} />
                                                    <div className="flex justify-center">
                                                        <ChevronRight size={15} style={{ color: '#cbd5e1' }} />
                                                    </div>
                                                </div>

                                                {/* Mobile */}
                                                <div className="md:hidden px-4 py-4">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <Avatar name={req.user.name ?? 'K'} />
                                                            <div className="min-w-0">
                                                                <p className="font-semibold text-sm truncate" style={{ color: C.navy }}>
                                                                    {req.user.name ?? 'Khách hàng'}
                                                                </p>
                                                                <p className="text-xs" style={{ color: C.gray }}>{date} · {time}</p>
                                                            </div>
                                                        </div>
                                                        <ChevronRight size={15} style={{ color: '#cbd5e1', flexShrink: 0 }} />
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                                                            style={{ background: incColor.bg, color: incColor.color }}>
                                                            {INCIDENT_LABELS[req.incidentType] ?? req.incidentType}
                                                        </span>
                                                        <StatusBadge status={req.status} />
                                                        <span className="ml-auto text-sm font-bold"
                                                            style={{ color: isCancelled ? '#9ca3af' : C.navy }}>
                                                            {fmtVnd(q.price)}
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
                                    {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} / {filtered.length} đơn
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
