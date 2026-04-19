'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
    BarChart2,
} from 'lucide-react';
import { ChartCard, HorizontalBarChart, LineSparkChart } from '@/components/AdminCharts';
import { toast } from 'react-hot-toast';
import { displayOrderCode } from '@/lib/reconciliation';

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

function localeTag(locale: string) {
    return locale === 'vi' ? 'vi-VN' : 'en-US';
}

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
    const { t, locale } = useLanguage();
    const loc = localeTag(locale);
    const tp = (key: string) => t(`admin.transactions.${key}`);
    const tlp = (key: string, params?: Record<string, string | number>) =>
        t(`admin.transactions.listPage.${key}`, params);
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

    // Chart data
    const [chartTopProviders, setChartTopProviders] = useState<{ rank: number; label: string; value: number; displayValue: string }[]>([]);
    const [chartTrend, setChartTrend] = useState<{ label: string; total: number }[]>([]);
    const [chartsLoading, setChartsLoading] = useState(true);

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
                case 'withdrawals':
                    res = await adminApi.getWithdrawals({ ...query, userType: 'ALL' });
                    break;
                default:
                    res = { items: [], total: 0 };
            }

            setData(res.items || []);
            setTotal(res.total || 0);
        } catch (error) {
            console.error('Failed to fetch data', error);
            toast.error(t('admin.transactions.walletDetail.fetchError'));
        } finally {
            setLoading(false);
            setInitialLoad(false);
        }
    }, [activeTab, page, search, status, sort, t]);

    useEffect(() => {
        if (!isReady) return;
        fetchSummary();
        adminApi.getTopProvidersByCommission().then(setChartTopProviders).catch(() => {});
        adminApi.getRequestStatusTrend().then(d => setChartTrend(d.map(x => ({ label: x.label, total: x.total })))).catch(() => {}).finally(() => setChartsLoading(false));
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
        return new Intl.NumberFormat(loc).format(amount) + '₫';
    };

    const renderStatusBadge = (statusStr: string) => {
        const path = `status.${statusStr}`;
        const translated = tp(path);
        const label =
            translated === `admin.transactions.${path}` ? statusStr || '—' : translated;
        let bg: string;
        let color: string;
        let dot: string;
        switch (statusStr) {
            case 'COMPLETED':
                bg = C.greenLight; color = C.green; dot = C.green; break;
            case 'PENDING':
                bg = C.yellowLight; color = C.yellow; dot = '#facc15'; break;
            case 'FAILED':
                bg = C.redLight; color = C.red; dot = C.red; break;
            case 'EXPIRED':
            case 'CANCELLED':
                bg = '#f8fafc'; color = C.gray; dot = C.gray; break;
            case 'USER_CONFIRMED':
                bg = '#eff6ff'; color = '#2563eb'; dot = '#3b82f6'; break;
            case 'PROVIDER_CONFIRMED':
                bg = '#f0fdf4'; color = '#15803d'; dot = '#22c55e'; break;
            case 'REFUNDED':
                bg = '#fdf4ff'; color = '#a21caf'; dot = '#d946ef'; break;
            case 'DISPUTED':
                bg = C.redLight; color = C.red; dot = C.red; break;
            default:
                bg = '#f8fafc'; color = C.gray; dot = C.gray; break;
        }
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: bg, color }}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dot }} />
                {label}
            </span>
        );
    };

    const tabItems = useMemo(
        () => [
            { id: 'providerWallets', label: tlp('tabs.providerWallets') },
            { id: 'userWallets', label: tlp('tabs.userWallets') },
            { id: 'providerTopup', label: tlp('tabs.providerTopup') },
            { id: 'userTopup', label: tlp('tabs.userTopup') },
            { id: 'withdrawals', label: tlp('tabs.withdrawals') },
            { id: 'jobPayment', label: tlp('tabs.jobPayment') },
            { id: 'payment', label: tlp('tabs.payment') },
        ],
        [t],
    );

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
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
                    {[
                        { label: tp('summary.totalRevenue'), value: summary ? formatCurrency(summary.totalRevenue) : '...', color: C.navy, icon: <DollarSign className="w-4 h-4" /> },
                        { label: tp('summary.totalCommission'), value: summary ? formatCurrency(summary.totalCommission) : '...', color: C.green, icon: <TrendingUp className="w-4 h-4" /> },
                        { label: tp('summary.totalTopupToday'), value: summary ? formatCurrency(summary.totalTopupToday) : '...', color: C.blue, icon: <Wallet className="w-4 h-4" /> },
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
                    <ChartCard
                        title={tlp('chartTopProvidersCommission')}
                        icon={<BarChart2 className="w-3.5 h-3.5" />}
                        iconBg="#f0fdf4" iconColor="#16a34a"
                    >
                        <HorizontalBarChart
                            loading={chartsLoading}
                            items={chartTopProviders}
                            color="#16a34a"
                        />
                    </ChartCard>
                    <ChartCard
                        title={tlp('chartRequestTrend14d')}
                        icon={<BarChart2 className="w-3.5 h-3.5" />}
                        iconBg="#fff7ed" iconColor="#f97316"
                    >
                        <LineSparkChart
                            points={chartTrend.map(d => ({ label: d.label, value: d.total }))}
                            color="#f97316"
                            showLabels
                            height={110}
                        />
                    </ChartCard>
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
                                    <option value="balance_desc">{tlp('sortBalanceDesc')}</option>
                                    <option value="balance_asc">{tlp('sortBalanceAsc')}</option>
                                    <option value="updated_desc">{tlp('sortUpdatedDesc')}</option>
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
                                    {['providerTopup', 'userTopup', 'jobPayment', 'withdrawals'].includes(activeTab) ? (
                                        <option value="EXPIRED_OR_CANCELLED">{tp('status.cancelledGroup')}</option>
                                    ) : (
                                        <option value="CANCELLED">{tp('status.CANCELLED')}</option>
                                    )}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Info Banner - Job Payment */}
                    {activeTab === 'jobPayment' && (
                        <div className="mx-4 mb-3 mt-3 flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                            <svg className="mt-0.5 shrink-0 w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <div>
                                <p className="text-xs font-semibold text-blue-700 mb-0.5">{tlp('jobPaymentHelpTitle')}</p>
                                <p className="text-[11px] text-blue-600 leading-relaxed mb-1">{tlp('jobPaymentHelpP1')}</p>
                                <p className="text-[11px] text-blue-600 leading-relaxed mb-1">
                                    {tlp('jobPaymentHelpP2', { tabSystem: tlp('tabs.payment') })}
                                </p>
                                <p className="text-[11px] text-blue-600 leading-relaxed">
                                    {tlp('jobPaymentHelpP3', {
                                        tabProvider: tlp('tabs.providerWallets'),
                                        tabUser: tlp('tabs.userWallets'),
                                    })}
                                </p>
                            </div>
                        </div>
                    )}

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
                                                {tlp('walletColAvailable')}
                                            </th>
                                            <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3 uppercase" style={{ color: C.gray }}>
                                                {tlp('walletColFrozen')}
                                            </th>
                                            {activeTab === 'providerWallets' && (
                                                <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3 uppercase" style={{ color: C.gray }}>
                                                    {tlp('walletColCommission')}
                                                </th>
                                            )}
                                            <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3 uppercase" style={{ color: C.gray }}>
                                                {tlp('walletColStats')}
                                            </th>
                                            <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3 uppercase" style={{ color: C.gray }}>
                                                {tp('columns.createdAt')}
                                            </th>
                                            <th className="text-right text-[10px] font-semibold tracking-wider px-4 py-3 uppercase" style={{ color: C.gray }}>
                                                {tlp('walletColActions')}
                                            </th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3 uppercase" style={{ color: C.gray }}>
                                                {tp('columns.transactionId')}
                                            </th>
                                            {['payment', 'providerTopup', 'userTopup', 'withdrawals'].includes(activeTab) && (
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
                                            {['payment'].includes(activeTab) && (
                                                <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3 uppercase" style={{ color: C.gray }}>
                                                    {tlp('colCommission')}
                                                </th>
                                            )}
                                            {['withdrawals'].includes(activeTab) && (
                                                <th className="text-center text-[10px] font-semibold tracking-wider px-4 py-3 uppercase" style={{ color: C.gray }}>
                                                    {tlp('colWalletReconcile')}
                                                </th>
                                            )}
                                            <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3 uppercase" style={{ color: C.gray }}>
                                                {tp('columns.status')}
                                            </th>
                                            {['payment'].includes(activeTab) && (
                                                <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3 uppercase" style={{ color: C.gray }}>
                                                    {tp('columns.paymentMethod')}
                                                </th>
                                            )}
                                            <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3 uppercase" style={{ color: C.gray }}>
                                                {tp('columns.createdAt')}
                                            </th>
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
                                                            {item.provider?.fullName || item.user?.fullName || tlp('unknownUser')}
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
                                                    {activeTab === 'providerWallets' && (
                                                        <td className="px-4 py-3">
                                                            <div className="font-semibold text-sm" style={{ color: '#a21caf' }}>
                                                                {formatCurrency(item.totalCommission ?? 0)}
                                                            </div>
                                                            <div className="text-[10px]" style={{ color: C.gray }}>{tlp('commissionPlatformSubtitle')}</div>
                                                        </td>
                                                    )}
                                                    <td className="px-4 py-3">
                                                        <div className="text-xs font-semibold" style={{ color: C.navy }}>
                                                            {tlp('walletStatTransactions', { count: item._count?.transactions || 0 })}
                                                        </div>
                                                        <div className="text-xs" style={{ color: C.gray }}>
                                                            {tlp('walletStatTopups', { count: item._count?.topupTransactions || item._count?.topupTxs || 0 })}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm" style={{ color: C.gray }}>
                                                        {new Date(item.updatedAt).toLocaleString(loc)}
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
                                                            {tlp('viewWallet')} <ExternalLink className="w-3.5 h-3.5" />
                                                        </button>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="px-4 py-3 font-mono text-xs" style={{ color: C.navy }}>
                                                        <div className="font-semibold">
                                                            {item.txnCode || (item.id ? item.id.slice(-8).toUpperCase() : '—')}
                                                        </div>
                                                        {['providerTopup', 'userTopup', 'withdrawals'].includes(activeTab) && item.transferCode && (
                                                            <div className="text-[10px] font-normal mt-0.5" style={{ color: C.gray }}>{tlp('labelTransfer')} {item.transferCode}</div>
                                                        )}
                                                        {['providerTopup', 'userTopup', 'withdrawals'].includes(activeTab) && item.sepayReferenceCode && (
                                                            <div className="text-[10px] font-normal mt-0.5" style={{ color: C.gray }}>{tlp('labelBank')} {item.sepayReferenceCode}</div>
                                                        )}
                                                        {activeTab === 'jobPayment' && item.transferCode && (
                                                            <div className="text-[10px] font-normal mt-0.5" style={{ color: C.gray }}>{tlp('labelTransfer')} {item.transferCode}</div>
                                                        )}
                                                    </td>

                                                    {['providerTopup', 'userTopup', 'withdrawals'].includes(activeTab) && (
                                                        <td className="px-4 py-3">
                                                            <div className="font-semibold text-sm" style={{ color: C.navy }}>
                                                                {item.wallet?.provider?.fullName || item.wallet?.user?.fullName || item.user?.fullName || tlp('unknownUser')}
                                                            </div>
                                                            <div className="text-xs" style={{ color: C.gray }}>
                                                                {item.wallet?.provider?.email || item.wallet?.user?.email || item.user?.email || ''}
                                                            </div>
                                                        </td>
                                                    )}

                                                    {['payment'].includes(activeTab) && (
                                                        <td className="px-4 py-3">
                                                            <div className="font-semibold text-xs" style={{ color: C.navy }}>
                                                                {tlp('orderLabel')}{' '}
                                                                {item.requestId ? displayOrderCode(item.request?.orderCode, item.requestId) : '—'}
                                                            </div>
                                                            <div className="mt-1 flex flex-col gap-0.5">
                                                                <div className="text-[11px] flex items-center gap-1" style={{ color: C.gray }}>
                                                                    <span className="font-semibold" style={{ color: C.navy, minWidth: 20 }}>{tlp('customerShort')}</span>
                                                                    <span>{item.request?.user?.fullName ?? t('admin.requests.guestWalkIn')}</span>
                                                                </div>
                                                                <div className="text-[11px] flex items-center gap-1" style={{ color: C.gray }}>
                                                                    <span className="font-semibold" style={{ color: C.navy, minWidth: 20 }}>{tlp('providerShort')}</span>
                                                                    <span>{item.request?.assignedProvider?.fullName ?? '—'}</span>
                                                                </div>
                                                            </div>
                                                            {item.paymentMethod && (
                                                                <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide" style={{ background: '#f1f5f9', color: C.navy }}>
                                                                    {tlp('paymentMethodJobLine', {
                                                                        method:
                                                                            item.paymentMethod === 'CASH'
                                                                                ? t('admin.requests.paymentCash')
                                                                                : item.paymentMethod === 'QR'
                                                                                  ? t('admin.requests.paymentQr')
                                                                                  : t('admin.requests.paymentWallet'),
                                                                    })}
                                                                </span>
                                                            )}
                                                            {item.disputeCase && (
                                                                <button
                                                                    onClick={() => router.push(`/admin/disputes/${item.disputeCase.id}`)}
                                                                    className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold hover:opacity-80 transition-opacity"
                                                                    style={{ background: '#fef2f2', color: C.red }}
                                                                >
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                                                                    {tlp('disputeLink')}
                                                                    {item.disputeCase.status === 'RESOLVED' && tlp('disputeSuffixResolved')}
                                                                    {item.disputeCase.status === 'REJECTED' && tlp('disputeSuffixRejected')}
                                                                    {['WAITING_FOR_PROVIDER', 'WAITING_FOR_CUSTOMER', 'INVESTIGATING'].includes(item.disputeCase.status) && tlp('disputeSuffixPending')}
                                                                    <ExternalLink className="w-2.5 h-2.5" />
                                                                </button>
                                                            )}
                                                        </td>
                                                    )}

                                                    {['jobPayment'].includes(activeTab) && (
                                                        <td className="px-4 py-3">
                                                            <div className="text-xs font-semibold" style={{ color: C.navy }}>
                                                                {tlp('orderLabel')}{' '}
                                                                <span className="font-mono">{item.requestId ? displayOrderCode(item.request?.orderCode, item.requestId) : '—'}</span>
                                                            </div>
                                                            {item.txnCode && (
                                                                <div className="text-[10px] mt-1" style={{ color: C.gray }}>{tlp('labelTxnCode')} {item.txnCode}</div>
                                                            )}
                                                            {item.transferCode && (
                                                                <div className="text-xs mt-1" style={{ color: C.gray }}>
                                                                    {tlp('labelRef')} {item.transferCode}
                                                                </div>
                                                            )}
                                                        </td>
                                                    )}

                                                    <td className="px-4 py-3 font-bold text-sm" style={{ color: C.navy }}>
                                                        {formatCurrency(item.amount || item.totalAmount || 0)}
                                                    </td>

                                                    {['payment'].includes(activeTab) && (
                                                        <td className="px-4 py-3">
                                                            {item.commissionAmount != null ? (
                                                                <>
                                                                    <div className="font-semibold text-sm" style={{ color: '#a21caf' }}>
                                                                        {formatCurrency(item.commissionAmount)}
                                                                    </div>
                                                                    <div className="text-[10px]" style={{ color: C.gray }}>
                                                                        {item.commissionRate != null
                                                                            ? tlp('commissionRateLabel', {
                                                                                  rate: (item.commissionRate * 100).toFixed(0),
                                                                              })
                                                                            : ''}
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <span className="text-xs italic" style={{ color: C.gray }}>{tlp('commissionNotCollected')}</span>
                                                            )}
                                                        </td>
                                                    )}

                                                    {['withdrawals'].includes(activeTab) && (
                                                        <td className="px-4 py-3 text-center">
                                                            {(item.wallet?.providerId || item.wallet?.userId || item.user?.id) ? (
                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        let r = 'user';
                                                                        let uid = item.user?.id;
                                                                        if (item.wallet?.providerId) { r = 'provider'; uid = item.wallet.providerId; }
                                                                        else if (item.wallet?.userId) { r = 'user'; uid = item.wallet.userId; }
                                                                        else if (item.userType === 'PROVIDER') { r = 'provider'; }
                                                                        
                                                                        if (uid) router.push(`/admin/transactions/${r}/${uid}`);
                                                                    }}
                                                                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-[10px] font-medium transition-colors border border-blue-100"
                                                                    title={tlp('openWalletHistoryTitle')}
                                                                >
                                                                    <ExternalLink className="w-3 h-3" /> {tlp('openWalletHistory')}
                                                                </button>
                                                            ) : (
                                                                <span className="text-xs text-gray-400 italic">---</span>
                                                            )}
                                                        </td>
                                                    )}
                                                    <td className="px-4 py-3">{renderStatusBadge(item.status || item.paymentStatus)}</td>

{['payment'].includes(activeTab) && (
                                                        <td className="px-4 py-3">
                                                            {item.paymentMethod === 'CASH' && (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100" style={{ color: C.navy }}>{t('admin.requests.paymentCash')}</span>
                                                            )}
                                                            {item.paymentMethod === 'QR' && (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">{t('admin.requests.paymentQr')}</span>
                                                            )}
                                                            {item.paymentMethod === 'WALLET' && (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-50" style={{ color: C.orange }}>{t('admin.requests.paymentWallet')}</span>
                                                            )}
                                                            {!item.paymentMethod && <span style={{ color: C.gray }}>—</span>}
                                                        </td>
                                                    )}

                                                    <td className="px-4 py-3 whitespace-nowrap text-sm" style={{ color: C.gray }}>
                                                        {new Date(item.createdAt).toLocaleString(loc)}
                                                    </td>
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
                                {isWalletTab
                                    ? tlp('paginationWallets', {
                                          from: data.length === 0 ? 0 : (page - 1) * LIMIT + 1,
                                          to: Math.min(page * LIMIT, total),
                                          total,
                                      })
                                    : tlp('paginationTransactions', {
                                          from: data.length === 0 ? 0 : (page - 1) * LIMIT + 1,
                                          to: Math.min(page * LIMIT, total),
                                          total,
                                      })}
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
