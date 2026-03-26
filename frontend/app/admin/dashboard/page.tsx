'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminGuard } from '@/lib/guards';
import { adminApi } from '@/lib/api';
import AdminLayout from '@/components/AdminLayout';
import { ChartCard, HorizontalBarChart, DonutChart, VerticalBarChart } from '@/components/AdminCharts';
import {
    RefreshCw, ArrowRight, Users, ShieldCheck, AlertTriangle,
    TrendingUp, Wallet, FileText, CreditCard, Settings,
    Banknote, Clock, CheckCircle2, XCircle, Activity,
} from 'lucide-react';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
    orange: '#f97316',
    orangeDark: '#ea6c0a',
    orangeLight: '#fff7ed',
    orangeMid: '#fdba74',
    navy: '#1a1a2e',
    gray: '#6b7280',
    grayLight: '#94a3b8',
    border: '#e2e8f0',
    bg: '#f4f6f9',
    white: '#ffffff',
    green: '#16a34a',
    greenLight: '#f0fdf4',
    red: '#ef4444',
    redLight: '#fef2f2',
    yellow: '#d97706',
    yellowLight: '#fef9c3',
    blue: '#2563eb',
    blueLight: '#eff6ff',
    purple: '#7c3aed',
    purpleLight: '#f5f3ff',
};

// ─── Formatters ────────────────────────────────────────────────────────────────
function fmtVnd(v?: number | null): string {
    if (v == null) return '—';
    if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + ' tỷ';
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + ' tr';
    if (v >= 1_000) return (v / 1_000).toFixed(0) + 'k';
    return v.toLocaleString('vi-VN');
}

function fmtNum(v?: number | null): string {
    if (v == null) return '—';
    return v.toLocaleString('vi-VN');
}

function greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Chào buổi sáng';
    if (h < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
}

// ─── SVG Donut Chart ───────────────────────────────────────────────────────────
// imported from AdminCharts.

// ─── Skeleton Loader ─────────────────────────────────────────────────────────
function Skeleton({ className = '' }: { className?: string }) {
    return (
        <div
            className={`rounded-lg animate-pulse ${className}`}
            style={{ background: 'linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)', backgroundSize: '200% 100%' }}
        />
    );
}

// ─── Loading KPI Card ─────────────────────────────────────────────────────────
function KpiSkeleton() {
    return (
        <div className="p-4 rounded-2xl border" style={{ background: C.white, borderColor: C.border }}>
            <Skeleton className="w-10 h-10 mb-3" />
            <Skeleton className="w-24 h-3 mb-2" />
            <Skeleton className="w-16 h-7 mb-2" />
            <Skeleton className="w-20 h-3" />
        </div>
    );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
interface KpiProps {
    label: string; value: string;
    sub?: string; href: string;
    icon: React.ReactNode; accent?: boolean;
    iconBg?: string; iconColor?: string;
}
function KpiCard({ label, value, sub, href, icon, accent, iconBg, iconColor }: KpiProps) {
    const router = useRouter();
    return (
        <button
            onClick={() => router.push(href)}
            className="text-left p-4 rounded-2xl border hover:shadow-md transition-all group"
            style={{
                background: accent
                    ? `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)`
                    : C.white,
                borderColor: accent ? 'transparent' : C.border,
            }}
        >
            <div className="flex items-start justify-between mb-3">
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: accent ? 'rgba(255,255,255,0.2)' : (iconBg ?? C.bg), color: accent ? '#fff' : (iconColor ?? C.orange) }}
                >
                    {icon}
                </div>
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity mt-1"
                    style={{ color: accent ? 'rgba(255,255,255,0.7)' : C.grayLight }} />
            </div>
            <p className="text-xs font-medium mb-1" style={{ color: accent ? 'rgba(255,255,255,0.75)' : C.gray }}>{label}</p>
            <p className="text-2xl font-bold leading-tight" style={{ color: accent ? '#fff' : C.navy }}>{value}</p>
            {sub && <p className="text-xs mt-1" style={{ color: accent ? 'rgba(255,255,255,0.65)' : C.grayLight }}>{sub}</p>}
        </button>
    );
}

// ────────────────────────────────────────────────────────────────────────────────

interface AllStats {
    txSummary: { totalRevenue: number; totalCommission: number; totalTopupToday: number; pendingTransactions: number; pendingWithdrawals: number } | null;
    providerStats: { total: number; pending: number; approved: number; rejected: number; suspended: number } | null;
    disputeStats: { new: number; inProgress: number; resolved: number; total: number } | null;
    userStats: { total: number; active: number; inactive: number; newThisMonth: number } | null;
    requestStats: { total: number; completed: number; cancelled: number; disputed: number; newThisMonth: number } | null;
    withdrawalStats: { total: { pending: number; completed: number; failed: number; total: number } } | null;
    billingConfig: { commissionRate: number } | null;
}

const EMPTY: AllStats = {
    txSummary: null, providerStats: null, disputeStats: null,
    userStats: null, requestStats: null, withdrawalStats: null, billingConfig: null,
};

export default function AdminDashboardPage() {
    const router = useRouter();
    const { isReady } = useAdminGuard();
    const [stats, setStats] = useState<AllStats>(EMPTY);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const fetchAll = useCallback(async (showRefresh = false) => {
        if (showRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const [txSummary, providerStats, disputeStats, userStats, requestStats, withdrawalStats, billingConfig] = await Promise.allSettled([
                adminApi.getTransactionSummary(),
                adminApi.getProviderStats(),
                adminApi.getDisputeStats(),
                adminApi.getUserStats(),
                adminApi.getRescueRequestStats(),
                adminApi.getWithdrawalStats(),
                adminApi.getBillingConfig(),
            ]);
            setStats({
                txSummary: txSummary.status === 'fulfilled' ? txSummary.value : null,
                providerStats: providerStats.status === 'fulfilled' ? providerStats.value : null,
                disputeStats: disputeStats.status === 'fulfilled' ? disputeStats.value : null,
                userStats: userStats.status === 'fulfilled' ? userStats.value : null,
                requestStats: requestStats.status === 'fulfilled' ? requestStats.value : null,
                withdrawalStats: withdrawalStats.status === 'fulfilled' ? withdrawalStats.value : null,
                billingConfig: billingConfig.status === 'fulfilled' ? billingConfig.value : null,
            });
            setLastUpdated(new Date());
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        if (isReady) fetchAll(false);
    }, [isReady, fetchAll]);

    if (!isReady) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
                <div className="text-center">
                    <div className="w-10 h-10 rounded-full border-[3px] animate-spin mx-auto mb-3"
                        style={{ borderColor: C.orange, borderTopColor: 'transparent' }} />
                    <p className="text-sm" style={{ color: C.gray }}>Đang tải...</p>
                </div>
            </div>
        );
    }

    const { txSummary, providerStats, disputeStats, userStats, requestStats, withdrawalStats, billingConfig } = stats;
    const commissionRate = billingConfig?.commissionRate ?? 0.2;

    // ─ Provider donut slices ─
    const providerSlices: { label: string; value: number; color: string }[] = [
        { label: 'Đã duyệt', value: providerStats?.approved ?? 0, color: C.green },
        { label: 'Chờ duyệt', value: providerStats?.pending ?? 0, color: C.orange },
        { label: 'Bị từ chối', value: providerStats?.rejected ?? 0, color: C.red },
        { label: 'Đình chỉ', value: providerStats?.suspended ?? 0, color: C.yellow },
    ];

    // ─ Dispute donut slices ─
    const disputeSlices: { label: string; value: number; color: string }[] = [
        { label: 'Đã giải quyết', value: disputeStats?.resolved ?? 0, color: C.green },
        { label: 'Đang xử lý', value: (disputeStats?.inProgress ?? 0) - (disputeStats?.new ?? 0), color: C.blue },
        { label: 'Mới', value: disputeStats?.new ?? 0, color: C.orange },
    ];

    // ─ Withdrawal mini bars ─
    const wdBars: { label: string; value: number; color: string }[] = [
        { label: 'Chờ', value: withdrawalStats?.total.pending ?? 0, color: C.orange },
        { label: 'Hoàn thành', value: withdrawalStats?.total.completed ?? 0, color: C.green },
        { label: 'Thất bại', value: withdrawalStats?.total.failed ?? 0, color: C.red },
    ];




    return (
        <AdminLayout activeTab="/admin/dashboard">
            <div className="p-6 min-h-screen" style={{ background: C.bg, fontFamily: 'Lexend, sans-serif' }}>

                {/* ─── Header ─── */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-xl font-bold" style={{ color: C.navy }}>{greeting()}, Admin 👋</h1>
                        <p className="text-xs mt-0.5" style={{ color: C.gray }}>
                            {lastUpdated
                                ? `Cập nhật lúc ${lastUpdated.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
                                : 'Đang tải dữ liệu thời gian thực...'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                            style={{ background: C.greenLight, color: C.green }}>
                            <Activity className="w-3.5 h-3.5" />
                            Hệ thống hoạt động
                        </div>
                        <button
                            onClick={() => fetchAll(true)}
                            disabled={refreshing}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all hover:shadow-sm active:scale-95"
                            style={{ background: C.white, borderColor: C.border, color: C.navy }}
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                            Làm mới
                        </button>
                    </div>
                </div>

                {/* ─── KPI Row 1 ─── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    {loading ? (
                        Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
                    ) : (
                        <>
                            {/* Total Revenue – accent */}
                            <KpiCard
                                accent
                                label="Tổng doanh thu nền tảng"
                                value={fmtVnd(txSummary?.totalRevenue) + ' đ'}
                                sub={`Commission ${(commissionRate * 100).toFixed(0)}% đang áp dụng`}
                                href="/admin/transactions"
                                icon={<TrendingUp className="w-5 h-5" />}
                            />
                            {/* Commission earned */}
                            <KpiCard
                                label="Hoa hồng đã thu"
                                value={fmtVnd(txSummary?.totalCommission) + ' đ'}
                                sub="Tích lũy tất cả thời gian"
                                href="/admin/billing"
                                icon={<Wallet className="w-5 h-5" />}
                                iconBg={C.greenLight} iconColor={C.green}
                            />
                            {/* Topup today */}
                            <KpiCard
                                label="Nạp tiền hôm nay"
                                value={fmtVnd(txSummary?.totalTopupToday) + ' đ'}
                                sub="Tổng topup trong ngày"
                                href="/admin/transactions"
                                icon={<CreditCard className="w-5 h-5" />}
                                iconBg={C.blueLight} iconColor={C.blue}
                            />
                            {/* Pending withdrawals */}
                            <KpiCard
                                label="Rút tiền chờ duyệt"
                                value={fmtNum(txSummary?.pendingWithdrawals)}
                                sub="Cần xử lý thủ công"
                                href="/admin/withdrawals"
                                icon={<Clock className="w-5 h-5" />}
                                iconBg={C.yellowLight} iconColor={C.yellow}
                            />
                        </>
                    )}
                </div>

                {/* ─── KPI Row 2 ─── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {loading ? (
                        Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
                    ) : (
                        <>
                            <KpiCard
                                label="Providers chờ xét duyệt"
                                value={fmtNum(providerStats?.pending)}
                                sub={`Tổng: ${fmtNum(providerStats?.total)} providers`}
                                href="/admin/providers?status=PENDING"
                                icon={<ShieldCheck className="w-5 h-5" />}
                                iconBg={C.orangeLight} iconColor={C.orange}
                            />
                            <KpiCard
                                label="Tranh chấp đang xử lý"
                                value={fmtNum(disputeStats?.inProgress)}
                                sub={`Tổng: ${fmtNum(disputeStats?.total)} disputes`}
                                href="/admin/disputes"
                                icon={<AlertTriangle className="w-5 h-5" />}
                                iconBg={C.redLight} iconColor={C.red}
                            />
                            <KpiCard
                                label="Đơn cứu hộ tháng này"
                                value={fmtNum(requestStats?.newThisMonth)}
                                sub={`Tổng: ${fmtNum(requestStats?.total)} đơn`}
                                href="/admin/requests"
                                icon={<FileText className="w-5 h-5" />}
                                iconBg={C.purpleLight} iconColor={C.purple}
                            />
                            <KpiCard
                                label="Người dùng mới tháng này"
                                value={fmtNum(userStats?.newThisMonth)}
                                sub={`Tổng: ${fmtNum(userStats?.total)} users`}
                                href="/admin/users"
                                icon={<Users className="w-5 h-5" />}
                                iconBg={C.blueLight} iconColor={C.blue}
                            />
                        </>
                    )}
                </div>

                {/* ─── Charts Row ─── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

                    {/* Provider Status Donut */}
                    <div className="bg-white rounded-2xl border p-5" style={{ borderColor: C.border }}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: C.orangeLight }}>
                                    <ShieldCheck className="w-3.5 h-3.5" style={{ color: C.orange }} />
                                </div>
                                <h2 className="text-sm font-bold" style={{ color: C.navy }}>Trạng thái Providers</h2>
                            </div>
                            <button onClick={() => router.push('/admin/providers?status=ALL')}
                                className="text-xs font-semibold flex items-center gap-1 hover:underline" style={{ color: C.orange }}>
                                Xem tất cả <ArrowRight className="w-3 h-3" />
                            </button>
                        </div>
                        {loading ? (
                            <div className="flex items-center justify-center h-32"><Skeleton className="w-28 h-28 rounded-full" /></div>
                        ) : (
                            <div className="flex items-center gap-5">
                                <div className="relative flex-shrink-0">
                                    <DonutChart 
                                        slices={providerSlices} 
                                        size={110} 
                                        centerLabel={fmtNum(providerStats?.total)} 
                                        centerSub="Tổng"
                                    />
                                </div>
                                <div className="flex flex-col gap-2 flex-1 min-w-0">
                                    {providerSlices.map((s) => (
                                        <div key={s.label} className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                                            <div className="flex items-center justify-between flex-1 min-w-0">
                                                <span className="text-xs truncate" style={{ color: C.gray }}>{s.label}</span>
                                                <span className="text-xs font-bold ml-2 flex-shrink-0" style={{ color: C.navy }}>{fmtNum(s.value)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Dispute Status Donut */}
                    <div className="bg-white rounded-2xl border p-5" style={{ borderColor: C.border }}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: C.redLight }}>
                                    <AlertTriangle className="w-3.5 h-3.5" style={{ color: C.red }} />
                                </div>
                                <h2 className="text-sm font-bold" style={{ color: C.navy }}>Trạng thái Disputes</h2>
                            </div>
                            <button onClick={() => router.push('/admin/disputes')}
                                className="text-xs font-semibold flex items-center gap-1 hover:underline" style={{ color: C.orange }}>
                                Xem tất cả <ArrowRight className="w-3 h-3" />
                            </button>
                        </div>
                        {loading ? (
                            <div className="flex items-center justify-center h-32"><Skeleton className="w-28 h-28 rounded-full" /></div>
                        ) : (
                            <div className="flex items-center gap-5">
                                <div className="relative flex-shrink-0">
                                    <DonutChart 
                                        slices={disputeSlices} 
                                        size={110} 
                                        centerLabel={fmtNum(disputeStats?.total)} 
                                        centerSub="Tổng"
                                    />
                                </div>
                                <div className="flex flex-col gap-2 flex-1 min-w-0">
                                    {disputeSlices.map((s) => (
                                        <div key={s.label} className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                                            <div className="flex items-center justify-between flex-1 min-w-0">
                                                <span className="text-xs truncate" style={{ color: C.gray }}>{s.label}</span>
                                                <span className="text-xs font-bold ml-2 flex-shrink-0" style={{ color: C.navy }}>{fmtNum(s.value)}</span>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="mt-1 pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: C.grayLight }} />
                                            <div className="flex items-center justify-between flex-1 min-w-0">
                                                <span className="text-xs truncate" style={{ color: C.gray }}>Đã giải quyết</span>
                                                <span className="text-xs font-bold ml-2 flex-shrink-0" style={{ color: C.green }}>{fmtNum(disputeStats?.resolved)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Request Stats */}
                    <div className="bg-white rounded-2xl border p-5" style={{ borderColor: C.border }}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: C.purpleLight }}>
                                    <FileText className="w-3.5 h-3.5" style={{ color: C.purple }} />
                                </div>
                                <h2 className="text-sm font-bold" style={{ color: C.navy }}>Đơn cứu hộ</h2>
                            </div>
                            <button onClick={() => router.push('/admin/requests')}
                                className="text-xs font-semibold flex items-center gap-1 hover:underline" style={{ color: C.orange }}>
                                Xem tất cả <ArrowRight className="w-3 h-3" />
                            </button>
                        </div>
                        {loading ? (
                            <div className="space-y-3">
                                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {[
                                    { label: 'Tổng đơn', value: requestStats?.total ?? 0, color: C.navy, icon: <FileText className="w-3.5 h-3.5" /> },
                                    { label: 'Hoàn thành', value: requestStats?.completed ?? 0, color: C.green, icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
                                    { label: 'Đã hủy', value: requestStats?.cancelled ?? 0, color: C.red, icon: <XCircle className="w-3.5 h-3.5" /> },
                                    { label: 'Có tranh chấp', value: requestStats?.disputed ?? 0, color: C.yellow, icon: <AlertTriangle className="w-3.5 h-3.5" /> },
                                ].map((row) => {
                                    const total = requestStats?.total ?? 1;
                                    const pct = total > 0 ? Math.min(100, Math.round((row.value / total) * 100)) : 0;
                                    return (
                                        <div key={row.label}>
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-1.5" style={{ color: row.color }}>
                                                    {row.icon}
                                                    <span className="text-xs font-medium" style={{ color: C.gray }}>{row.label}</span>
                                                </div>
                                                <span className="text-xs font-bold" style={{ color: C.navy }}>{fmtNum(row.value)}</span>
                                            </div>
                                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.bg }}>
                                                <div className="h-full rounded-full transition-all duration-700"
                                                    style={{ width: `${pct}%`, background: row.color, opacity: 0.8 }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* ─── Bottom Row ─── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                    {/* User Stats */}
                    <div className="bg-white rounded-2xl border p-5" style={{ borderColor: C.border }}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: C.blueLight }}>
                                    <Users className="w-3.5 h-3.5" style={{ color: C.blue }} />
                                </div>
                                <h2 className="text-sm font-bold" style={{ color: C.navy }}>Người dùng</h2>
                            </div>
                            <button onClick={() => router.push('/admin/users')}
                                className="text-xs font-semibold flex items-center gap-1 hover:underline" style={{ color: C.orange }}>
                                Quản lý <ArrowRight className="w-3 h-3" />
                            </button>
                        </div>
                        {loading ? (
                            <div className="grid grid-cols-2 gap-3">
                                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: 'Tổng users', value: userStats?.total ?? 0, color: C.navy, bg: C.bg },
                                    { label: 'Hoạt động', value: userStats?.active ?? 0, color: C.green, bg: C.greenLight },
                                    { label: 'Đã khóa', value: userStats?.inactive ?? 0, color: C.red, bg: C.redLight },
                                    { label: 'Mới tháng này', value: userStats?.newThisMonth ?? 0, color: C.blue, bg: C.blueLight },
                                ].map((s) => (
                                    <div key={s.label} className="p-3 rounded-xl flex items-center gap-3" style={{ background: s.bg }}>
                                        <div>
                                            <p className="text-xl font-bold" style={{ color: s.color }}>{fmtNum(s.value)}</p>
                                            <p className="text-[11px]" style={{ color: C.gray }}>{s.label}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Withdrawal Stats */}
                    <div className="bg-white rounded-2xl border p-5" style={{ borderColor: C.border }}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: C.greenLight }}>
                                    <Banknote className="w-3.5 h-3.5" style={{ color: C.green }} />
                                </div>
                                <h2 className="text-sm font-bold" style={{ color: C.navy }}>Rút tiền</h2>
                            </div>
                            <button onClick={() => router.push('/admin/withdrawals')}
                                className="text-xs font-semibold flex items-center gap-1 hover:underline" style={{ color: C.orange }}>
                                Quản lý <ArrowRight className="w-3 h-3" />
                            </button>
                        </div>
                        {loading ? (
                            <div className="flex items-center gap-6">
                                <Skeleton className="w-20 h-20 rounded-lg" />
                                <div className="flex-1 space-y-3">
                                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-6">
                                {/* Mini bar chart */}
                                <div className="flex flex-col items-center gap-2 flex-shrink-0 w-32">
                                    <div className="w-full mt-2">
                                        <VerticalBarChart items={wdBars} height={80} />
                                    </div>
                                </div>
                                {/* Stats */}
                                <div className="flex-1 space-y-2">
                                    {[
                                        { label: 'Chờ duyệt', value: withdrawalStats?.total.pending ?? 0, color: C.orange, bg: C.orangeLight },
                                        { label: 'Hoàn thành', value: withdrawalStats?.total.completed ?? 0, color: C.green, bg: C.greenLight },
                                        { label: 'Thất bại', value: withdrawalStats?.total.failed ?? 0, color: C.red, bg: C.redLight },
                                    ].map((s) => (
                                        <div key={s.label} className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: s.bg }}>
                                            <span className="text-xs font-medium" style={{ color: C.gray }}>{s.label}</span>
                                            <span className="text-sm font-bold" style={{ color: s.color }}>{fmtNum(s.value)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </AdminLayout>
    );
}
