'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdminGuard } from '@/lib/guards';
import { useLanguage } from '@/contexts/LanguageContext';
import { adminApi } from '@/lib/api';
import { useRouter } from 'next/navigation';
import {
    DollarSign,
    TrendingUp,
    Wallet,
    ArrowRightLeft,
    Clock,
    Search,
    Filter,
    FileText,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

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

interface TransactionSummary {
    totalRevenue: number;
    totalCommission: number;
    totalTopupToday: number;
    pendingTransactions: number;
    pendingWithdrawals: number;
}

export default function AdminTransactionsPage() {
    const { isReady } = useAdminGuard();
    const router = useRouter();
    const { t } = useLanguage();
    const tp = (key: string) => t(`admin.transactions.${key}`);
    const referenceLabel = (referenceType: string | undefined) => {
        if (!referenceType) return '—';
        const path = `admin.transactions.references.${referenceType}`;
        const label = t(path);
        return label === path ? referenceType : label;
    };

    const [summary, setSummary] = useState<TransactionSummary | null>(null);
    const [activeTab, setActiveTab] = useState('providerWallets');

    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('ALL');
    const [sort, setSort] = useState('balance_desc');
    const [page, setPage] = useState(1);

    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [initialLoad, setInitialLoad] = useState(true);

    const LIMIT = 20;

    const fetchSummary = async () => {
        try {
            const res = await adminApi.getTransactionSummary();
            setSummary(res);
        } catch (error) {
            console.error('Failed to fetch summary', error);
        }
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const query: Record<string, unknown> = {
                skip: (page - 1) * LIMIT,
                take: LIMIT,
            };
            if (search) query.search = search;
            if (status !== 'ALL') query.status = status;
            if (sort && activeTab.includes('Wallets')) query.sort = sort;

            let res;
            switch (activeTab) {
                case 'providerWallets':
                    res = await adminApi.getProviderWallets(query);
                    break;
                case 'userWallets':
                    res = await adminApi.getUserWallets(query);
                    break;
                case 'providerTopup':
                    res = await adminApi.getTopupTransactions({ ...query, userType: 'PROVIDER' });
                    break;
                case 'userTopup':
                    res = await adminApi.getTopupTransactions({ ...query, userType: 'USER' });
                    break;
                case 'jobPayment':
                    res = await adminApi.getJobPaymentTransactions(query);
                    break;
                case 'payment':
                    res = await adminApi.getPayments(query);
                    break;
                default:
                    res = { items: [], total: 0 };
            }

            setData(res.items || []);
            setTotal(res.total || 0);
        } catch (error) {
            console.error('Failed to fetch data', error);
            toast.error(tp('empty'));
        } finally {
            setLoading(false);
            setInitialLoad(false);
        }
    }, [activeTab, page, search, status, sort, t]);

    useEffect(() => {
        if (!isReady) return;
        fetchSummary();
    }, [isReady]);

    useEffect(() => {
        if (!isReady) return;
        fetchData();
    }, [isReady, fetchData]);

    const handleTabChange = (val: string) => {
        setActiveTab(val);
        setPage(1);
        setSearch('');
        setStatus('ALL');
        setSort('balance_desc');
    };

    const totalPages = Math.ceil(total / LIMIT) || 1;

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN').format(amount) + '₫';
    };

    const renderStatusBadge = (statusStr: string) => {
        let bg, color, dot, label;
        switch (statusStr) {
            case 'COMPLETED':
                bg = C.greenLight; color = C.green; dot = C.green; label = tp('status.COMPLETED');
                break;
            case 'PENDING':
                bg = C.yellowLight; color = C.yellow; dot = '#facc15'; label = tp('status.PENDING');
                break;
            case 'FAILED':
                bg = C.redLight; color = C.red; dot = C.red; label = tp('status.FAILED');
                break;
            case 'EXPIRED':
            case 'CANCELLED':
                bg = '#f8fafc'; color = C.gray; dot = C.gray; label = tp('status.cancelledGroup');
                break;
            default:
                bg = '#f8fafc'; color = C.gray; dot = C.gray; label = statusStr;
                break;
        }
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: bg, color }}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dot }} />
                {label}
            </span>
        );
    };

    const tabItems = [
        { id: 'providerWallets', label: 'Ví Đối Tác (Provider)' },
        { id: 'userWallets', label: 'Ví Khách Hàng (User)' },
        { id: 'providerTopup', label: 'Lịch sử nạp tiền (Provider)' },
        { id: 'userTopup', label: 'Lịch sử nạp tiền (User)' },
        { id: 'jobPayment', label: 'Thanh toán Job' },
        { id: 'payment', label: 'Giao dịch hệ thống' },
    ];

    if (!isReady) {
        return (
            <AdminLayout activeTab="/admin/transactions">
                <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
                    <div className="w-10 h-10 rounded-full border-[3px] border-t-transparent animate-spin" style={{ borderColor: C.orange, borderTopColor: 'transparent' }} />
                </div>
            </AdminLayout>
        );
    }

    const isWalletTab = activeTab === 'providerWallets' || activeTab === 'userWallets';

    return (
        <AdminLayout activeTab="/admin/transactions">
            <div className="p-6 min-h-screen" style={{ background: C.bg }}>
                {/* Page Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold mb-1" style={{ color: C.navy }}>{tp('title')}</h1>
                    <p className="text-sm" style={{ color: C.gray }}>{tp('subtitle')}</p>
                </div>

                {/* Stats Cards Row */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
                    {[
                        { label: tp('summary.totalRevenue'), value: summary ? formatCurrency(summary.totalRevenue) : '...', color: C.navy },
                        { label: tp('summary.totalCommission'), value: summary ? formatCurrency(summary.totalCommission) : '...', color: C.green },
                        { label: tp('summary.totalTopupToday'), value: summary ? formatCurrency(summary.totalTopupToday) : '...', color: C.blue },
                        { label: tp('summary.pendingTransactions'), value: summary ? summary.pendingTransactions : '...', color: C.orange },
                        { label: tp('summary.pendingWithdrawals'), value: summary ? summary.pendingWithdrawals : '...', color: C.red },
                    ].map(stat => (
                        <div key={stat.label} className="bg-white rounded-2xl border p-4" style={{ borderColor: C.border }}>
                            <p className="text-[10px] font-semibold tracking-wider mb-2 uppercase" style={{ color: C.gray }}>{stat.label}</p>
                            <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                        </div>
                    ))}
                </div>

                {/* Main Card */}
                <div className="bg-white rounded-2xl border mb-5" style={{ borderColor: C.border }}>
                    {/* Tabs */}
                    <div className="flex items-center px-5 border-b overflow-x-auto hide-scrollbar" style={{ borderColor: C.border }}>
                        {tabItems.map((tabItem) => (
                            <button
                                key={tabItem.id}
                                type="button"
                                onClick={() => handleTabChange(tabItem.id)}
                                className="px-4 py-4 text-sm font-medium relative transition-colors whitespace-nowrap"
                                style={{
                                    color: activeTab === tabItem.id ? C.orange : C.gray,
                                    borderBottom: activeTab === tabItem.id ? `2px solid ${C.orange}` : '2px solid transparent',
                                    marginBottom: '-1px',
                                }}
                            >
                                {tabItem.label}
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
                                placeholder={isWalletTab ? tp('filters.search') : tp('filters.searchJob')}
                                value={search}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); }}
                                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2"
                                style={{ borderColor: C.border, color: C.navy, fontFamily: 'Lexend, sans-serif' }}
                            />
                        </div>

                        {/* Sort Filter for Wallets */}
                        {isWalletTab && (
                            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm cursor-pointer" style={{ borderColor: C.border }}>
                                <Filter className="w-3.5 h-3.5" style={{ color: C.gray }} />
                                <select
                                    value={sort}
                                    onChange={(e) => { setSort(e.target.value); setPage(1); }}
                                    className="bg-transparent text-sm focus:outline-none cursor-pointer pr-1"
                                    style={{ color: C.navy, fontFamily: 'Lexend, sans-serif' }}
                                >
                                    <option value="balance_desc">Số dư giảm ↓</option>
                                    <option value="balance_asc">Số dư tăng ↑</option>
                                    <option value="updated_desc">Mới cập nhật</option>
                                </select>
                            </div>
                        )}

                        {/* Status Filter */}
                        {!isWalletTab && (
                            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm cursor-pointer" style={{ borderColor: C.border }}>
                                <Filter className="w-3.5 h-3.5" style={{ color: C.gray }} />
                                <select
                                    value={status}
                                    onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                                    className="bg-transparent text-sm focus:outline-none cursor-pointer pr-1"
                                    style={{ color: C.navy, fontFamily: 'Lexend, sans-serif' }}
                                >
                                    <option value="ALL">{tp('filters.all')}</option>
                                    <option value="COMPLETED">{tp('status.COMPLETED')}</option>
                                    <option value="PENDING">{tp('status.PENDING')}</option>
                                    <option value="FAILED">{tp('status.FAILED')}</option>
                                    {['providerTopup', 'userTopup', 'jobPayment'].includes(activeTab) ? (
                                        <option value="EXPIRED_OR_CANCELLED">{tp('status.cancelledGroup')}</option>
                                    ) : (
                                        <option value="CANCELLED">{tp('status.CANCELLED')}</option>
                                    )}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead style={{ background: C.bg }}>
                                <tr>
                                    {isWalletTab ? (
                                        <>
                                            <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3 uppercase" style={{ color: C.gray }}>
                                                {tp('columns.user')}
                                            </th>
                                            <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3 uppercase" style={{ color: C.gray }}>
                                                Số dư khả dụng
                                            </th>
                                            <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3 uppercase" style={{ color: C.gray }}>
                                                Đóng băng
                                            </th>
                                            <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3 uppercase" style={{ color: C.gray }}>
                                                Thống kê
                                            </th>
                                            <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3 uppercase" style={{ color: C.gray }}>
                                                {tp('columns.createdAt')}
                                            </th>
                                            <th className="text-right text-[10px] font-semibold tracking-wider px-4 py-3 uppercase" style={{ color: C.gray }}>
                                                Chi tiết
                                            </th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3 uppercase" style={{ color: C.gray }}>
                                                {tp('columns.transactionId')}
                                            </th>
                                            {['providerTopup', 'userTopup', 'payment'].includes(activeTab) && (
                                                <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3 uppercase" style={{ color: C.gray }}>
                                                    {tp('columns.user')}
                                                </th>
                                            )}
                                            {['jobPayment'].includes(activeTab) && (
                                                <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3 uppercase" style={{ color: C.gray }}>
                                                    {tp('columns.reference')}
                                                </th>
                                            )}
                                            <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3 uppercase" style={{ color: C.gray }}>
                                                {tp('columns.amount')}
                                            </th>
                                            <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3 uppercase" style={{ color: C.gray }}>
                                                {tp('columns.status')}
                                            </th>
                                            <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3 uppercase" style={{ color: C.gray }}>
                                                {tp('columns.createdAt')}
                                            </th>
                                            {['payment'].includes(activeTab) && (
                                                <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3 uppercase" style={{ color: C.gray }}>
                                                    {tp('columns.paymentMethod')}
                                                </th>
                                            )}
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {loading && initialLoad ? (
                                    <tr>
                                        <td colSpan={10} className="text-center py-12">
                                            <div className="w-8 h-8 rounded-full border-[3px] border-t-transparent animate-spin mx-auto" style={{ borderColor: C.orange, borderTopColor: 'transparent' }} />
                                        </td>
                                    </tr>
                                ) : data.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="text-center py-12 flex flex-col items-center gap-2">
                                            <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke={C.border} strokeWidth={1.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            <span style={{ color: C.gray }}>{tp('empty')}</span>
                                        </td>
                                    </tr>
                                ) : (
                                    data.map((item) => (
                                        <tr key={item.id} className="border-t hover:bg-gray-50 transition-colors" style={{ borderColor: C.border }}>
                                            {isWalletTab ? (
                                                <>
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold text-sm" style={{ color: C.navy }}>
                                                            {item.provider?.fullName || item.user?.fullName || 'Unknown'}
                                                        </div>
                                                        <div className="text-xs" style={{ color: C.gray }}>
                                                            {item.provider?.email || item.user?.email || ''}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 font-bold text-sm" style={{ color: C.navy }}>
                                                        {formatCurrency(item.availableBalance)}
                                                    </td>
                                                    <td className="px-4 py-3 font-semibold text-sm" style={{ color: C.orange }}>
                                                        {formatCurrency(item.pendingBalance)}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="text-xs font-semibold" style={{ color: C.navy }}>
                                                            {item._count?.transactions || 0} Giao dịch
                                                        </div>
                                                        <div className="text-xs" style={{ color: C.gray }}>
                                                            {item._count?.topupTransactions || item._count?.topupTxs || 0} Lần nạp
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm" style={{ color: C.gray }}>
                                                        {new Date(item.updatedAt).toLocaleString('vi-VN')}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <button 
                                                            onClick={() => {
                                                                const role = activeTab === 'providerWallets' ? 'provider' : 'user';
                                                                const id = item.providerId || item.userId;
                                                                router.push(`/admin/transactions/${role}/${id}`);
                                                            }}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-orange-50 transition-colors"
                                                            style={{ color: C.orange }}
                                                        >
                                                            Xem ví <ExternalLink className="w-3.5 h-3.5" />
                                                        </button>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="px-4 py-3 font-mono text-xs" style={{ color: C.navy }}>
                                                        {item.id ? item.id.slice(-8).toUpperCase() : '—'}
                                                    </td>

                                                    {['providerTopup', 'userTopup'].includes(activeTab) && (
                                                        <td className="px-4 py-3">
                                                            <div className="font-semibold text-sm" style={{ color: C.navy }}>
                                                                {item.wallet?.provider?.fullName || item.wallet?.user?.fullName || 'Unknown'}
                                                            </div>
                                                            <div className="text-xs" style={{ color: C.gray }}>
                                                                {item.wallet?.provider?.email || item.wallet?.user?.email || ''}
                                                            </div>
                                                        </td>
                                                    )}

                                                    {['payment'].includes(activeTab) && (
                                                        <td className="px-4 py-3">
                                                            <div className="font-semibold text-xs" style={{ color: C.navy }}>
                                                                Req: #{item.requestId ? item.requestId.slice(-8).toUpperCase() : '—'}
                                                            </div>
                                                            <div className="text-xs" style={{ color: C.gray }}>
                                                                {item.request?.user?.fullName ?? '—'} →{' '}
                                                                {item.request?.assignedProvider?.fullName || 'Provider'}
                                                            </div>
                                                        </td>
                                                    )}

                                                    {['jobPayment'].includes(activeTab) && (
                                                        <td className="px-4 py-3">
                                                            <div className="text-xs font-semibold" style={{ color: C.navy }}>
                                                                Req: <span className="font-mono">{item.requestId ? item.requestId.slice(-8).toUpperCase() : '—'}</span>
                                                            </div>
                                                            {item.transferCode && (
                                                                <div className="text-xs mt-1" style={{ color: C.gray }}>
                                                                    Ref: {item.transferCode}
                                                                </div>
                                                            )}
                                                        </td>
                                                    )}

                                                    <td className="px-4 py-3 font-bold text-sm" style={{ color: C.navy }}>
                                                        {formatCurrency(item.amount || item.totalAmount || 0)}
                                                    </td>

                                                    <td className="px-4 py-3">{renderStatusBadge(item.status)}</td>

                                                    <td className="px-4 py-3 whitespace-nowrap text-sm" style={{ color: C.gray }}>
                                                        {new Date(item.createdAt).toLocaleString('vi-VN')}
                                                    </td>

                                                    {['payment'].includes(activeTab) && (
                                                        <td className="px-4 py-3 text-sm font-semibold" style={{ color: C.navy }}>
                                                            {item.paymentMethod}
                                                        </td>
                                                    )}
                                                </>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Footer */}
                    {!loading && total > 0 && (
                        <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: C.border }}>
                            <p className="text-xs" style={{ color: C.gray }}>
                                Showing <span className="font-semibold" style={{ color: C.navy }}>
                                    {data.length === 0 ? 0 : (page - 1) * LIMIT + 1}
                                </span> to <span className="font-semibold" style={{ color: C.navy }}>
                                    {Math.min(page * LIMIT, total)}
                                </span> of <span className="font-semibold" style={{ color: C.navy }}>
                                    {total}
                                </span> {isWalletTab ? 'ví' : 'giao dịch'}
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
