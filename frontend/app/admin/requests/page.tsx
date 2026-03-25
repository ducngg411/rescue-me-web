'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminGuard } from '@/lib/guards';
import { adminApi } from '@/lib/api';
import AdminLayout from '@/components/AdminLayout';
import AvatarImage from '@/components/AvatarImage';
import { displayOrderCode } from '@/lib/reconciliation';
import {
    Search, ChevronLeft, ChevronRight, Filter, Calendar, Eye,
    X, Car, Clock, AlertTriangle, ShieldAlert, CheckCircle,
    XCircle, Loader2, Wrench,
} from 'lucide-react';

const C = {
    orange: '#f97316', orangeLight: '#fff7ed',
    navy: '#1a1a2e', gray: '#6b7280', border: '#e2e8f0', bg: '#f4f6f9',
    green: '#16a34a', greenLight: '#f0fdf4',
    red: '#ef4444', redLight: '#fef2f2',
    yellow: '#ca8a04', yellowLight: '#fefce8',
    blue: '#2563eb', blueLight: '#eff6ff',
    purple: '#7c3aed', purpleLight: '#faf5ff',
};

// ── Label Maps ─────────────────────────────────────────────────────────────────
const INCIDENT_LABELS: Record<string, string> = {
    BREAKDOWN: 'Hỏng xe', ACCIDENT: 'Tai nạn', FLAT_TIRE: 'Xì lốp',
    BATTERY_DEAD: 'Hết pin', OUT_OF_FUEL: 'Hết xăng', LOCKED_OUT: 'Khóa xe', OTHER: 'Khác',
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
    CREATED:         { label: 'Mới tạo',       color: C.blue,   bg: C.blueLight },
    SEARCHING:       { label: 'Đang tìm',       color: C.blue,   bg: C.blueLight },
    MATCHING:        { label: 'Đang ghép',      color: C.blue,   bg: C.blueLight },
    MATCHED:         { label: 'Đã ghép',        color: C.yellow, bg: C.yellowLight },
    ACCEPTED:        { label: 'Đã nhận',        color: C.yellow, bg: C.yellowLight },
    ASSIGNED:        { label: 'Đã phân công',   color: C.yellow, bg: C.yellowLight },
    IN_PROGRESS:     { label: 'Đang thực hiện', color: C.orange, bg: C.orangeLight },
    ARRIVED:         { label: 'Đã đến nơi',     color: C.orange, bg: C.orangeLight },
    WORKING:         { label: 'Đang làm',       color: C.orange, bg: C.orangeLight },
    PAYMENT_PENDING: { label: 'Chờ thanh toán', color: C.purple, bg: C.purpleLight },
    COMPLETED:       { label: 'Hoàn thành',     color: C.green,  bg: C.greenLight },
    PAID:            { label: 'Đã thanh toán',  color: C.green,  bg: C.greenLight },
    CANCELLED:       { label: 'Đã hủy',         color: C.gray,   bg: '#f3f4f6' },
    REJECTED:        { label: 'Bị từ chối',     color: C.red,    bg: C.redLight },
    EXPIRED:         { label: 'Hết hạn',        color: C.gray,   bg: '#f3f4f6' },
};

const ALL_STATUSES = [
    'CREATED','SEARCHING','MATCHING','MATCHED','ACCEPTED','ASSIGNED',
    'IN_PROGRESS','ARRIVED','WORKING','PAYMENT_PENDING','COMPLETED','PAID',
    'CANCELLED','REJECTED','EXPIRED',
];

type TabType = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';
const TABS: { key: TabType; label: string }[] = [
    { key: 'ALL',       label: 'Tất cả' },
    { key: 'ACTIVE',    label: 'Đang xử lý' },
    { key: 'COMPLETED', label: 'Hoàn thành' },
    { key: 'CANCELLED', label: 'Đã hủy/Hết hạn' },
    { key: 'DISPUTED',  label: 'Khiếu nại' },
];

const PAGE_SIZE = 15;

function StatusBadge({ status }: { status: string }) {
    const s = STATUS_META[status] ?? { label: status, color: C.gray, bg: '#f3f4f6' };
    return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap"
            style={{ background: s.bg, color: s.color }}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {s.label}
        </span>
    );
}

function PaymentBadge({ method, amount }: { method?: string; amount?: number }) {
    if (!method || !amount) return <span style={{ color: C.gray }} className="text-xs">—</span>;
    const label = method === 'CASH' ? 'Tiền mặt' : method === 'WALLET' ? 'Ví' : 'QR';
    return (
        <div className="flex flex-col">
            <span className="text-sm font-bold" style={{ color: C.navy }}>{amount.toLocaleString('vi-VN')}₫</span>
            <span className="text-[10px]" style={{ color: C.gray }}>{label}</span>
        </div>
    );
}

export default function AdminRequestsPage() {
    const { isReady } = useAdminGuard();
    const router = useRouter();

    const [tab, setTab] = useState<TabType>('ALL');
    const [items, setItems] = useState<any[]>([]);
    const [stats, setStats] = useState({ total: 0, completed: 0, cancelled: 0, newThisMonth: 0, disputed: 0 });
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);

    const [search, setSearch] = useState('');
    const [incidentFilter, setIncidentFilter] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [page, setPage] = useState(1);

    const getStatusQuery = (t: TabType) => {
        if (t === 'ACTIVE') return ['CREATED','SEARCHING','MATCHING','MATCHED','ACCEPTED','ASSIGNED','IN_PROGRESS','ARRIVED','WORKING','PAYMENT_PENDING'].join(',');
        if (t === 'COMPLETED') return ['COMPLETED', 'PAID'].join(',');
        if (t === 'CANCELLED') return ['CANCELLED','REJECTED','EXPIRED'].join(',');
        return undefined;
    };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [res, statsData] = await Promise.all([
                adminApi.getRescueRequests({
                    status: getStatusQuery(tab),
                    hasDispute: tab === 'DISPUTED' ? true : undefined,
                    search: search || undefined,
                    incidentType: incidentFilter || undefined,
                    dateFrom: dateFilter ? dateFilter : undefined,
                    dateTo: dateFilter ? dateFilter : undefined,
                    skip: (page - 1) * PAGE_SIZE,
                    take: PAGE_SIZE,
                }),
                adminApi.getRescueRequestStats(),
            ]);
            setItems((res.items as any[]) ?? []);
            setTotal(res.total);
            setStats(statsData);
        } catch {
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [tab, search, incidentFilter, dateFilter, page]);

    useEffect(() => { if (isReady) load(); }, [isReady, load]);

    // No client-side filtering needed since tab (status) and search/date are fully server-side now.
    const filtered = items;

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

    return (
        <AdminLayout activeTab="/admin/requests">
            <div className="p-6 min-h-screen" style={{ background: C.bg }}>

                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold mb-1" style={{ color: C.navy }}>Quản lý Yêu cầu dịch vụ</h1>
                    <p className="text-sm" style={{ color: C.gray }}>Toàn bộ lịch sử đơn cứu hộ trên hệ thống.</p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    {[
                        { label: 'TỔNG ĐƠN', value: stats.total, color: C.navy, icon: <Wrench className="w-4 h-4" /> },
                        { label: 'HOÀN THÀNH', value: stats.completed, color: C.green, icon: <CheckCircle className="w-4 h-4" /> },
                        { label: 'ĐÃ HỦY', value: stats.cancelled, color: C.gray, icon: <XCircle className="w-4 h-4" /> },
                        { label: 'THÁNG NÀY', value: stats.newThisMonth, color: C.blue, icon: <Clock className="w-4 h-4" /> },
                        { label: 'KHIẾU NẠI', value: stats.disputed, color: C.red, icon: <ShieldAlert className="w-4 h-4" /> },
                    ].map(s => (
                        <div key={s.label} className="bg-white rounded-2xl border p-4" style={{ borderColor: C.border }}>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: C.gray }}>{s.label}</p>
                                <span style={{ color: s.color, opacity: 0.6 }}>{s.icon}</span>
                            </div>
                            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                            {s.label === 'HOÀN THÀNH' && (
                                <p className="text-[10px] mt-1" style={{ color: C.gray }}>{completionRate}% tổng đơn</p>
                            )}
                        </div>
                    ))}
                </div>

                {/* Main Card */}
                <div className="bg-white rounded-2xl border mb-5" style={{ borderColor: C.border }}>

                    {/* Tabs */}
                    <div className="flex items-center px-5 border-b overflow-x-auto" style={{ borderColor: C.border }}>
                        {TABS.map(t => (
                            <button
                                key={t.key}
                                type="button"
                                onClick={() => { setTab(t.key); setPage(1); }}
                                className="px-4 py-4 text-sm font-medium relative transition-colors whitespace-nowrap"
                                style={{
                                    color: tab === t.key ? C.orange : C.gray,
                                    borderBottom: tab === t.key ? `2px solid ${C.orange}` : '2px solid transparent',
                                    marginBottom: '-1px',
                                }}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-3 p-4 border-b" style={{ borderColor: C.border }}>
                        {/* Search */}
                        <div className="flex-1 min-w-[220px] relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.gray }} />
                            <input
                                type="text"
                                value={search}
                                onChange={e => { setSearch(e.target.value); setPage(1); }}
                                placeholder="Tìm theo mã đơn, tên khách hàng, biển số..."
                                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border focus:outline-none"
                                style={{ borderColor: C.border, color: C.navy, fontFamily: 'Lexend, sans-serif' }}
                            />
                        </div>
                        {/* Incident filter */}
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm" style={{ borderColor: C.border }}>
                            <Filter className="w-3.5 h-3.5" style={{ color: C.gray }} />
                            <select
                                value={incidentFilter}
                                onChange={e => { setIncidentFilter(e.target.value); setPage(1); }}
                                className="bg-transparent text-sm focus:outline-none cursor-pointer"
                                style={{ color: C.navy, fontFamily: 'Lexend, sans-serif' }}
                            >
                                <option value="">Tất cả sự cố</option>
                                {Object.entries(INCIDENT_LABELS).map(([k, v]) => (
                                    <option key={k} value={k}>{v}</option>
                                ))}
                            </select>
                        </div>
                        {/* Date */}
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm relative" style={{ borderColor: C.border }}>
                            <Calendar className="w-3.5 h-3.5" style={{ color: C.gray }} />
                            <input
                                type="date"
                                value={dateFilter}
                                onClick={e => { try { (e.target as HTMLInputElement).showPicker(); } catch {} }}
                                onChange={e => { setDateFilter(e.target.value); setPage(1); }}
                                className="bg-transparent text-sm focus:outline-none cursor-pointer"
                                style={{ color: dateFilter ? C.navy : C.gray, fontFamily: 'Lexend, sans-serif' }}
                            />
                            {dateFilter && (
                                <button onClick={() => setDateFilter('')} className="absolute -right-1.5 -top-1.5 bg-gray-200 hover:bg-gray-300 rounded-full p-0.5">
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Table */}
                    {loading ? (
                        <div className="p-12 flex justify-center">
                            <Loader2 className="w-8 h-8 animate-spin" style={{ color: C.orange }} />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="p-12 text-center flex flex-col items-center gap-2">
                            <Car className="w-10 h-10" style={{ color: C.border }} />
                            <span className="text-sm" style={{ color: C.gray }}>Không tìm thấy đơn nào.</span>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead style={{ background: C.bg }}>
                                    <tr>
                                        {['MÃ ĐƠN', 'KHÁCH HÀNG', 'SỰ CỐ', 'CỨU HỘ VIÊN', 'THANH TOÁN', 'NGÀY TẠO', 'TRẠNG THÁI', ''].map(h => (
                                            <th key={h} className="px-4 py-3 text-[10px] font-semibold tracking-wider" style={{ color: C.gray }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(req => (
                                        <tr key={req.id} className="border-t hover:bg-slate-50/70 transition-colors" style={{ borderColor: C.border }}>
                                            {/* Order code */}
                                            <td className="px-4 py-3">
                                                <span className="text-xs font-mono font-bold" style={{ color: C.navy }}>
                                                    #{displayOrderCode(req.orderCode, req.id)}
                                                </span>
                                                {req._count?.disputeCases > 0 && (
                                                    <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: C.redLight, color: C.red }}>
                                                        KN
                                                    </span>
                                                )}
                                            </td>
                                            {/* Customer */}
                                            <td className="px-4 py-3">
                                                {req.user ? (
                                                    <div className="flex items-center gap-2">
                                                        <AvatarImage name={req.user.fullName || req.user.email} avatar={req.user.avatar}
                                                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                                            fallbackBackground={C.blue} initialsCount={1} />
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-semibold truncate max-w-[120px]" style={{ color: C.navy }}>{req.user.fullName || '(Khách)'}</p>
                                                            <p className="text-[10px] truncate max-w-[120px]" style={{ color: C.gray }}>{req.user.phoneNumber || req.user.email}</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs" style={{ color: C.gray }}>Khách vãng lai</span>
                                                )}
                                            </td>
                                            {/* Incident */}
                                            <td className="px-4 py-3">
                                                <div>
                                                    <p className="text-xs font-semibold" style={{ color: C.navy }}>{INCIDENT_LABELS[req.incidentType] || req.incidentType}</p>
                                                    <p className="text-[10px]" style={{ color: C.gray }}>{req.vehicleType === 'CAR' ? 'Ô tô' : 'Xe máy'}{req.licensePlate ? ` · ${req.licensePlate}` : ''}</p>
                                                </div>
                                            </td>
                                            {/* Provider */}
                                            <td className="px-4 py-3">
                                                {req.assignedProvider ? (
                                                    <div className="flex items-center gap-2">
                                                        <AvatarImage name={req.assignedProvider.fullName || 'P'} avatar={req.assignedProvider.avatar}
                                                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                                            fallbackBackground={C.orange} initialsCount={1} />
                                                        <p className="text-xs font-semibold truncate max-w-[100px]" style={{ color: C.navy }}>{req.assignedProvider.fullName}</p>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs" style={{ color: C.gray }}>Chưa phân</span>
                                                )}
                                            </td>
                                            {/* Payment */}
                                            <td className="px-4 py-3">
                                                <PaymentBadge method={req.payment?.paymentMethod} amount={req.payment?.totalAmount} />
                                            </td>
                                            {/* Date */}
                                            <td className="px-4 py-3">
                                                <p className="text-xs font-medium" style={{ color: C.navy }}>
                                                    {new Date(req.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                </p>
                                                <p className="text-[10px]" style={{ color: C.gray }}>
                                                    {new Date(req.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </td>
                                            {/* Status */}
                                            <td className="px-4 py-3"><StatusBadge status={req.status} /></td>
                                            {/* Action */}
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => router.push(`/admin/requests/${req.id}`)}
                                                    className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                                                    style={{ color: C.blue }}
                                                    title="Xem chi tiết"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {!loading && total > PAGE_SIZE && (
                        <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: C.border }}>
                            <p className="text-xs" style={{ color: C.gray }}>
                                Trang <span className="font-semibold" style={{ color: C.navy }}>{page}</span> / {totalPages} · Tổng <span className="font-semibold" style={{ color: C.navy }}>{total}</span> đơn
                            </p>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40" style={{ color: C.gray }}>
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let start = Math.max(1, page - 2);
                                    const end = Math.min(totalPages, start + 4);
                                    if (end - start < 4) start = Math.max(1, end - 4);
                                    return start + i;
                                }).filter(p => p <= totalPages).map(p => (
                                    <button key={p} onClick={() => setPage(p)}
                                        className="w-7 h-7 rounded-lg text-xs font-semibold"
                                        style={{ background: page === p ? C.orange : 'transparent', color: page === p ? '#fff' : C.gray }}>
                                        {p}
                                    </button>
                                ))}
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40" style={{ color: C.gray }}>
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
