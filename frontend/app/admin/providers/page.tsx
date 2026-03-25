'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAdminGuard } from '@/lib/guards';
import { adminApi } from '@/lib/api';
import AdminLayout from '@/components/AdminLayout';
import AvatarImage from '@/components/AvatarImage';
import { Search, ChevronLeft, ChevronRight, Eye, CheckCircle, Filter, Calendar, Users, Clock, XCircle } from 'lucide-react';

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
};

type TabType = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'ALL';

interface Provider {
    id: string;
    fullName: string;
    email: string;
    avatar?: string | null;
    providerType: 'INDIVIDUAL' | 'BUSINESS';
    businessName?: string;
    serviceTypes: string[];
    rescueVehicles?: Array<{ type: string; plateNumber: string; isPrimary: boolean }>;
    verificationStatus: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
    submittedAt: string | null;
}

const TABS: { key: TabType; label: string }[] = [
    { key: 'PENDING', label: 'Pending' },
    { key: 'APPROVED', label: 'Approved' },
    { key: 'REJECTED', label: 'Rejected' },
    { key: 'SUSPENDED', label: 'Suspended' },
    { key: 'ALL', label: 'All' },
];

const SERVICE_LABELS: Record<string, string> = {
    TOWING: 'Towing',
    BATTERY_JUMP: 'Battery',
    TIRE_CHANGE: 'Tire Change',
    FUEL_DELIVERY: 'Fuel Delivery',
    LOCKOUT: 'Lockout',
    BREAKDOWN_REPAIR: 'Full Recovery',
};

const SERVICE_COLORS: Record<string, { bg: string; text: string }> = {
    TOWING: { bg: '#fff7ed', text: '#ea580c' },
    BATTERY_JUMP: { bg: '#fef9c3', text: '#854d0e' },
    TIRE_CHANGE: { bg: '#f0fdf4', text: '#15803d' },
    FUEL_DELIVERY: { bg: '#eff6ff', text: '#1d4ed8' },
    LOCKOUT: { bg: '#fdf4ff', text: '#7e22ce' },
    BREAKDOWN_REPAIR: { bg: '#fef2f2', text: '#dc2626' },
};

function StatusBadge({ status }: { status: Provider['verificationStatus'] }) {
    const configs: Record<string, { label: string; bg: string; color: string; dot: string }> = {
        PENDING: { label: 'Pending', bg: C.yellowLight, color: C.yellow, dot: '#facc15' },
        APPROVED: { label: 'Approved', bg: C.greenLight, color: C.green, dot: C.green },
        REJECTED: { label: 'Rejected', bg: C.redLight, color: C.red, dot: C.red },
        SUSPENDED: { label: 'Suspended', bg: C.orangeLight, color: C.orange, dot: C.orange },
        DRAFT: { label: 'Draft', bg: '#f8fafc', color: C.gray, dot: C.gray },
    };
    const cfg = configs[status] || configs.DRAFT;
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: cfg.bg, color: cfg.color }}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
            {cfg.label}
        </span>
    );
}

const PAGE_SIZE = 10;

export default function ProviderApprovalPage() {
    const router = useRouter();
    const { isReady } = useAdminGuard();
    const [activeTab, setActiveTab] = useState<TabType>('PENDING');
    const [search, setSearch] = useState('');
    const [providerTypeFilter, setProviderTypeFilter] = useState('ALL');
    const [dateFilter, setDateFilter] = useState('');
    const [providers, setProviders] = useState<Provider[]>([]);
    const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, suspended: 0 });
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);

    useEffect(() => {
        if (isReady) loadProviders();
    }, [isReady, activeTab]);

    const loadProviders = async () => {
        try {
            setLoading(true);
            const params: any = {};
            if (activeTab !== 'ALL') params.status = activeTab;
            
            const [data, statsData] = await Promise.all([
                adminApi.getProviders(params),
                adminApi.getProviderStats()
            ]);
            setProviders(data);
            setStats(statsData);
        } catch (err) {
            console.error('Failed to load providers:', err);
        } finally {
            setLoading(false);
        }
    };

    const filtered = providers.filter(p => {
        if (dateFilter && p.submittedAt) {
            const dDate = new Date(p.submittedAt);
            const dStr = `${dDate.getFullYear()}-${String(dDate.getMonth() + 1).padStart(2, '0')}-${String(dDate.getDate()).padStart(2, '0')}`;
            if (dStr !== dateFilter) return false;
        }

        const q = search.toLowerCase();
        const matchSearch = !q ||
            p.fullName?.toLowerCase().includes(q) ||
            p.email?.toLowerCase().includes(q) ||
            p.businessName?.toLowerCase().includes(q) ||
            (p.rescueVehicles?.some(v => v.plateNumber.toLowerCase().includes(q)) ?? false);
        const matchType = providerTypeFilter === 'ALL' || p.providerType === providerTypeFilter;
        return matchSearch && matchType;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // Stats
    const { total, pending, approved, rejected } = stats;

    if (!isReady) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
                <div className="w-10 h-10 rounded-full border-[3px] border-t-transparent animate-spin" style={{ borderColor: C.orange, borderTopColor: 'transparent' }} />
            </div>
        );
    }

    return (
        <AdminLayout activeTab="/admin/providers">
            <div className="p-6 min-h-screen" style={{ background: C.bg }}>

                {/* Page Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold mb-1" style={{ color: C.navy }}>Provider Approval</h1>
                    <p className="text-sm" style={{ color: C.gray }}>Review and manage rescue provider applications across all regions.</p>
                </div>

                {/* ─── Stats Cards Row ─── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                    {[
                        { label: 'TỔNG YÊU CẦU', value: total, color: C.navy, accent: false, icon: <Users className="w-4 h-4" /> },
                        { label: 'CHỜ DUYỆT', value: pending, color: C.orange, accent: false, icon: <Clock className="w-4 h-4" /> },
                        { label: 'ĐÃ DUYỆT', value: approved, color: C.green, accent: false, icon: <CheckCircle className="w-4 h-4" /> },
                        { label: 'TỪ CHỐI', value: rejected, color: C.red, accent: false, icon: <XCircle className="w-4 h-4" /> },
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

                {/* Main Card */}
                <div className="bg-white rounded-2xl border mb-5" style={{ borderColor: C.border }}>

                    {/* Tabs */}
                    <div className="flex items-center px-5 border-b" style={{ borderColor: C.border }}>
                        {TABS.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => { setActiveTab(tab.key); setPage(1); }}
                                className="px-4 py-4 text-sm font-medium relative transition-colors"
                                style={{
                                    color: activeTab === tab.key ? C.orange : C.gray,
                                    borderBottom: activeTab === tab.key ? `2px solid ${C.orange}` : '2px solid transparent',
                                    marginBottom: '-1px',
                                }}
                            >
                                {tab.label}
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
                                placeholder="Search by name, email or identity..."
                                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2"
                                style={{ borderColor: C.border, color: C.navy, fontFamily: 'Lexend, sans-serif' }}
                            />
                        </div>

                        {/* Provider Type Filter */}
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm cursor-pointer" style={{ borderColor: C.border }}>
                            <Filter className="w-3.5 h-3.5" style={{ color: C.gray }} />
                            <select
                                value={providerTypeFilter}
                                onChange={e => { setProviderTypeFilter(e.target.value); setPage(1); }}
                                className="bg-transparent text-sm focus:outline-none cursor-pointer pr-1"
                                style={{ color: C.navy, fontFamily: 'Lexend, sans-serif' }}
                            >
                                <option value="ALL">Provider Type</option>
                                <option value="INDIVIDUAL">Individual</option>
                                <option value="BUSINESS">Business</option>
                            </select>
                        </div>

                        {/* Date Range */}
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm relative" style={{ borderColor: C.border }}>
                            <Calendar className="w-3.5 h-3.5" style={{ color: C.gray }} />
                            <input
                                type="date"
                                value={dateFilter}
                                onClick={(e) => {
                                    try {
                                        if ('showPicker' in HTMLInputElement.prototype) {
                                            (e.target as HTMLInputElement).showPicker();
                                        }
                                    } catch (err) {}
                                }}
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

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr style={{ background: C.bg }}>
                                    {['IDENTITY', 'TYPE', 'SERVICES', 'VEHICLE', 'SUBMITTED AT', 'STATUS', 'AC'].map(h => (
                                        <th key={h} className="text-left text-[10px] font-semibold tracking-wider px-4 py-3" style={{ color: C.gray }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-12">
                                            <div className="w-8 h-8 rounded-full border-[3px] border-t-transparent animate-spin mx-auto" style={{ borderColor: C.orange, borderTopColor: 'transparent' }} />
                                        </td>
                                    </tr>
                                ) : paginated.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-12">
                                            <div className="flex flex-col items-center gap-2">
                                                <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke={C.border} strokeWidth={1.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                                <p className="text-sm" style={{ color: C.gray }}>Không tìm thấy nhà cung cấp nào</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : paginated.map(provider => {
                                    const primaryVehicle = provider.rescueVehicles?.find(v => v.isPrimary) || provider.rescueVehicles?.[0];
                                    return (
                                        <tr key={provider.id} className="border-t hover:bg-gray-50 transition-colors" style={{ borderColor: C.border }}>
                                            {/* Identity */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <AvatarImage
                                                        name={provider.fullName || provider.businessName || 'Provider'}
                                                        avatar={provider.avatar}
                                                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                                        fallbackBackground={C.orange}
                                                        initialsCount={1}
                                                    />
                                                    <div>
                                                        <p className="text-sm font-semibold" style={{ color: C.navy }}>
                                                            {provider.businessName || provider.fullName}
                                                        </p>
                                                        <p className="text-xs" style={{ color: C.gray }}>{provider.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            {/* Type */}
                                            <td className="px-4 py-3 text-xs" style={{ color: C.gray }}>
                                                {provider.providerType === 'INDIVIDUAL' ? 'Individual' : 'Business'}
                                            </td>
                                            {/* Services */}
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {provider.serviceTypes.slice(0, 2).map(s => {
                                                        const col = SERVICE_COLORS[s] || { bg: C.bg, text: C.gray };
                                                        return (
                                                            <span key={s} className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: col.bg, color: col.text }}>
                                                                {SERVICE_LABELS[s] || s}
                                                            </span>
                                                        );
                                                    })}
                                                    {provider.serviceTypes.length > 2 && (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: C.bg, color: C.gray }}>
                                                            +{provider.serviceTypes.length - 2}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            {/* Vehicle */}
                                            <td className="px-4 py-3">
                                                {primaryVehicle ? (
                                                    <div>
                                                        <p className="text-xs font-medium" style={{ color: C.navy }}>
                                                            {primaryVehicle.type === 'CAR' ? 'Car' : 'Motorcycle'}
                                                        </p>
                                                        <p className="text-[11px] font-mono" style={{ color: C.gray }}>{primaryVehicle.plateNumber}</p>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs" style={{ color: C.gray }}>—</span>
                                                )}
                                            </td>
                                            {/* Submitted At */}
                                            <td className="px-4 py-3 text-xs" style={{ color: C.gray }}>
                                                {provider.submittedAt
                                                    ? new Date(provider.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                    : '—'}
                                            </td>
                                            {/* Status */}
                                            <td className="px-4 py-3">
                                                <StatusBadge status={provider.verificationStatus} />
                                            </td>
                                            {/* Actions */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => router.push(`/admin/providers/${provider.id}`)}
                                                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                                                        style={{ color: C.gray }}
                                                        title="Xem chi tiết"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    {provider.verificationStatus === 'PENDING' && (
                                                        <button
                                                            onClick={() => router.push(`/admin/providers/${provider.id}`)}
                                                            className="p-1.5 rounded-lg hover:bg-green-50 transition-colors"
                                                            style={{ color: C.green }}
                                                            title="Duyệt nhanh"
                                                        >
                                                            <CheckCircle className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Footer */}
                    <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: C.border }}>
                        <p className="text-xs" style={{ color: C.gray }}>
                            Showing <span className="font-semibold" style={{ color: C.navy }}>
                                {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
                            </span> to <span className="font-semibold" style={{ color: C.navy }}>
                                {Math.min(page * PAGE_SIZE, filtered.length)}
                            </span> of <span className="font-semibold" style={{ color: C.navy }}>
                                {filtered.length}
                            </span> {activeTab === 'PENDING' ? 'pending requests' : 'providers'}
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
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(p => (
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
                </div>

            </div>
        </AdminLayout>
    );
}
