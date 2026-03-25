'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminGuard } from '@/lib/guards';
import { adminApi } from '@/lib/api';
import AdminLayout from '@/components/AdminLayout';
import { Search, Filter, Calendar, Clock, CheckCircle, AlertTriangle, FileText, ChevronRight, ChevronLeft, XCircle, Eye, Copy, QrCode, ExternalLink } from 'lucide-react';
import { toast } from 'react-hot-toast';
import bankCodeData from '../../../public/bankcode.json';

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

const PAGE_SIZE = 10;

function StatusBadge({ status }: { status: string }) {
    const configs: Record<string, { bg: string; color: string; dot: string; label: string }> = {
        PENDING: { bg: C.yellowLight, color: C.yellow, dot: '#facc15', label: 'Chờ xử lý' },
        COMPLETED: { bg: C.greenLight, color: C.green, dot: C.green, label: 'Thành công' },
        FAILED: { bg: C.redLight, color: C.red, dot: C.red, label: 'Từ chối' },
    };
    const st = configs[status] || { bg: '#f8fafc', color: C.gray, dot: C.gray, label: status };

    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: st.bg, color: st.color }}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: st.dot }} />
            {st.label}
        </span>
    );
}

function parseBankInfo(description: string) {
    const bankCodeMatch = description?.match(/\[BANK_CODE:([^\]]+)\]/);
    const bankNameMatch = description?.match(/Ngân hàng:\s*([^·]+)/);
    const accNumberMatch = description?.match(/Số TK:\s*([^·]+)/);
    const accHolderMatch = description?.match(/Chủ TK:\s*([^·]+)/);

    return {
        bankCode: bankCodeMatch ? bankCodeMatch[1].trim() : '',
        bankName: bankNameMatch ? bankNameMatch[1].trim() : '',
        accountNumber: accNumberMatch ? accNumberMatch[1].trim() : '',
        accountHolderName: accHolderMatch ? accHolderMatch[1].trim() : '',
    };
}

function parseSepayInfo(description: string) {
    if (!description) return null;
    const match = description.match(/SePay:\s*(\d+)(?:\s*\(([^)]+)\))?/);
    if (match) {
        return {
            id: match[1],
            ref: match[2] || null
        };
    }
    return null;
}

// Function to remove accents manually for generic string cleaning
function removeAccents(str: string) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export default function AdminWithdrawalsPage() {
    const router = useRouter();
    const { isReady } = useAdminGuard();
    
    const [tab, setTab] = useState<string>('ALL');
    
    // Advanced Search States
    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [sortOrder, setSortOrder] = useState('desc');

    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ pending: 0, completed: 0, failed: 0, total: 0 });
    const [page, setPage] = useState(1);
    
    // View Modal State
    const [viewData, setViewData] = useState<any>(null);
    const [isConfirmingReject, setIsConfirmingReject] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [processing, setProcessing] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            let apiStatus = undefined;
            let apiUserType = undefined;
            if (['PENDING', 'COMPLETED', 'FAILED'].includes(tab)) apiStatus = tab;
            if (tab === 'PROVIDER') apiUserType = 'PROVIDER';
            if (tab === 'CUSTOMER') apiUserType = 'USER';

            const res = await adminApi.getWithdrawals({
                status: apiStatus,
                userType: apiUserType,
                skip: 0,
                take: 1000, 
            });
            const statsData = await adminApi.getWithdrawalStats();
            
            setItems(res.items || []);
            setStats({
                pending: (statsData.provider?.pending || 0) + (statsData.user?.pending || 0),
                completed: (statsData.provider?.completed || 0) + (statsData.user?.completed || 0),
                failed: (statsData.provider?.failed || 0) + (statsData.user?.failed || 0),
                total: (statsData.provider?.total || 0) + (statsData.user?.total || 0),
            });
            setPage(1);
        } catch (e) {
            console.error(e);
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [tab]);

    useEffect(() => {
        if (isReady) load();
    }, [isReady, load]);

    // Polling for viewData if PENDING
    useEffect(() => {
        if (!viewData || viewData.status !== 'PENDING') return;

        const interval = setInterval(async () => {
            try {
                // Fetch the specific item by ID
                const res = await adminApi.getWithdrawals({
                    status: 'ALL',
                    userType: viewData.userType,
                    search: viewData.id,
                });
                const updated = res.items?.find((i: any) => i.id === viewData.id);
                
                // If the webhook changed it to COMPLETED
                if (updated && updated.status !== 'PENDING') {
                    setViewData(updated);
                    toast.success('Giao dịch đã được tự động duyệt từ Webhook!');
                    load(); // Refresh the background table silently
                }
            } catch (e) {
                // ignore
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [viewData, load]);

    const handleApprove = async () => {
        if (!viewData) return;
        if (!confirm('Xác nhận đã chuyển khoản thành công và duyệt yêu cầu này?')) return;
        setProcessing(true);
        try {
            await adminApi.approveWithdrawal(viewData.id, viewData.userType);
            toast.success('Duyệt thành công');
            setViewData(null);
            setIsConfirmingReject(false);
            setRejectReason('');
            load();
        } catch (e: any) {
            toast.error('Có lỗi xảy ra khi duyệt: ' + e?.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!viewData) return;
        if (!rejectReason.trim()) return toast.error('Vui lòng nhập lý do từ chối');
        setProcessing(true);
        try {
            await adminApi.rejectWithdrawal(viewData.id, viewData.userType, rejectReason);
            toast.success('Đã từ chối và hoàn tiền');
            setViewData(null);
            setIsConfirmingReject(false);
            setRejectReason('');
            load();
        } catch (e: any) {
            toast.error('Có lỗi xảy ra: ' + e?.message);
        } finally {
            setProcessing(false);
        }
    };

    const tabs = [
        { key: 'ALL', label: 'Tất cả' },
        { key: 'PENDING', label: 'Chờ duyệt' },
        { key: 'COMPLETED', label: 'Thành công' },
        { key: 'FAILED', label: 'Từ chối' },
        { key: 'PROVIDER', label: 'Đối tác' },
        { key: 'CUSTOMER', label: 'Khách hàng' },
    ];

    const filtered = items.filter(d => {
        const q = search.toLowerCase();
        let match = true;
        if (q) {
            match = (
                d.txnCode?.toLowerCase().includes(q) ||
                d.id.toLowerCase().includes(q) ||
                d.user?.fullName?.toLowerCase().includes(q) ||
                d.user?.email?.toLowerCase().includes(q)
            );
        }
        if (!match) return false;

        if (dateFrom) {
            if (new Date(d.createdAt) < new Date(dateFrom)) return false;
        }
        if (dateTo) {
            const end = new Date(dateTo);
            end.setHours(23, 59, 59, 999);
            if (new Date(d.createdAt) > end) return false;
        }
        return true;
    }).sort((a, b) => {
        const tA = new Date(a.createdAt).getTime();
        const tB = new Date(b.createdAt).getTime();
        return sortOrder === 'desc' ? tB - tA : tA - tB;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return (
        <AdminLayout activeTab="/admin/withdrawals">
            <div className="p-6 min-h-screen" style={{ background: C.bg }}>
                {/* Page Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold mb-1" style={{ color: C.navy }}>
                            Quản lý Yêu cầu Rút tiền
                        </h1>
                        <p className="text-sm" style={{ color: C.gray }}>
                            Duyệt và kiểm tra các yêu cầu rút tiền từ ví của Đối tác hoặc Khách hàng
                        </p>
                    </div>
                </div>

                {/* ─── Stats Cards ─── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {[
                        { label: 'CHỜ DUYỆT', value: stats.pending, color: C.yellow, icon: <Clock className="w-4 h-4" /> },
                        { label: 'THÀNH CÔNG', value: stats.completed, color: C.green, icon: <CheckCircle className="w-4 h-4" /> },
                        { label: 'TỪ CHỐI', value: stats.failed, color: C.red, icon: <XCircle className="w-4 h-4" /> },
                        { label: 'TỔNG CỘNG', value: stats.total, color: C.navy, icon: <FileText className="w-4 h-4" /> },
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
                    <div className="flex items-center overflow-x-auto hide-scrollbar px-2 sm:px-4 border-b bg-gray-50/30 rounded-t-2xl" style={{ borderColor: C.border }}>
                        {tabs.map(({ key, label }) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setTab(key)}
                                className="px-5 py-4 text-sm font-semibold relative transition-colors whitespace-nowrap"
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
                    <div className="p-4 border-b flex flex-col gap-3" style={{ borderColor: C.border }}>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex-1 min-w-[200px] relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.gray }} />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                                    placeholder="Tìm theo Mã GD, tên hoặc email..."
                                    className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium transition-all"
                                    style={{ borderColor: C.border, color: C.navy }}
                                />
                            </div>
                            
                            <div className="flex items-center gap-2 bg-gray-50/50 p-1 rounded-xl border" style={{ borderColor: C.border }}>
                                <input 
                                    type="date" 
                                    value={dateFrom} 
                                    onChange={e => { setDateFrom(e.target.value); setPage(1); }} 
                                    className="text-sm bg-transparent px-2 py-1 outline-none font-medium cursor-pointer" 
                                    style={{ color: C.gray }}
                                    title="Từ ngày"
                                />
                                <span className="text-gray-400 text-sm font-bold opacity-50">-</span>
                                <input 
                                    type="date" 
                                    value={dateTo} 
                                    onChange={e => { setDateTo(e.target.value); setPage(1); }} 
                                    className="text-sm bg-transparent px-2 py-1 outline-none font-medium cursor-pointer" 
                                    style={{ color: C.gray }}
                                    title="Đến ngày"
                                />
                            </div>
                            
                            <select 
                                value={sortOrder}
                                onChange={e => { setSortOrder(e.target.value); setPage(1); }}
                                className="text-sm border rounded-xl px-4 py-2 outline-none bg-white font-medium focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
                                style={{ borderColor: C.border, color: C.gray }}
                            >
                                <option value="desc">Mới nhất trước</option>
                                <option value="asc">Cũ nhất trước</option>
                            </select>
                        </div>
                    </div>

                    {/* Data Table */}
                    {loading ? (
                        <div className="p-12 text-center" style={{ color: C.gray }}>
                            <div className="w-8 h-8 rounded-full border-[3px] border-t-transparent animate-spin mx-auto" style={{ borderColor: C.orange, borderTopColor: 'transparent' }} />
                        </div>
                    ) : paginated.length === 0 ? (
                        <div className="p-12 text-center flex flex-col items-center gap-2">
                            <FileText className="w-10 h-10" style={{ color: C.border }} />
                            <span style={{ color: C.gray }}>Không tìm thấy yêu cầu rút tiền nào phù hợp.</span>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead style={{ background: C.bg }}>
                                    <tr>
                                        <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3" style={{ color: C.gray }}>MÃ GIAO DỊCH</th>
                                        <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3" style={{ color: C.gray }}>THÔNG TIN NGƯỜI DÙNG</th>
                                        <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3" style={{ color: C.gray }}>SỐ TIỀN & THỜI GIAN</th>
                                        <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3" style={{ color: C.gray }}>NGÂN HÀNG</th>
                                        <th className="text-left text-[10px] font-semibold tracking-wider px-4 py-3" style={{ color: C.gray }}>MÃ ĐỐI SOÁT (SEPAY)</th>
                                        <th className="text-center text-[10px] font-semibold tracking-wider px-4 py-3" style={{ color: C.gray }}>ĐỐI SOÁT VÍ</th>
                                        <th className="text-center text-[10px] font-semibold tracking-wider px-4 py-3" style={{ color: C.gray }}>TRẠNG THÁI</th>
                                        <th className="text-center text-[10px] font-semibold tracking-wider px-4 py-3" style={{ color: C.gray }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginated.map((row) => {
                                        const bInfo = parseBankInfo(row.description || '');
                                        const displayAccount =
                                            (row as any).resolvedAccountNumber ||
                                            bInfo.accountNumber ||
                                            '---';
                                        return (
                                            <tr key={row.id} className="border-t hover:bg-slate-50/80 transition-colors" style={{ borderColor: C.border }}>
                                                <td className="px-4 py-4 font-mono text-xs font-semibold" style={{ color: C.navy }}>
                                                    {row.txnCode || '---'}
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="font-semibold" style={{ color: C.navy }}>{row.user?.fullName || 'Ẩn danh'}</div>
                                                    <div className="text-xs mt-0.5" style={{ color: C.gray }}>{row.user?.email}</div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="font-bold text-sm text-green-600 mb-1">
                                                        {(row.amount).toLocaleString('vi-VN')} ₫
                                                    </div>
                                                    <div className="text-[10px] text-gray-500 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {new Date(row.createdAt).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="text-xs font-medium" style={{ color: C.navy }}>{bInfo.bankName || 'Không có NH'}</div>
                                                    <div className="text-[10px] font-mono text-gray-500 mt-0.5">TK: {displayAccount}</div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    {(() => {
                                                        const sepay = parseSepayInfo(row.description || '');
                                                        return sepay ? (
                                                            <div>
                                                                <div className="text-xs font-mono font-semibold" style={{ color: C.green }}>{sepay.ref || '(Chưa có Ref)'}</div>
                                                                <div className="text-[10px] text-gray-500 mt-0.5">ID: {sepay.id}</div>
                                                            </div>
                                                        ) : (
                                                            <div className="text-xs text-gray-400 italic">---</div>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    {row.userType && row.user?.id ? (
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const role = row.userType === 'PROVIDER' ? 'provider' : 'user';
                                                                router.push(`/admin/transactions/${role}/${row.user.id}`);
                                                            }}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-medium transition-colors border border-blue-100"
                                                            title="Kiểm tra dòng tiền trong ví"
                                                        >
                                                            <ExternalLink className="w-3.5 h-3.5" /> Lịch sử Ví
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs text-gray-400 italic">---</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <StatusBadge status={row.status} />
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <button 
                                                        onClick={() => { setViewData(row); setIsConfirmingReject(false); setRejectReason(''); }}
                                                        className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                                                        style={{ color: C.blue }}
                                                        title="Xem chi tiết & Xử lý"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {!loading && filtered.length > 0 && (
                        <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: C.border }}>
                            <p className="text-xs" style={{ color: C.gray }}>
                                Hiển thị {(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, filtered.length)} trên {filtered.length}
                            </p>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40"
                                ><ChevronLeft className="w-4 h-4" /></button>
                                <span className="px-2 py-1.5 text-xs font-semibold">{page} / {totalPages}</span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40"
                                ><ChevronRight className="w-4 h-4" /></button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Centered View Modal */}
            {viewData && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm transition-opacity">
                    <div className="w-full max-w-[720px] bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5 pb-4 border-b border-gray-100/60">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Xử lý Yêu cầu rút tiền</h3>
                                <p className="text-xs text-mono text-gray-500 mt-1">{viewData.txnCode}</p>
                            </div>
                            <button 
                                onClick={() => { setViewData(null); setIsConfirmingReject(false); setRejectReason(''); }}
                                className="p-2 -mr-2 text-gray-400 hover:bg-gray-100 rounded-full"
                            >
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content Scrollable */}
                        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
                            <div className="flex flex-col md:flex-row gap-6 md:gap-8">
                                
                                {/* ──── LEFT COLUMN ──── */}
                                <div className="flex-1 space-y-6">
                                    
                                    {/* Summary Box */}
                                    <div className="bg-slate-50 p-5 rounded-2xl">
                                        <div className="text-sm text-gray-500 mb-1">Số tiền yêu cầu</div>
                                        <div className="text-3xl font-bold text-green-600 mb-4">
                                            {(viewData.amount).toLocaleString('vi-VN')} ₫
                                        </div>
                                        <div className="flex justify-between items-center text-sm border-t border-gray-200/50 pt-4">
                                            <span className="text-gray-500">Trạng thái</span>
                                            <StatusBadge status={viewData.status} />
                                        </div>
                                    </div>

                                    {/* Wallet Info */}
                                    <div>
                                        <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5 px-1">Thông tin Số dư Ví</h4>
                                        <div className="bg-slate-50 rounded-2xl divide-y divide-gray-100/60 text-sm overflow-hidden">
                                            <div className="flex justify-between px-5 py-3.5">
                                                <span className="text-gray-500">Số dư khả dụng hiện tại</span>
                                                <span className="font-semibold">{(viewData.wallet?.availableBalance || 0).toLocaleString()} ₫</span>
                                            </div>
                                            {viewData.status === 'PENDING' && (
                                                <div className="flex justify-between px-5 py-3.5 bg-blue-50/50">
                                                    <span className="text-gray-500">Dự tính sau khi duyệt</span>
                                                    <span className="font-semibold text-blue-600">
                                                        {((viewData.wallet?.availableBalance || 0) - viewData.amount).toLocaleString()} ₫
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bank Text Info (Only if Pending) */}
                                    {viewData.status === 'PENDING' && (() => {
                                        const bInfo = parseBankInfo(viewData.description);
                                        const memo = viewData.txnCode || 'RUTTIEN';
                                        
                                        return (
                                            <div>
                                                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5 px-1">Thông tin chuyển khoản</h4>
                                                <div className="w-full space-y-3 text-sm bg-white p-4 rounded-2xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] ring-1 ring-black/5">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-gray-500">Ngân hàng</span>
                                                        <span className="font-semibold text-right max-w-[150px] truncate" title={bInfo.bankName}>{bInfo.bankName || '---'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-gray-500">Số tài khoản</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold font-mono text-base tracking-wide">{bInfo.accountNumber || '---'}</span>
                                                            <button 
                                                                onClick={async () => { await navigator.clipboard.writeText(bInfo.accountNumber); toast.success('Đã copy!'); }}
                                                                className="text-blue-500 hover:text-blue-700 bg-blue-50 p-1.5 rounded-md"
                                                            ><Copy className="w-3.5 h-3.5" /></button>
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-gray-500">Chủ tài khoản</span>
                                                        <span className="font-semibold">{bInfo.accountHolderName || '---'}</span>
                                                    </div>
                                                    <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-gray-100/60">
                                                        <span className="text-gray-500 text-[11px] uppercase tracking-wider">Nội dung (Tự động)</span>
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-bold text-sm font-mono text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md">{memo}</span>
                                                            <button 
                                                                onClick={async () => { await navigator.clipboard.writeText(memo); toast.success('Đã copy!'); }}
                                                                className="text-blue-500 hover:text-blue-700 bg-blue-50 p-1.5 rounded-md"
                                                            ><Copy className="w-3.5 h-3.5" /></button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Recent Transactions */}
                                    <div>
                                        <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5 px-1">Lịch sử rút tiền gần đây</h4>
                                        <div className="space-y-2">
                                            {items
                                                .filter(i => i.walletId === viewData.walletId && i.id !== viewData.id)
                                                .slice(0, 3)
                                                .map((tx: any) => (
                                                    <div key={tx.id} className="flex justify-between items-center p-3.5 bg-slate-50 rounded-2xl">
                                                        <div>
                                                            <div className="text-xs font-medium text-gray-900">{(tx.amount).toLocaleString()} ₫</div>
                                                            <div className="text-[10px] text-gray-500">{new Date(tx.createdAt).toLocaleDateString('vi-VN')}</div>
                                                        </div>
                                                        <StatusBadge status={tx.status} />
                                                    </div>
                                                ))}
                                            {items.filter(i => i.walletId === viewData.walletId && i.id !== viewData.id).length === 0 && (
                                                <div className="text-sm text-gray-400 text-center py-5 bg-slate-50 rounded-2xl border border-dashed border-gray-200">
                                                    Chưa có giao dịch rút tiền nào khác.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Rejection Input */}
                                    {viewData.status === 'PENDING' && isConfirmingReject && (
                                        <div className="mt-4 animate-in slide-in-from-top-2 duration-300">
                                             <h4 className="text-[11px] font-bold text-red-500 uppercase tracking-wider mb-2.5 px-1">Lý do từ chối</h4>
                                             <textarea
                                                value={rejectReason}
                                                onChange={e => setRejectReason(e.target.value)}
                                                placeholder="Bắt buộc: Ghi rõ lý do (VD: Sai STK)..."
                                                className="w-full text-sm rounded-2xl bg-red-50 border-0 ring-1 ring-red-200 p-4 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:bg-white resize-none min-h-[90px] transition-all"
                                                autoFocus
                                            />
                                        </div>
                                    )}

                                </div>

                                {/* ──── RIGHT COLUMN (VietQR) ──── */}
                                {viewData.status === 'PENDING' && (() => {
                                    const bInfo = parseBankInfo(viewData.description);
                                    const memo = viewData.txnCode || 'RUTTIEN';
                                    
                                    let resolvedBankCode = bInfo.bankCode;
                                    if (!resolvedBankCode && bInfo.bankName) {
                                        const bn = bInfo.bankName.toLowerCase();
                                        const matchedBank = bankCodeData.data.find((b: any) => 
                                            b.name.toLowerCase() === bn ||
                                            b.short_name.toLowerCase() === bn ||
                                            b.code.toLowerCase() === bn ||
                                            b.name.toLowerCase().includes(bn) ||
                                            bn.includes(b.short_name.toLowerCase())
                                        );
                                        if (matchedBank) {
                                            resolvedBankCode = matchedBank.bin || matchedBank.code;
                                        } else {
                                            resolvedBankCode = bInfo.bankName;
                                        }
                                    }
                                    
                                    const qrUrl = resolvedBankCode && bInfo.accountNumber 
                                        ? `https://qr.sepay.vn/img?acc=${bInfo.accountNumber}&bank=${encodeURIComponent(resolvedBankCode)}&amount=${viewData.amount}&des=${encodeURIComponent(memo)}` 
                                        : null;

                                    return (
                                        <div className="w-full md:w-[260px] flex-shrink-0 order-first md:order-last">
                                            <div className="sticky top-0">
                                                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5 px-1 hidden md:block">Mã VietQR</h4>
                                                <div className="rounded-3xl p-5 bg-slate-50 flex flex-col items-center">
                                                    {qrUrl ? (
                                                        <div className="bg-white p-3 rounded-2xl mb-4 shadow-sm ring-1 ring-black/5 w-full aspect-square flex items-center justify-center">
                                                            <img src={qrUrl} alt="VietQR" className="w-full h-full object-contain" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-full bg-yellow-50 text-yellow-800 text-[11px] p-3.5 rounded-xl mb-4 flex items-start gap-2 shadow-sm ring-1 ring-yellow-400/20">
                                                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                                            <span>Chưa có Bank Code để tạo QR tự động.</span>
                                                        </div>
                                                    )}
                                                    <p className="text-xs text-gray-500 text-center leading-relaxed">
                                                        Sử dụng ứng dụng ngân hàng để quét mã QR. Nội dung chuyển khoản sẽ được <strong>điền tự động</strong>.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                                
                            </div>
                        </div>

                        {/* Footer Actions */}
                        {viewData.status === 'PENDING' && (
                            <div className="p-5 sm:p-6 sm:pt-4 border-t border-gray-100/60 bg-white flex gap-3">
                                {!isConfirmingReject ? (
                                    <>
                                        <button
                                            onClick={() => setIsConfirmingReject(true)}
                                            disabled={processing}
                                            className="flex-1 px-4 py-3 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl disabled:opacity-50 transition-colors"
                                        >
                                            Từ chối
                                        </button>
                                        <button
                                            onClick={handleApprove}
                                            disabled={processing}
                                            className="flex-[2] px-4 py-3 text-sm font-semibold text-white bg-green-500 hover:bg-green-600 shadow-sm shadow-green-200 rounded-xl disabled:opacity-50 transition-all"
                                        >
                                            Đã CK Xong
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => { setIsConfirmingReject(false); setRejectReason(''); }}
                                            disabled={processing}
                                            className="flex-1 px-4 py-3 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl disabled:opacity-50 transition-colors"
                                        >
                                            Hủy
                                        </button>
                                        <button
                                            onClick={handleReject}
                                            disabled={processing || !rejectReason.trim()}
                                            className="flex-[2] px-4 py-3 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 shadow-sm shadow-red-200 rounded-xl disabled:opacity-50 transition-all"
                                        >
                                            Xác nhận Từ chối
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                        {viewData.status !== 'PENDING' && (() => {
                            const sepayInfo = parseSepayInfo(viewData.description);
                            return (
                                <div className="p-5 sm:p-6 sm:pt-4 border-t border-gray-100/60 bg-white flex flex-col items-center gap-3 text-sm text-gray-500">
                                    <div className="italic">Giao dịch này đã được xử lý.</div>
                                    
                                    {sepayInfo && (
                                        <div className="w-full text-xs font-mono font-medium text-green-700 bg-green-50 border border-green-200 px-4 py-3 rounded-xl flex flex-col gap-2 shadow-sm">
                                            <div className="flex items-center justify-center gap-2 pb-2 border-b border-green-200/50">
                                                <CheckCircle className="w-4 h-4" />
                                                <span className="tracking-wide">GIAO DỊCH TỰ ĐỘNG WEBHOOK</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-y-2 mt-1">
                                                <span className="text-green-600/80 uppercase tracking-wider text-[10px]">Mã GD Ngân hàng (Ref)</span>
                                                <span className="text-right font-bold text-sm tracking-wider">{sepayInfo.ref || '---'}</span>
                                                
                                                <span className="text-green-600/80 uppercase tracking-wider text-[10px]">ID Giao dịch SePay</span>
                                                <span className="text-right tracking-wider">{sepayInfo.id}</span>
                                                
                                                <span className="text-green-600/80 uppercase tracking-wider text-[10px]">Thời gian yêu cầu</span>
                                                <span className="text-right tracking-wider">
                                                    {new Date(viewData.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
