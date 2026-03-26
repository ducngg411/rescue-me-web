'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminGuard } from '@/lib/guards';
import { adminApi } from '@/lib/api';
import AdminLayout from '@/components/AdminLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { ChevronRight, ChevronLeft, Search, Filter, Calendar, AlertTriangle, Clock, CheckCircle, ShieldAlert, BarChart2 } from 'lucide-react';
import { displayOrderCode, displayDisputeCaseRef } from '@/lib/reconciliation';
import { ChartCard, VerticalBarChart, DonutChart } from '@/components/AdminCharts';

const C = {
    orange: '#f97316',
    orangeDark: '#ea6c0a',
    orangeLight: '#fff7ed',
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#e2e8f0',
    bg: '#f4f6f9',
    green: '#16a34a',
    greenLight: '#f0fdf4',
    red: '#ef4444',
    redLight: '#fef2f2',
    yellow: '#ca8a04',
    yellowLight: '#fefce8',
    blue: '#2563eb',
    blueLight: '#eff6ff',
    purple: '#7c3aed',
    purpleLight: '#faf5ff',
};

type DisputeStatus =
    | 'ALL'
    | 'WAITING_FOR_PROVIDER'
    | 'WAITING_FOR_CUSTOMER'
    | 'INVESTIGATING'
    | 'RESOLVED';

interface DisputeListItem {
    id: string;
    status: string;
    isOverdue: boolean;
    firstResponseDueAt: string | null;
    resolutionDueAt: string | null;
    createdAt: string;
    targetAmount?: number;
    resolutionType?: string | null;
    payment: {
        requestId: string;
        totalAmount: number;
        status: string;
        paymentMethod: string;
        disputedAt: string | null;
    };
    request: { id: string; orderCode?: string | null; status: string; incidentType: string };
    openedBy: { id: string; fullName: string; email: string } | null;
}

const PAGE_SIZE = 10;

function StatusBadge({ status }: { status: string }) {
    const configs: Record<string, { bg: string; color: string; dot: string; label: string }> = {
        WAITING_FOR_PROVIDER: { bg: C.yellowLight, color: C.yellow, dot: '#facc15', label: 'Chờ Provider' },
        WAITING_FOR_CUSTOMER: { bg: C.yellowLight, color: C.yellow, dot: '#facc15', label: 'Chờ Customer' },
        INVESTIGATING: { bg: C.purpleLight, color: C.purple, dot: C.purple, label: 'Đang xem xét' },
        RESOLVED: { bg: C.greenLight, color: C.green, dot: C.green, label: 'Đã xử lý' },
        REJECTED: { bg: C.greenLight, color: C.green, dot: C.green, label: 'Đã xử lý' },
    };
    const st = configs[status] || { bg: '#f8fafc', color: C.gray, dot: C.gray, label: status };

    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: st.bg, color: st.color }}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: st.dot }} />
            {st.label}
        </span>
    );
}

function TimeSinceBadge({ createdAt }: { createdAt: string }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted) return null;

    const created = new Date(createdAt);
    const diffMs = new Date().getTime() - created.getTime();
    const hours = diffMs / (1000 * 60 * 60);

    let bg = C.greenLight;
    let color = C.green;

    if (hours >= 6) {
        bg = C.redLight;
        color = C.red;
    } else if (hours >= 3) {
        bg = C.yellowLight;
        color = C.yellow;
    }

    const label = hours < 1 
        ? `${Math.max(0, Math.floor(diffMs / (1000 * 60)))} phút trước`
        : `${Math.floor(hours)} giờ trước`;

    return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide" style={{ background: bg, color }}>
            {label}
        </span>
    );
}

export default function AdminDisputesPage() {
    const router = useRouter();
    const { t, locale } = useLanguage();
    const { isReady } = useAdminGuard();
    const [tab, setTab] = useState<string>('NEW');
    const [items, setItems] = useState<DisputeListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ new: 0, inProgress: 0, resolved: 0, total: 0 });

    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('NEWEST');
    const [dateFilter, setDateFilter] = useState('');
    const [page, setPage] = useState(1);

    // Chart data
    const [chartResolution, setChartResolution] = useState<{ label: string; value: number }[]>([]);
    const [chartsLoading, setChartsLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [params, statsData] = await Promise.all([
                (async () => {
                    const params: { status?: string; skip: number; take: number } = {
                        skip: 0,
                        take: 1000, // Fetch more for client-side sort/filter
                    };
                    const activeTabConfig = tabs.find(t => t.key === tab);
                    const statusList = (activeTabConfig?.apiStatus ?? '')
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean);
                    if (statusList.length === 1 && tab !== 'NEW') params.status = statusList[0];
                    return { params, statusList };
                })(),
                adminApi.getDisputeStats(),
            ]);

            setStats(statsData);

            const res = await adminApi.getDisputes(params.params);
            const apiItems = (res.items as DisputeListItem[]) ?? [];
            const filteredByTab =
                tab === 'NEW'
                    ? apiItems
                        .filter((d) =>
                            ['WAITING_FOR_PROVIDER', 'WAITING_FOR_CUSTOMER', 'INVESTIGATING'].includes(d.status),
                        )
                    : params.statusList.length > 1
                        ? apiItems.filter((d) => params.statusList.includes(d.status))
                    : apiItems;
            
            setItems(filteredByTab);
            setPage(1);
        } catch {
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [tab]);

    useEffect(() => {
        if (isReady) {
            load();
            adminApi.getDisputeResolutionDistribution().then(setChartResolution).catch(() => {}).finally(() => setChartsLoading(false));
        }
    }, [isReady, load]);

    const tabs = [
        { key: 'ALL', label: 'Tất cả', apiStatus: '' },
        { key: 'NEW', label: 'Mới', apiStatus: '' },
        { key: 'PENDING_EVIDENCE', label: 'Chờ bổ sung', apiStatus: 'WAITING_FOR_PROVIDER,WAITING_FOR_CUSTOMER' },
        { key: 'UNDER_REVIEW', label: 'Đang xem xét', apiStatus: 'INVESTIGATING' },
        { key: 'RESOLVED', label: 'Đã xử lý', apiStatus: 'RESOLVED' },
    ];

    const filtered = items.filter(d => {
        if (dateFilter) {
            const dDate = new Date(d.createdAt);
            const dStr = `${dDate.getFullYear()}-${String(dDate.getMonth() + 1).padStart(2, '0')}-${String(dDate.getDate()).padStart(2, '0')}`;
            if (dStr !== dateFilter) return false;
        }

        const q = search.toLowerCase();
        if (!q) return true;
        return (
            d.id.toLowerCase().includes(q) ||
            d.payment.requestId.toLowerCase().includes(q) ||
            d.openedBy?.fullName.toLowerCase().includes(q) ||
            d.openedBy?.email.toLowerCase().includes(q)
        );
    });

    const sorted = [...filtered].sort((a, b) => {
        if (sortBy === 'NEWEST') {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === 'OLDEST') {
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        const aAmount = a.targetAmount ?? a.payment.totalAmount;
        const bAmount = b.targetAmount ?? b.payment.totalAmount;
        if (sortBy === 'AMOUNT_DESC') return bAmount - aAmount;
        if (sortBy === 'AMOUNT_ASC') return aAmount - bAmount;
        return 0;
    });

    const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return (
        <AdminLayout activeTab="/admin/disputes">
            <div className="p-6 min-h-screen" style={{ background: C.bg }}>
                {/* Page Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold mb-1" style={{ color: C.navy }}>
                        {t('admin.disputes.title')}
                    </h1>
                    <p className="text-sm" style={{ color: C.gray }}>
                        {t('admin.disputes.subtitle')}
                    </p>
                </div>

                {/* ─── Stats Cards Row ─── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {[
                        { label: 'MỚI', value: stats.new, color: C.blue, icon: <AlertTriangle className="w-4 h-4" /> },
                        { label: 'ĐANG XỬ LÝ', value: stats.inProgress, color: C.orange, icon: <Clock className="w-4 h-4" /> },
                        { label: 'ĐÃ XỬ LÝ', value: stats.resolved, color: C.green, icon: <CheckCircle className="w-4 h-4" /> },
                        { label: 'THỐNG KÊ TỔNG', value: stats.total, color: C.navy, icon: <ShieldAlert className="w-4 h-4" /> },
                    ].map(stat => (
                        <div key={stat.label} className="bg-white rounded-2xl border p-4" style={{ borderColor: C.border }}>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: C.gray }}>{stat.label}</p>
                                <span style={{ color: stat.color, opacity: 0.6 }}>{stat.icon}</span>
                            </div>
                            <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                        </div>
                    ))}
                </div>

                {/* ─── Chart Row ─── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                    <ChartCard
                        title="Kết quả giải quyết tranh chấp"
                        icon={<BarChart2 className="w-3.5 h-3.5" />}
                        iconBg="#f0fdf4" iconColor="#16a34a"
                    >
                        <VerticalBarChart
                            loading={chartsLoading}
                            height={130}
                            items={chartResolution.map((d, i) => ({
                                label: d.label, value: d.value,
                                color: ['#16a34a', '#f97316', '#ef4444'][i % 3],
                                displayValue: d.value.toString(),
                            }))}
                        />
                    </ChartCard>
                    <ChartCard
                        title="Phân bố trạng thái tranh chấp"
                        icon={<BarChart2 className="w-3.5 h-3.5" />}
                        iconBg="#fef2f2" iconColor="#ef4444"
                    >
                        <div className="flex items-center gap-4">
                            <DonutChart
                                size={110}
                                centerLabel={String(stats.total)}
                                centerSub="Tổng"
                                slices={[
                                    { label: 'Mới', value: stats.new, color: '#f97316' },
                                    { label: 'Đang xử lý', value: stats.inProgress, color: '#2563eb' },
                                    { label: 'Đã xử lý', value: stats.resolved, color: '#16a34a' },
                                ]}
                            />
                            <div className="space-y-2">
                                {[
                                    { label: 'Mới', value: stats.new, color: '#f97316' },
                                    { label: 'Đang xử lý', value: stats.inProgress, color: '#2563eb' },
                                    { label: 'Đã xử lý', value: stats.resolved, color: '#16a34a' },
                                ].map(s => (
                                    <div key={s.label} className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                                        <span className="text-xs" style={{ color: '#6b7280' }}>{s.label}</span>
                                        <span className="text-xs font-bold ml-auto pl-2" style={{ color: '#1a1a2e' }}>{s.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </ChartCard>
                </div>

                {/* Main Card */}
                <div className="bg-white rounded-2xl border mb-5" style={{ borderColor: C.border }}>
                    {/* Tabs */}
                    <div className="flex items-center px-5 border-b overflow-x-auto hide-scrollbar" style={{ borderColor: C.border }}>
                        {tabs.map(({ key, label }) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setTab(key)}
                                className="px-4 py-4 text-sm font-medium relative transition-colors whitespace-nowrap"
                                style={{
                                    color: tab === key ? C.orange : C.gray,
                                    borderBottom: tab === key ? `2px solid ${C.orange}` : '2px solid transparent',
                                    marginBottom: '-1px',
                                }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-3 p-4 border-b" style={{ borderColor: C.border }}>
                        {/* Search */}
                        <div className="flex-1 min-w-[200px] relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.gray }} />
                            <input
                                type="text"
                                value={search}
                                onChange={e => { setSearch(e.target.value); setPage(1); }}
                                placeholder="Tìm theo ID khiếu nại, ID yêu cầu, hoặc tên khách hàng..."
                                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2"
                                style={{ borderColor: C.border, color: C.navy, fontFamily: 'Lexend, sans-serif' }}
                            />
                        </div>

                        {/* Sort Filter */}
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm cursor-pointer" style={{ borderColor: C.border }}>
                            <Filter className="w-3.5 h-3.5" style={{ color: C.gray }} />
                            <select
                                value={sortBy}
                                onChange={e => { setSortBy(e.target.value); setPage(1); }}
                                className="bg-transparent text-sm focus:outline-none cursor-pointer pr-1"
                                style={{ color: C.navy, fontFamily: 'Lexend, sans-serif' }}
                            >
                                <option value="NEWEST">Mới nhất</option>
                                <option value="OLDEST">Cũ nhất</option>
                                <option value="AMOUNT_DESC">Giá trị: Cao đến Thấp</option>
                                <option value="AMOUNT_ASC">Giá trị: Thấp đến Cao</option>
                            </select>
                        </div>

                        {/* Date Range */}
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm relative" style={{ borderColor: C.border }}>
                            <Calendar className="w-3.5 h-3.5" style={{ color: C.gray }} />
                            <input
                                type="date"
                                value={dateFilter}
                                onChange={e => { setDateFilter(e.target.value); setPage(1); }}
                                className="bg-transparent text-sm focus:outline-none cursor-pointer"
                                style={{ color: dateFilter ? C.navy : C.gray, fontFamily: 'Lexend, sans-serif' }}
                            />
                            {dateFilter && (
                                <button
                                    onClick={() => { setDateFilter(''); setPage(1); }}
                                    className="absolute -right-1.5 -top-1.5 bg-gray-200 hover:bg-gray-300 rounded-full p-0.5"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
                                </button>
                            )}
                        </div>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center" style={{ color: C.gray }}>
                            <div className="w-8 h-8 rounded-full border-[3px] border-t-transparent animate-spin mx-auto" style={{ borderColor: C.orange, borderTopColor: 'transparent' }} />
                        </div>
                    ) : paginated.length === 0 ? (
                        <div className="p-12 text-center flex flex-col items-center gap-2">
                            <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke={C.border} strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span style={{ color: C.gray }}>Không tìm thấy khiếu nại nào phù hợp.</span>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead style={{ background: C.bg }}>
                                    <tr>
                                        <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3" style={{ color: C.gray }}>
                                            {t('admin.disputes.colCase')}
                                        </th>
                                        <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3" style={{ color: C.gray }}>
                                            {t('admin.disputes.colRequest')}
                                        </th>
                                        <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3" style={{ color: C.gray }}>
                                            {t('admin.disputes.colAmount')}
                                        </th>
                                        <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3" style={{ color: C.gray }}>
                                            THỜI GIAN
                                        </th>
                                        <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3" style={{ color: C.gray }}>
                                            QUYẾT ĐỊNH
                                        </th>
                                        <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3" style={{ color: C.gray }}>
                                            {t('admin.disputes.colStatus')}
                                        </th>
                                        <th className="px-4 py-3 w-10 text-[10px] font-semibold tracking-wider" style={{ color: C.gray }}>AC</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginated.map((row) => {
                                        return (
                                            <tr
                                                key={row.id}
                                                className="border-t cursor-pointer hover:bg-slate-50/80 transition-colors"
                                                style={{ borderColor: C.border }}
                                                onClick={() => router.push(`/admin/disputes/${row.id}`)}
                                            >
                                                <td className="px-4 py-3 font-mono text-xs" style={{ color: C.navy }}>
                                                    {displayDisputeCaseRef(row.id)}…
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs" style={{ color: C.gray }}>
                                                    #{displayOrderCode(row.request?.orderCode, row.payment.requestId)}
                                                </td>
                                                <td className="px-4 py-3 font-semibold" style={{ color: C.navy }}>
                                                    {(row.targetAmount ?? row.payment.totalAmount).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')}
                                                    ₫
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col gap-1 items-start">
                                                        <span className="text-xs font-medium" style={{ color: C.navy }}>
                                                            {new Date(row.createdAt).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                        <TimeSinceBadge createdAt={row.createdAt} />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 font-semibold text-xs" style={{ color: C.navy }}>
                                                    {row.status === 'RESOLVED' || row.status === 'REJECTED' ? (
                                                        row.resolutionType === 'NO_REFUND' ? 'Không hoàn tiền' :
                                                        row.resolutionType === 'FULL_REFUND' ? 'Hoàn tiền 100%' :
                                                        row.resolutionType === 'PARTIAL_REFUND' ? 'Hoàn tiền một phần' : '—'
                                                    ) : '—'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <StatusBadge status={row.status} />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <ChevronRight className="w-5 h-5" style={{ color: C.gray }} />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {/* Pagination Footer */}
                    {!loading && items.length > 0 && (
                        <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: C.border }}>
                            <p className="text-xs" style={{ color: C.gray }}>
                                Showing <span className="font-semibold" style={{ color: C.navy }}>
                                    {sorted.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
                                </span> to <span className="font-semibold" style={{ color: C.navy }}>
                                    {Math.min(page * PAGE_SIZE, sorted.length)}
                                </span> of <span className="font-semibold" style={{ color: C.navy }}>
                                    {sorted.length}
                                </span> disputes
                            </p>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    style={{ color: C.gray }}
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    // simple logic strictly bound to 5 pages window if needed, using simple index for now
                                    let start = Math.max(1, page - 2);
                                    let end = Math.min(totalPages, start + 4);
                                    if (end - start < 4) start = Math.max(1, end - 4);
                                    return start + i;
                                }).filter(p => p <= totalPages).map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setPage(p)}
                                        className="w-7 h-7 rounded-lg text-xs font-semibold transition-colors"
                                        style={{
                                            background: page === p ? C.orange : 'transparent',
                                            color: page === p ? '#fff' : C.gray,
                                        }}
                                    >
                                        {p}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    style={{ color: C.gray }}
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
