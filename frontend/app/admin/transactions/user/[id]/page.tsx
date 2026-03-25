'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminLayout from '@/components/AdminLayout';
import { useAdminGuard } from '@/lib/guards';
import { useLanguage } from '@/contexts/LanguageContext';
import { adminApi } from '@/lib/api';
import {
    ChevronLeft,
    Clock,
    Search,
    Filter,
    Wallet,
    TrendingUp,
    ChevronRight,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const C = {
    orange: '#f97316',
    orangeDark: '#ea6c0a',
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
};

export default function UserWalletDetailPage() {
    const { isReady } = useAdminGuard();
    const router = useRouter();
    const params = useParams();
    const { t } = useLanguage();
    const tp = (key: string) => t(`admin.transactions.${key}`);
    
    const [wallet, setWallet] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'transactions' | 'topups'>('transactions');
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState('ALL');
    const [type, setType] = useState('ALL');
    const [referenceType, setReferenceType] = useState('ALL');
    const [loading, setLoading] = useState(true);
    
    const LIMIT = 20;

    const fetchWallet = useCallback(async () => {
        try {
            const res = await adminApi.getUserWallet(params.id as string);
            setWallet(res);
        } catch (error) {
            console.error('Failed to fetch wallet info', error);
            toast.error(t('admin.transactions.empty'));
        }
    }, [params.id, t]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const query: any = {
                userId: params.id,
                skip: (page - 1) * LIMIT,
                take: LIMIT,
            };
            if (status !== 'ALL') query.status = status;
            
            if (activeTab === 'transactions') {
                if (type !== 'ALL') query.type = type;
                if (referenceType !== 'ALL') query.referenceType = referenceType;
                const res = await adminApi.getWalletTransactions({ ...query, userType: 'USER' });
                setData(res.items || []);
                setTotal(res.total || 0);
            } else {
                const res = await adminApi.getTopupTransactions({ ...query, userType: 'USER' });
                setData(res.items || []);
                setTotal(res.total || 0);
            }
        } catch (error) {
            console.error('Failed to fetch transactions', error);
            toast.error(t('admin.transactions.empty'));
        } finally {
            setLoading(false);
        }
    }, [params.id, activeTab, page, status, type, referenceType, t]);

    useEffect(() => {
        if (isReady && params.id) {
            fetchWallet();
        }
    }, [isReady, params.id, fetchWallet]);

    useEffect(() => {
        if (isReady && params.id) {
            fetchData();
        }
    }, [isReady, params.id, fetchData]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN').format(amount) + '₫';
    };

    const renderStatusBadge = (statusStr: string) => {
        let bg, color, dot, label;
        switch (statusStr) {
            case 'COMPLETED':
                bg = C.greenLight; color = C.green; dot = C.green; label = tp('status.COMPLETED'); break;
            case 'PENDING':
                bg = C.yellowLight; color = C.yellow; dot = '#facc15'; label = tp('status.PENDING'); break;
            case 'FAILED':
                bg = C.redLight; color = C.red; dot = C.red; label = tp('status.FAILED'); break;
            case 'EXPIRED':
            case 'CANCELLED':
                bg = '#f8fafc'; color = C.gray; dot = C.gray; label = tp('status.cancelledGroup'); break;
            default:
                bg = '#f8fafc'; color = C.gray; dot = C.gray; label = statusStr; break;
        }
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: bg, color }}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dot }} />
                {label}
            </span>
        );
    };

    const renderTypeBadge = (typeStr: string) => {
        return typeStr === 'CREDIT' ? (
            <span className="font-semibold" style={{ color: C.green }}>+{tp('types.CREDIT')}</span>
        ) : (
            <span className="font-semibold" style={{ color: C.red }}>-{tp('types.DEBIT')}</span>
        );
    };

    const totalPages = Math.ceil(total / LIMIT) || 1;

    if (!isReady || !wallet) {
        return (
            <AdminLayout activeTab="/admin/transactions">
                <div className="min-h-screen flex items-center justify-center border-[3px]" style={{ background: C.bg }}>
                    <div className="w-10 h-10 rounded-full border-[3px] border-t-transparent animate-spin" style={{ borderColor: C.orange, borderTopColor: 'transparent' }} />
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout activeTab="/admin/transactions">
            <div className="p-6 min-h-screen" style={{ background: C.bg }}>
                {/* Header elements */}
                <div className="mb-6 flex items-center gap-4">
                    <button 
                        onClick={() => router.back()}
                        className="p-2 rounded-xl bg-white border shadow-sm hover:bg-gray-50 transition-colors"
                        style={{ borderColor: C.border, color: C.navy }}
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold mb-1" style={{ color: C.navy }}>Chi tiết Ví Khách Hàng</h1>
                        <p className="text-sm" style={{ color: C.gray }}>{wallet.user?.fullName || 'Khách hàng'}</p>
                    </div>
                </div>

                {/* User Card */}
                <div className="bg-white rounded-2xl border p-6 mb-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between" style={{ borderColor: C.border }}>
                    <div className="flex items-center gap-4">
                        <img 
                            src={wallet.user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(wallet.user?.fullName || 'U')}&background=2563eb&color=fff`} 
                            alt="Avatar" 
                            className="w-16 h-16 rounded-full object-cover border-2" 
                            style={{ borderColor: C.border }}
                        />
                        <div>
                            <h2 className="text-xl font-bold" style={{ color: C.navy }}>{wallet.user?.fullName}</h2>
                            <p className="text-sm font-medium mt-0.5" style={{ color: C.gray }}>{wallet.user?.email}</p>
                            <p className="text-xs mt-0.5" style={{ color: C.gray }}>{wallet.user?.phoneNumber || 'Không có SĐT'}</p>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                        <div className="bg-gray-50 rounded-xl p-4 border min-w-[160px]" style={{ borderColor: C.border }}>
                            <p className="text-xs uppercase font-semibold tracking-wider mb-1" style={{ color: C.gray }}>Khả dụng</p>
                            <p className="text-2xl font-bold" style={{ color: C.navy }}>{formatCurrency(wallet.availableBalance)}</p>
                        </div>
                        <div className="bg-orange-50 rounded-xl p-4 border min-w-[160px]" style={{ borderColor: C.border }}>
                            <p className="text-xs uppercase font-semibold tracking-wider mb-1" style={{ color: C.orangeDark }}>Đóng băng</p>
                            <p className="text-2xl font-bold" style={{ color: C.orange }}>{formatCurrency(wallet.pendingBalance)}</p>
                        </div>
                    </div>
                </div>

                {/* Sub Transactions UI */}
                <div className="bg-white rounded-2xl border" style={{ borderColor: C.border }}>
                    <div className="flex items-center px-5 border-b" style={{ borderColor: C.border }}>
                        <button
                            onClick={() => { setActiveTab('transactions'); setPage(1); }}
                            className="px-4 py-4 text-sm font-medium transition-colors border-b-2"
                            style={{ 
                                color: activeTab === 'transactions' ? C.orange : C.gray,
                                borderColor: activeTab === 'transactions' ? C.orange : 'transparent',
                                marginBottom: '-1px'
                            }}
                        >
                            <Wallet className="w-4 h-4 inline-block mr-1.5" />
                            Giao dịch ví
                        </button>
                        <button
                            onClick={() => { setActiveTab('topups'); setPage(1); }}
                            className="px-4 py-4 text-sm font-medium transition-colors border-b-2"
                            style={{ 
                                color: activeTab === 'topups' ? C.orange : C.gray,
                                borderColor: activeTab === 'topups' ? C.orange : 'transparent',
                                marginBottom: '-1px'
                            }}
                        >
                            <TrendingUp className="w-4 h-4 inline-block mr-1.5" />
                            Lịch sử nạp tiền
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 p-4 border-b" style={{ borderColor: C.border }}>
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm cursor-pointer" style={{ borderColor: C.border }}>
                            <Filter className="w-3.5 h-3.5" style={{ color: C.gray }} />
                            <select
                                value={status}
                                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                                className="bg-transparent text-sm focus:outline-none cursor-pointer pr-1"
                                style={{ color: C.navy }}
                            >
                                <option value="ALL">{tp('filters.all')} TT</option>
                                <option value="COMPLETED">{tp('status.COMPLETED')}</option>
                                <option value="PENDING">{tp('status.PENDING')}</option>
                                <option value="FAILED">{tp('status.FAILED')}</option>
                            </select>
                        </div>

                        {activeTab === 'transactions' && (
                            <>
                                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm cursor-pointer" style={{ borderColor: C.border }}>
                                    <Filter className="w-3.5 h-3.5" style={{ color: C.gray }} />
                                    <select
                                        value={type}
                                        onChange={(e) => { setType(e.target.value); setPage(1); }}
                                        className="bg-transparent text-sm focus:outline-none cursor-pointer pr-1"
                                        style={{ color: C.navy }}
                                    >
                                        <option value="ALL">{tp('filters.all')} Loại</option>
                                        <option value="CREDIT">{tp('types.CREDIT')}</option>
                                        <option value="DEBIT">{tp('types.DEBIT')}</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm cursor-pointer" style={{ borderColor: C.border }}>
                                    <Filter className="w-3.5 h-3.5" style={{ color: C.gray }} />
                                    <select
                                        value={referenceType}
                                        onChange={(e) => { setReferenceType(e.target.value); setPage(1); }}
                                        className="bg-transparent text-sm focus:outline-none cursor-pointer pr-1"
                                        style={{ color: C.navy }}
                                    >
                                        <option value="ALL">{tp('filters.all')} Ref</option>
                                        <option value="TOPUP">TOPUP</option>
                                        <option value="WITHDRAW">WITHDRAW</option>
                                        <option value="JOB_PAYMENT">JOB_PAYMENT</option>
                                        <option value="COMMISSION">COMMISSION</option>
                                        <option value="REFUND">REFUND</option>
                                    </select>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead style={{ background: C.bg }}>
                                <tr>
                                    <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3 uppercase" style={{ color: C.gray }}>ID</th>
                                    {activeTab === 'transactions' && (
                                        <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3 uppercase" style={{ color: C.gray }}>Change</th>
                                    )}
                                    {activeTab === 'transactions' && (
                                        <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3 uppercase" style={{ color: C.gray }}>Ref</th>
                                    )}
                                    <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3 uppercase" style={{ color: C.gray }}>{tp('columns.amount')}</th>
                                    <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3 uppercase" style={{ color: C.gray }}>Status</th>
                                    <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3 uppercase" style={{ color: C.gray }}>Created At</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-12">
                                            <div className="w-8 h-8 mx-auto rounded-full border-[3px] border-t-transparent animate-spin" style={{ borderColor: C.orange, borderTopColor: 'transparent' }} />
                                        </td>
                                    </tr>
                                ) : data.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-12 text-sm text-gray-500">Chưa có giao dịch nào</td>
                                    </tr>
                                ) : (
                                    data.map((item) => (
                                        <tr key={item.id} className="border-t hover:bg-gray-50 transition-colors" style={{ borderColor: C.border }}>
                                            <td className="px-4 py-3 font-mono text-xs" style={{ color: C.navy }}>{item.id.slice(-8).toUpperCase()}</td>
                                            {activeTab === 'transactions' && (
                                                <td className="px-4 py-3 text-sm">{renderTypeBadge(item.type)}</td>
                                            )}
                                            {activeTab === 'transactions' && (
                                                <td className="px-4 py-3 font-semibold text-sm" style={{ color: C.navy }}>
                                                    {tp(`references.${item.referenceType}`) !== `admin.transactions.references.${item.referenceType}` 
                                                        ? tp(`references.${item.referenceType}`) 
                                                        : item.referenceType}
                                                </td>
                                            )}
                                            <td className="px-4 py-3 font-bold text-sm" style={{ color: C.navy }}>
                                                {formatCurrency(item.amount)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {renderStatusBadge(item.status)}
                                            </td>
                                            <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: C.gray }}>
                                                {new Date(item.createdAt).toLocaleString('vi-VN')}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {!loading && total > 0 && (
                        <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: C.border }}>
                            <p className="text-xs" style={{ color: C.gray }}>
                                Showing {(page - 1) * LIMIT + 1} to {Math.min(page * LIMIT, total)} of {total} items
                            </p>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40"
                                >
                                    <ChevronLeft className="w-4 h-4 text-gray-500" />
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
                                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40"
                                >
                                    <ChevronRight className="w-4 h-4 text-gray-500" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
