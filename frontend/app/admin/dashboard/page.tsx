'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminGuard } from '@/lib/guards';
import { adminApi } from '@/lib/api';
import AdminLayout from '@/components/AdminLayout';
import {
    TrendingUp, TrendingDown, Eye, ArrowRight, Bell,
    CheckCircle, AlertTriangle, Info, Settings
} from 'lucide-react';

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

interface KpiCard {
    label: string;
    value: string | number;
    delta: string;
    positive: boolean;
    icon: React.ReactNode;
    accent?: boolean;
    href: string;
}

interface ActivityItem {
    id: string;
    type: 'success' | 'warning' | 'info' | 'dispute' | 'system';
    title: string;
    description: string;
    time: string;
}

interface TopProvider {
    id: string;
    name: string;
    type: string;
    service: string;
    dateApplied: string;
    status: string;
}

interface ActiveDispute {
    orderId: string;
    complainant: string;
    complainantType: string;
    priority: 'High' | 'Medium' | 'Low';
    timer: string;
}

// --- Mock data (sẽ được thay bằng API sau) ---
const mockKpiData: KpiCard[] = [
    {
        label: 'Provider Pending',
        value: 24,
        delta: '+5% from yesterday',
        positive: true,
        href: '/admin/providers?status=PENDING',
        icon: (
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
        ),
    },
    {
        label: 'Active Disputes',
        value: 12,
        delta: '-2% improvement',
        positive: false,
        href: '/admin/transactions?tab=disputes',
        icon: (
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
        ),
    },
    {
        label: 'Pending Payments',
        value: 45,
        delta: '+8% increase',
        positive: true,
        href: '/admin/transactions?tab=pending',
        icon: (
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
    },
    {
        label: 'Withdrawals',
        value: 18,
        delta: '+12% today',
        positive: true,
        href: '/admin/transactions?tab=withdrawals',
        icon: (
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
        ),
    },
];

const mockTodayRevenue: KpiCard = {
    label: 'Today Revenue',
    value: '$1,240',
    delta: '+15% vs yesterday',
    positive: true,
    accent: true,
    href: '/admin/transactions',
    icon: (
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
};

const mockActivity: ActivityItem[] = [
    { id: '1', type: 'success', title: 'Withdrawal Approved', description: "Med-Life Hospital withdrawal request of $450.00 has been approved.", time: '2 minutes ago' },
    { id: '2', type: 'warning', title: 'New Provider Registered', description: '"Swift Towing NYC" registered for a provider account and is awaiting review.', time: '15 minutes ago' },
    { id: '3', type: 'dispute', title: 'New Dispute Filed', description: "User #U-1029 filed a dispute for order #RSQ-9082 regarding service delay.", time: '1 hour ago' },
    { id: '4', type: 'system', title: 'System Update', description: "Database maintenance completed successfully at 02:00 AM UTC.", time: '5 hours ago' },
    { id: '5', type: 'success', title: 'Provider Verified', description: "Urban Rescue documents verified. Account is now active.", time: '8 hours ago' },
];

const mockTopProviders: TopProvider[] = [
    { id: '1', name: 'Fast Towing Co.', type: 'Business', service: 'Towing', dateApplied: 'Oct 24, 2023', status: 'REVIEWING' },
    { id: '2', name: 'Urban Rescue', type: 'Individual', service: 'Ambulance', dateApplied: 'Oct 23, 2023', status: 'PENDING' },
];

const mockDisputes: ActiveDispute[] = [
    { orderId: '#RSQ-9082', complainant: 'John Doe', complainantType: 'User', priority: 'High', timer: '1h 20m left' },
    { orderId: '#RSQ-9075', complainant: 'Med-Help Ltd', complainantType: 'Provider', priority: 'Medium', timer: '4h 45m left' },
];

function ActivityIcon({ type }: { type: ActivityItem['type'] }) {
    if (type === 'success') return <div style={{ background: C.green }} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"><CheckCircle className="w-4 h-4 text-white" /></div>;
    if (type === 'warning') return <div style={{ background: C.orange }} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"><AlertTriangle className="w-4 h-4 text-white" /></div>;
    if (type === 'dispute') return <div style={{ background: C.red }} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"><AlertTriangle className="w-4 h-4 text-white" /></div>;
    if (type === 'system') return <div style={{ background: C.blue }} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"><Settings className="w-4 h-4 text-white" /></div>;
    return <div style={{ background: C.gray }} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"><Info className="w-4 h-4 text-white" /></div>;
}

function PriorityBadge({ priority }: { priority: ActiveDispute['priority'] }) {
    if (priority === 'High') return <span style={{ background: '#fee2e2', color: C.red }} className="px-2.5 py-1 rounded-full text-xs font-semibold">High</span>;
    if (priority === 'Medium') return <span style={{ background: '#fef9c3', color: '#854d0e' }} className="px-2.5 py-1 rounded-full text-xs font-semibold">Medium</span>;
    return <span style={{ background: C.greenLight, color: C.green }} className="px-2.5 py-1 rounded-full text-xs font-semibold">Low</span>;
}

function ProviderStatusBadge({ status }: { status: string }) {
    if (status === 'REVIEWING') return <span style={{ background: '#fef9c3', color: '#854d0e' }} className="px-2.5 py-1 rounded-full text-xs font-semibold">Reviewing</span>;
    if (status === 'PENDING') return <span style={{ background: C.blueLight, color: C.blue }} className="px-2.5 py-1 rounded-full text-xs font-semibold">Pending</span>;
    return <span style={{ background: C.orangeLight, color: C.orange }} className="px-2.5 py-1 rounded-full text-xs font-semibold">{status}</span>;
}

export default function AdminDashboardPage() {
    const router = useRouter();
    const { isReady } = useAdminGuard();
    const [stats, setStats] = useState({
        online: 1204,
        active: 156,
        status: '99.9%',
        responseTime: '14m',
    });

    if (!isReady) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
                <div className="text-center">
                    <div className="w-10 h-10 rounded-full border-[3px] border-t-transparent animate-spin mx-auto mb-3" style={{ borderColor: C.orange, borderTopColor: 'transparent' }} />
                    <p className="text-sm" style={{ color: C.gray }}>Đang tải...</p>
                </div>
            </div>
        );
    }

    return (
        <AdminLayout activeTab="/admin/dashboard">
            <div className="p-6 min-h-screen" style={{ background: C.bg }}>

                {/* ─── Topbar ─── */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="flex-1">
                        <div className="relative max-w-xs">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.gray }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Global Search..."
                                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2"
                                style={{ background: '#ffffff', borderColor: C.border, color: C.navy, fontFamily: 'Lexend, sans-serif' }}
                            />
                        </div>
                    </div>
                    <button className="p-2 rounded-xl hover:bg-white transition-colors relative" style={{ color: C.gray }}>
                        <Bell className="w-5 h-5" />
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: C.red }} />
                    </button>
                    <button className="p-2 rounded-xl hover:bg-white transition-colors" style={{ color: C.gray }}>
                        <Settings className="w-5 h-5" />
                    </button>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: C.orange }}>
                        A
                    </div>
                </div>

                {/* ─── KPI Cards ─── */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                    {mockKpiData.map((card) => (
                        <button
                            key={card.label}
                            onClick={() => router.push(card.href)}
                            className="text-left p-4 rounded-2xl border hover:shadow-md transition-all"
                            style={{ background: '#ffffff', borderColor: C.border }}
                        >
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: C.bg, color: C.orange }}>
                                {card.icon}
                            </div>
                            <p className="text-xs font-medium mb-1" style={{ color: C.gray }}>{card.label}</p>
                            <p className="text-2xl font-bold mb-1" style={{ color: C.navy }}>{card.value}</p>
                            <div className="flex items-center gap-1">
                                {card.positive
                                    ? <TrendingUp className="w-3 h-3" style={{ color: C.green }} />
                                    : <TrendingDown className="w-3 h-3" style={{ color: C.red }} />
                                }
                                <span className="text-xs font-medium" style={{ color: card.positive ? C.green : C.red }}>{card.delta}</span>
                            </div>
                        </button>
                    ))}

                    {/* Today Revenue - accent orange card */}
                    <button
                        onClick={() => router.push(mockTodayRevenue.href)}
                        className="text-left p-4 rounded-2xl col-span-1 hover:opacity-95 transition-all"
                        style={{ background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)` }}
                    >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(255,255,255,0.2)' }}>
                            {mockTodayRevenue.icon}
                        </div>
                        <p className="text-xs font-medium mb-1 text-white/80">{mockTodayRevenue.label}</p>
                        <p className="text-2xl font-bold mb-1 text-white">{mockTodayRevenue.value}</p>
                        <div className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-white/80" />
                            <span className="text-xs font-medium text-white/80">{mockTodayRevenue.delta}</span>
                        </div>
                    </button>
                </div>

                {/* ─── Middle Section: Operations Health + Activity Feed ─── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

                    {/* Operations Health (2/3 width) */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl border p-5 h-full" style={{ borderColor: C.border }}>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: C.orangeLight }}>
                                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                </div>
                                <h2 className="text-sm font-bold" style={{ color: C.navy }}>Operations Health</h2>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { label: 'ONLINE', value: stats.online.toLocaleString(), sub: 'Providers Active', color: C.green },
                                    { label: 'ACTIVE', value: stats.active, sub: 'Orders in progress', color: C.blue },
                                    { label: 'STATUS', value: stats.status, sub: 'System Healthy', color: C.green },
                                    { label: 'RESP. TIME', value: stats.responseTime, sub: 'Avg response', color: C.navy },
                                ].map((stat) => (
                                    <div key={stat.label} className="p-3 rounded-xl" style={{ background: C.bg }}>
                                        <p className="text-[10px] font-semibold tracking-wider mb-1" style={{ color: C.gray }}>{stat.label}</p>
                                        <p className="text-xl font-bold mb-0.5" style={{ color: stat.color }}>{stat.value}</p>
                                        <p className="text-[11px]" style={{ color: C.gray }}>{stat.sub}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Activity Feed (1/3 width) */}
                    <div className="bg-white rounded-2xl border p-5" style={{ borderColor: C.border }}>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: '#fef3c7' }}>
                                <Bell className="w-3.5 h-3.5" style={{ color: '#d97706' }} />
                            </div>
                            <h2 className="text-sm font-bold flex-1" style={{ color: C.navy }}>Activity Feed</h2>
                        </div>
                        <div className="space-y-3">
                            {mockActivity.map((item) => (
                                <div key={item.id} className="flex gap-2.5">
                                    <ActivityIcon type={item.type} />
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold leading-tight" style={{ color: C.navy }}>{item.title}</p>
                                        <p className="text-[11px] leading-snug mt-0.5" style={{ color: C.gray }}>{item.description}</p>
                                        <p className="text-[10px] mt-1" style={{ color: '#94a3b8' }}>{item.time}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button className="mt-4 w-full text-center text-xs font-semibold py-2 rounded-xl border hover:bg-gray-50 transition-colors" style={{ color: C.navy, borderColor: C.border }}>
                            Load More Activity
                        </button>
                    </div>
                </div>

                {/* ─── Bottom Section: Top Provider Approval + Active Disputes ─── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                    {/* Top 5 Provider Approval (2/3) */}
                    <div className="lg:col-span-2 bg-white rounded-2xl border p-5" style={{ borderColor: C.border }}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-bold" style={{ color: C.navy }}>Top 5 Provider Approval</h2>
                            <button
                                onClick={() => router.push('/admin/providers')}
                                className="flex items-center gap-1 text-xs font-semibold hover:underline"
                                style={{ color: C.orange }}
                            >
                                View All <ArrowRight className="w-3 h-3" />
                            </button>
                        </div>

                        <table className="w-full">
                            <thead>
                                <tr>
                                    {['PROVIDER', 'TYPE', 'DATE APPLIED', 'STATUS', 'ACTION'].map(h => (
                                        <th key={h} className="text-left text-[10px] font-semibold tracking-wider pb-3 pr-3" style={{ color: C.gray }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y" style={{ borderColor: C.border }}>
                                {mockTopProviders.map((p) => (
                                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="py-3 pr-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: C.orange }}>
                                                    {p.name.charAt(0)}
                                                </div>
                                                <span className="text-xs font-semibold" style={{ color: C.navy }}>{p.name}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 pr-3 text-xs" style={{ color: C.gray }}>{p.type}</td>
                                        <td className="py-3 pr-3 text-xs" style={{ color: C.gray }}>{p.dateApplied}</td>
                                        <td className="py-3 pr-3">
                                            <ProviderStatusBadge status={p.status} />
                                        </td>
                                        <td className="py-3">
                                            <button
                                                onClick={() => router.push(`/admin/providers/${p.id}`)}
                                                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                                                style={{ color: C.gray }}
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Active Disputes (1/3) */}
                    <div className="bg-white rounded-2xl border p-5" style={{ borderColor: C.border }}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-bold" style={{ color: C.navy }}>Active Disputes</h2>
                            <button
                                onClick={() => router.push('/admin/transactions?tab=disputes')}
                                className="flex items-center gap-1 text-xs font-semibold hover:underline"
                                style={{ color: C.orange }}
                            >
                                View All <ArrowRight className="w-3 h-3" />
                            </button>
                        </div>

                        <table className="w-full">
                            <thead>
                                <tr>
                                    {['ORDER ID', 'COMPLAINANT', 'PRIORITY', 'TIMER', 'ACTION'].map(h => (
                                        <th key={h} className="text-left text-[10px] font-semibold tracking-wider pb-3 pr-2" style={{ color: C.gray }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {mockDisputes.map((d) => (
                                    <tr key={d.orderId} className="border-t hover:bg-gray-50 transition-colors" style={{ borderColor: C.border }}>
                                        <td className="py-3 pr-2">
                                            <span className="text-xs font-bold" style={{ color: C.orange }}>{d.orderId}</span>
                                        </td>
                                        <td className="py-3 pr-2">
                                            <div>
                                                <p className="text-xs font-semibold" style={{ color: C.navy }}>{d.complainant}</p>
                                                <p className="text-[10px]" style={{ color: C.gray }}>({d.complainantType})</p>
                                            </div>
                                        </td>
                                        <td className="py-3 pr-2">
                                            <PriorityBadge priority={d.priority} />
                                        </td>
                                        <td className="py-3 pr-2 text-[11px]" style={{ color: C.gray }}>{d.timer}</td>
                                        <td className="py-3">
                                            <button
                                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors hover:opacity-90"
                                                style={{ background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)` }}
                                            >
                                                Resolve
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </AdminLayout>
    );
}
