'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { useAdminGuard } from '@/lib/guards';
import { adminApi } from '@/lib/api';
import { toast } from 'react-hot-toast';
import {
    Percent, TrendingUp, DollarSign, Building2, Save,
    AlertTriangle, Loader2, X, ChevronLeft, ChevronRight,
    History, Edit3, CreditCard, CheckCircle,
} from 'lucide-react';

// ── Design tokens (same as Transactions / Users pages) ──────────────────────
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

// ── Helpers ─────────────────────────────────────────────────────────────────
function formatCurrency(amount: number) {
    return new Intl.NumberFormat('vi-VN').format(amount) + '₫';
}

function formatRate(rate: number) {
    return (rate * 100).toFixed(1) + '%';
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

type BillingConfig = {
    commissionRate: number;
    totalCommission: number;
    commissionThisMonth: number;
    sepayApiKey: string | null;
    sepayBankAccount: string | null;
    sepayBankCode: string | null;
};

type AuditEntry = {
    id: string;
    adminId: string;
    adminName: string;
    changeType: 'FEE_RATE' | 'BANK_ACCOUNT';
    oldValue: string | null;
    newValue: string;
    note: string | null;
    createdAt: string;
};

// ── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({
    title, description, confirmLabel, confirmColor,
    loading, onConfirm, onCancel,
}: {
    title: string;
    description: React.ReactNode;
    confirmLabel: string;
    confirmColor: string;
    loading: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
            <div className="relative bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl" style={{ border: `1px solid ${C.border}` }}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-base" style={{ color: C.navy }}>{title}</h3>
                    <button onClick={onCancel} className="p-1 rounded-lg hover:bg-gray-100" style={{ color: C.gray }}>
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="text-sm mb-5" style={{ color: C.gray }}>{description}</div>
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        disabled={loading}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
                        style={{ color: C.navy }}
                    >
                        Hủy
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50"
                        style={{ background: confirmColor }}
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Audit log helper: parse an entry into a human-readable sentence ──────────
function describeAuditEntry(entry: AuditEntry): { label: string; before: string | null; after: string } {
    if (entry.changeType === 'FEE_RATE') {
        const oldRate = entry.oldValue ? (parseFloat(entry.oldValue) * 100).toFixed(1) + '%' : '?';
        const newRate = (parseFloat(entry.newValue) * 100).toFixed(1) + '%';
        return { label: 'Thay đổi phí hoa hồng', before: oldRate, after: newRate };
    }
    // BANK_ACCOUNT: newValue is JSON with SePay fields {bankAccount, bankCode}
    try {
        const parsed = JSON.parse(entry.newValue);
        const after = `${parsed.bankCode ?? '?'} • ${parsed.bankAccount ?? '?'}`;
        let before: string | null = null;
        if (entry.oldValue) {
            const old = JSON.parse(entry.oldValue);
            if (old.bankAccount) {
                before = `${old.bankCode ?? '?'} • ${old.bankAccount}`;
            }
        }
        return { label: 'Cập nhật cấu hình SePay', before, after };
    } catch {
        return { label: 'Cập nhật cấu hình SePay', before: entry.oldValue, after: entry.newValue };
    }
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function AdminBillingPage() {
    const { isReady } = useAdminGuard();

    const [config, setConfig] = useState<BillingConfig | null>(null);
    const [loadingConfig, setLoadingConfig] = useState(true);

    // ── Fee edit state ──
    const [feeInput, setFeeInput] = useState('');
    const [feeNote, setFeeNote] = useState('');
    const [feeEditing, setFeeEditing] = useState(false);
    const [feeConfirm, setFeeConfirm] = useState(false);
    const [feeSaving, setFeeSaving] = useState(false);

    // ── Bank account edit state ──
    const [bankEditing, setBankEditing] = useState(false);
    const [bankForm, setBankForm] = useState({
        bankAccount: '', bankCode: '', apiKey: '', note: '',
    });
    const [bankConfirm, setBankConfirm] = useState(false);
    const [bankSaving, setBankSaving] = useState(false);

    // ── Audit log ──
    const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
    const [auditTotal, setAuditTotal] = useState(0);
    const [auditPage, setAuditPage] = useState(1);
    const [auditLoading, setAuditLoading] = useState(false);
    const AUDIT_LIMIT = 10;

    const fetchConfig = useCallback(async () => {
        setLoadingConfig(true);
        try {
            const data = await adminApi.getBillingConfig();
            setConfig(data);
            setFeeInput((data.commissionRate * 100).toFixed(1));
            setBankForm({
                bankAccount: data.sepayBankAccount ?? '',
                bankCode: data.sepayBankCode ?? '',
                apiKey: data.sepayApiKey ?? '',
                note: '',
            });
        } catch {
            toast.error('Không thể tải cấu hình billing.');
        } finally {
            setLoadingConfig(false);
        }
    }, []);

    const fetchAuditLog = useCallback(async () => {
        setAuditLoading(true);
        try {
            const res = await adminApi.getBillingAuditLog({
                skip: (auditPage - 1) * AUDIT_LIMIT,
                take: AUDIT_LIMIT,
            });
            setAuditLog(res.items);
            setAuditTotal(res.total);
        } catch {
            toast.error('Không thể tải lịch sử thay đổi.');
        } finally {
            setAuditLoading(false);
        }
    }, [auditPage]);

    useEffect(() => {
        if (!isReady) return;
        fetchConfig();
    }, [isReady, fetchConfig]);

    useEffect(() => {
        if (!isReady) return;
        fetchAuditLog();
    }, [isReady, fetchAuditLog]);

    // ── Fee save ──
    const handleFeeSave = async () => {
        const rate = parseFloat(feeInput) / 100;
        if (isNaN(rate) || rate < 0 || rate > 1) {
            toast.error('Phí hoa hồng phải từ 0% đến 100%.');
            return;
        }
        setFeeSaving(true);
        try {
            await adminApi.updateFee(rate, feeNote || undefined);
            toast.success('Đã cập nhật phí hoa hồng!');
            setFeeConfirm(false);
            setFeeEditing(false);
            setFeeNote('');
            await fetchConfig();
            await fetchAuditLog();
        } catch {
            toast.error('Cập nhật thất bại. Vui lòng thử lại.');
        } finally {
            setFeeSaving(false);
        }
    };

    // ── Bank save ──
    const handleBankSave = async () => {
        if (!bankForm.bankAccount || !bankForm.bankCode) {
            toast.error('Vui lòng điền số tài khoản và mã ngân hàng.');
            return;
        }
        setBankSaving(true);
        try {
            await adminApi.updateBankAccount({
                bankAccount: bankForm.bankAccount,
                bankCode: bankForm.bankCode,
                apiKey: bankForm.apiKey || undefined,
                note: bankForm.note || undefined,
            });
            toast.success('Đã cập nhật tài khoản nhận tiền!');
            setBankConfirm(false);
            setBankEditing(false);
            await fetchConfig();
            await fetchAuditLog();
        } catch {
            toast.error('Cập nhật thất bại. Vui lòng thử lại.');
        } finally {
            setBankSaving(false);
        }
    };

    const feeRateNum = parseFloat(feeInput);
    const feeRateValid = !isNaN(feeRateNum) && feeRateNum >= 0 && feeRateNum <= 100;
    const feeChanged = config && feeRateValid && Math.abs(feeRateNum / 100 - config.commissionRate) > 0.0001;
    const totalAuditPages = Math.max(1, Math.ceil(auditTotal / AUDIT_LIMIT));

    if (!isReady) {
        return (
            <AdminLayout activeTab="/admin/billing">
                <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
                    <div className="w-10 h-10 rounded-full border-[3px] border-t-transparent animate-spin" style={{ borderColor: C.orange, borderTopColor: 'transparent' }} />
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout activeTab="/admin/billing">
            <div className="p-6 min-h-screen" style={{ background: C.bg }}>

                {/* ── Header ── */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold mb-1" style={{ color: C.navy }}>Billing & Fee</h1>
                    <p className="text-sm" style={{ color: C.gray }}>
                        Quản lý phí hoa hồng nền tảng và tài khoản nhận tiền.
                    </p>
                </div>

                {/* ── Stats Cards ── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    {[
                        {
                            label: 'PHÍ HIỆN TẠI',
                            value: config ? formatRate(config.commissionRate) : '—',
                            subValue: 'Áp dụng cho mọi giao dịch',
                            color: C.orange,
                            icon: <Percent className="w-4 h-4" />,
                        },
                        {
                            label: 'HOA HỒNG THÁNG NÀY',
                            value: config ? formatCurrency(config.commissionThisMonth) : '—',
                            subValue: 'Tổng thu tháng hiện tại',
                            color: C.green,
                            icon: <TrendingUp className="w-4 h-4" />,
                        },
                        {
                            label: 'TỔNG HOA HỒNG',
                            value: config ? formatCurrency(config.totalCommission) : '—',
                            subValue: 'Tích lũy từ trước đến nay',
                            color: C.navy,
                            icon: <DollarSign className="w-4 h-4" />,
                        },
                    ].map(stat => (
                        <div key={stat.label} className="bg-white rounded-2xl border p-4" style={{ borderColor: C.border }}>
                            {loadingConfig ? (
                                <div className="animate-pulse space-y-2">
                                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                                    <div className="h-7 bg-gray-100 rounded w-1/2" />
                                    <div className="h-3 bg-gray-100 rounded w-3/4" />
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: C.gray }}>{stat.label}</p>
                                        <span style={{ color: stat.color, opacity: 0.6 }}>{stat.icon}</span>
                                    </div>
                                    <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                                    <p className="text-[10px] mt-1 font-medium" style={{ color: C.gray }}>{stat.subValue}</p>
                                </>
                            )}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

                    {/* ── Fee Settings Card ── */}
                    <div className="bg-white rounded-2xl border" style={{ borderColor: C.border }}>
                        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: C.border }}>
                            <div className="flex items-center gap-2">
                                <Percent className="w-4 h-4" style={{ color: C.orange }} />
                                <h2 className="text-sm font-bold" style={{ color: C.navy }}>Phí Hoa Hồng Nền Tảng</h2>
                            </div>
                            {!feeEditing && (
                                <button
                                    onClick={() => setFeeEditing(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:bg-orange-50"
                                    style={{ color: C.orange }}
                                >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    Chỉnh sửa
                                </button>
                            )}
                        </div>

                        <div className="p-5">
                            {loadingConfig ? (
                                <div className="animate-pulse space-y-3">
                                    <div className="h-4 bg-gray-100 rounded w-1/3" />
                                    <div className="h-12 bg-gray-100 rounded" />
                                </div>
                            ) : feeEditing ? (
                                <div className="space-y-4">
                                    {/* Banner */}
                                    <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50">
                                        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                        <p className="text-xs text-amber-700 leading-relaxed">
                                            Thay đổi phí sẽ áp dụng ngay cho các giao dịch mới. Các đơn đang xử lý không bị ảnh hưởng.
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-semibold tracking-wider uppercase mb-2" style={{ color: C.gray }}>
                                            Phí hoa hồng mới (%)
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min={0}
                                                max={100}
                                                step={0.1}
                                                value={feeInput}
                                                onChange={e => setFeeInput(e.target.value)}
                                                className="w-full pr-10 pl-4 py-3 rounded-xl border text-lg font-bold focus:outline-none focus:ring-2"
                                                style={{
                                                    borderColor: feeRateValid ? C.border : C.red,
                                                    color: C.navy,
                                                    fontFamily: 'Lexend, sans-serif',
                                                    focusRingColor: C.orange,
                                                } as React.CSSProperties}
                                                placeholder="10.0"
                                                autoFocus
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: C.gray }}>%</span>
                                        </div>
                                        {!feeRateValid && (
                                            <p className="text-xs mt-1" style={{ color: C.red }}>Phí phải từ 0% đến 100%.</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-semibold tracking-wider uppercase mb-2" style={{ color: C.gray }}>
                                            Ghi chú (tùy chọn)
                                        </label>
                                        <input
                                            type="text"
                                            value={feeNote}
                                            onChange={e => setFeeNote(e.target.value)}
                                            placeholder="VD: Điều chỉnh theo chiến dịch tháng 4..."
                                            className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
                                            style={{ borderColor: C.border, color: C.navy, fontFamily: 'Lexend, sans-serif' }}
                                        />
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => { setFeeEditing(false); setFeeInput((config!.commissionRate * 100).toFixed(1)); setFeeNote(''); }}
                                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 hover:bg-gray-200 transition-colors"
                                            style={{ color: C.navy }}
                                        >
                                            Hủy
                                        </button>
                                        <button
                                            onClick={() => setFeeConfirm(true)}
                                            disabled={!feeChanged || !feeRateValid}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-40"
                                            style={{ background: C.orange }}
                                        >
                                            <Save className="w-4 h-4" />
                                            Lưu thay đổi
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4 p-4 rounded-2xl" style={{ background: C.orangeLight }}>
                                        <div
                                            className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-white text-lg flex-shrink-0"
                                            style={{ background: C.orange }}
                                        >
                                            {config ? (config.commissionRate * 100).toFixed(0) : '—'}%
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold" style={{ color: C.navy }}>
                                                {config ? formatRate(config.commissionRate) : '—'} hoa hồng
                                            </p>
                                            <p className="text-xs mt-0.5" style={{ color: C.gray }}>
                                                Thu từ mỗi giao dịch hoàn thành trên nền tảng
                                            </p>
                                            <p className="text-[10px] mt-1.5 font-semibold" style={{ color: C.orange }}>
                                                Ví dụ: đơn 500.000₫ → hoa hồng {config ? formatCurrency(Math.round(500000 * config.commissionRate)) : '—'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="p-3 rounded-xl border" style={{ borderColor: C.border, background: C.bg }}>
                                        <p className="text-[10px] font-semibold tracking-wider uppercase mb-2" style={{ color: C.gray }}>Cơ chế thu phí</p>
                                        <ul className="space-y-1.5 text-xs" style={{ color: C.gray }}>
                                            <li className="flex items-start gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-current mt-1.5 flex-shrink-0" style={{ background: C.navy }} />
                                                <span><strong style={{ color: C.navy }}>Tiền mặt:</strong> Trừ thẳng vào ví Provider sau khi job hoàn thành.</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-current mt-1.5 flex-shrink-0" style={{ background: C.blue }} />
                                                <span><strong style={{ color: C.navy }}>QR / Ví:</strong> Khấu trừ khi giải ngân — Provider nhận số tiền net.</span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Platform Bank Account Card ── */}
                    <div className="bg-white rounded-2xl border" style={{ borderColor: C.border }}>
                        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: C.border }}>
                            <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4" style={{ color: C.blue }} />
                                <h2 className="text-sm font-bold" style={{ color: C.navy }}>Cấu Hình SePay</h2>
                            </div>
                            {!bankEditing && (
                                <button
                                    onClick={() => setBankEditing(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:bg-blue-50"
                                    style={{ color: C.blue }}
                                >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    Chỉnh sửa
                                </button>
                            )}
                        </div>

                        <div className="p-5">
                            {loadingConfig ? (
                                <div className="animate-pulse space-y-3">
                                    <div className="h-4 bg-gray-100 rounded w-1/2" />
                                    <div className="h-4 bg-gray-100 rounded w-2/3" />
                                    <div className="h-4 bg-gray-100 rounded w-1/3" />
                                </div>
                            ) : bankEditing ? (
                                <div className="space-y-3">
                                    {[
                                        { key: 'bankAccount', label: 'Số tài khoản *', placeholder: 'VD: 07729096901', required: true },
                                        { key: 'bankCode', label: 'Mã ngân hàng *', placeholder: 'VD: TPBank', required: true },
                                        { key: 'apiKey', label: 'SePay API Key (để trống = giữ nguyên)', placeholder: 'Nhập API Key mới nếu muốn cập nhật...', required: false },
                                        { key: 'note', label: 'Ghi chú (tùy chọn)', placeholder: 'Lý do thay đổi...', required: false },
                                    ].map(field => (
                                        <div key={field.key}>
                                            <label className="block text-[10px] font-semibold tracking-wider uppercase mb-1.5" style={{ color: C.gray }}>
                                                {field.label}
                                            </label>
                                            <input
                                                type="text"
                                                value={bankForm[field.key as keyof typeof bankForm]}
                                                onChange={e => setBankForm(f => ({ ...f, [field.key]: e.target.value }))}
                                                placeholder={field.placeholder}
                                                className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none"
                                                style={{ borderColor: C.border, color: C.navy, fontFamily: 'Lexend, sans-serif' }}
                                            />
                                        </div>
                                    ))}

                                    <div className="flex gap-3 pt-1">
                                        <button
                                            onClick={() => {
                                                setBankEditing(false);
                                                setBankForm({
                                                    bankAccount: config?.sepayBankAccount ?? '',
                                                    bankCode: config?.sepayBankCode ?? '',
                                                    apiKey: '',
                                                    note: '',
                                                });
                                            }}
                                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 hover:bg-gray-200 transition-colors"
                                            style={{ color: C.navy }}
                                        >
                                            Hủy
                                        </button>
                                        <button
                                            onClick={() => setBankConfirm(true)}
                                            disabled={!bankForm.bankAccount || !bankForm.bankCode}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-40"
                                            style={{ background: C.blue }}
                                        >
                                            <Save className="w-4 h-4" />
                                            Lưu tài khoản
                                        </button>
                                    </div>
                                </div>
                            ) : config?.sepayBankAccount ? (
                                <div className="space-y-3">
                                    <div className="p-4 rounded-2xl border" style={{ borderColor: C.blueLight, background: C.blueLight }}>
                                        <div className="flex items-center gap-3 mb-3">
                                            <div
                                                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                                style={{ background: C.blue }}
                                            >
                                                <CreditCard className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold" style={{ color: C.navy }}>SePay</p>
                                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: '#dbeafe', color: C.blue }}>
                                                    {config.sepayBankCode}
                                                </span>
                                            </div>
                                        </div>
                                        {[
                                            { label: 'Số tài khoản', value: config.sepayBankAccount },
                                            { label: 'API Key', value: config.sepayApiKey ? '••••••••' + config.sepayApiKey.slice(-6) : 'Đang dùng env' },
                                        ].map(row => (
                                            <div key={row.label} className="flex items-center justify-between py-1.5 border-t" style={{ borderColor: '#bfdbfe' }}>
                                                <span className="text-xs" style={{ color: '#1d4ed8' }}>{row.label}</span>
                                                <span className="text-xs font-bold" style={{ color: C.navy }}>{row.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[10px]" style={{ color: C.gray }}>
                                        💡 SePay dùng để nhận thanh toán QR và tự động đối soát top-up từ Provider.
                                    </p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-3 py-8 text-center">
                                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: C.bg }}>
                                        <Building2 className="w-6 h-6" style={{ color: C.gray }} />
                                    </div>
                                    <p className="text-sm font-medium" style={{ color: C.gray }}>Chưa cấu hình SePay (đang dùng env)</p>
                                    <button
                                        onClick={() => setBankEditing(true)}
                                        className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                                        style={{ background: C.blueLight, color: C.blue }}
                                    >
                                        Cấu hình SePay
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Audit Log Card ── */}
                <div className="bg-white rounded-2xl border" style={{ borderColor: C.border }}>
                    <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: C.border }}>
                        <div className="flex items-center gap-2">
                            <History className="w-4 h-4" style={{ color: C.purple }} />
                            <h2 className="text-sm font-bold" style={{ color: C.navy }}>Lịch Sử Thay Đổi (Audit Log)</h2>
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: C.purpleLight, color: C.purple }}>
                            {auditTotal} mục
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead style={{ background: C.bg }}>
                                <tr>
                                    {['Thời gian', 'Admin', 'Loại thay đổi', 'Trước', 'Sau', 'Ghi chú'].map(col => (
                                        <th key={col} className="text-left text-[10px] font-semibold tracking-wider px-4 py-3 uppercase" style={{ color: C.gray }}>
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {auditLoading ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-10">
                                            <div className="w-6 h-6 rounded-full border-[3px] border-t-transparent animate-spin mx-auto" style={{ borderColor: C.orange, borderTopColor: 'transparent' }} />
                                        </td>
                                    </tr>
                                ) : auditLog.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-10 text-sm" style={{ color: C.gray }}>
                                            Chưa có lịch sử thay đổi nào.
                                        </td>
                                    </tr>
                                ) : (
                                    auditLog.map(entry => {
                                        const desc = describeAuditEntry(entry);
                                        const isFee = entry.changeType === 'FEE_RATE';
                                        return (
                                            <tr key={entry.id} className="border-t hover:bg-gray-50 transition-colors" style={{ borderColor: C.border }}>
                                                <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: C.gray }}>
                                                    {formatDate(entry.createdAt)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-sm font-semibold" style={{ color: C.navy }}>{entry.adminName}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold"
                                                        style={{
                                                            background: isFee ? C.orangeLight : C.blueLight,
                                                            color: isFee ? C.orange : C.blue,
                                                        }}
                                                    >
                                                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current" />
                                                        {desc.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-xs" style={{ color: C.gray }}>
                                                    {desc.before ?? <span className="italic">Chưa có</span>}
                                                </td>
                                                <td className="px-4 py-3 text-xs font-semibold" style={{ color: C.green }}>
                                                    {desc.after}
                                                </td>
                                                <td className="px-4 py-3 text-xs max-w-[160px] truncate" style={{ color: C.gray }}>
                                                    {entry.note ?? <span className="italic">—</span>}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Audit log pagination */}
                    {!auditLoading && auditTotal > 0 && (
                        <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: C.border }}>
                            <p className="text-xs" style={{ color: C.gray }}>
                                Hiển thị <span className="font-semibold" style={{ color: C.navy }}>
                                    {(auditPage - 1) * AUDIT_LIMIT + 1}
                                </span> – <span className="font-semibold" style={{ color: C.navy }}>
                                    {Math.min(auditPage * AUDIT_LIMIT, auditTotal)}
                                </span> / <span className="font-semibold" style={{ color: C.navy }}>{auditTotal}</span> mục
                            </p>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                                    disabled={auditPage === 1}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    style={{ color: C.gray }}
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                {Array.from({ length: Math.min(5, totalAuditPages) }, (_, i) => {
                                    let start = Math.max(1, auditPage - 2);
                                    const end = Math.min(totalAuditPages, start + 4);
                                    if (end - start < 4) start = Math.max(1, end - 4);
                                    return start + i;
                                }).filter(p => p <= totalAuditPages).map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setAuditPage(p)}
                                        className="w-7 h-7 rounded-lg text-xs font-semibold transition-colors"
                                        style={{
                                            background: auditPage === p ? C.orange : 'transparent',
                                            color: auditPage === p ? '#fff' : C.gray,
                                        }}
                                    >
                                        {p}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setAuditPage(p => Math.min(totalAuditPages, p + 1))}
                                    disabled={auditPage >= totalAuditPages}
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

            {/* ── Fee Confirm Modal ── */}
            {feeConfirm && (
                <ConfirmModal
                    title="Xác nhận thay đổi phí"
                    confirmLabel="Áp dụng ngay"
                    confirmColor={C.orange}
                    loading={feeSaving}
                    onConfirm={handleFeeSave}
                    onCancel={() => setFeeConfirm(false)}
                    description={
                        <span>
                            Bạn đang thay đổi phí hoa hồng từ{' '}
                            <strong style={{ color: C.navy }}>{config ? formatRate(config.commissionRate) : '?'}</strong>{' '}
                            sang{' '}
                            <strong style={{ color: C.orange }}>
                                {feeRateValid ? (parseFloat(feeInput) / 100 * 100).toFixed(1) + '%' : '?'}
                            </strong>.
                            <br /><br />
                            Thay đổi này sẽ áp dụng cho tất cả giao dịch mới và sẽ được ghi lại trong audit log.
                        </span>
                    }
                />
            )}

            {/* ── Bank Account Confirm Modal ── */}
            {bankConfirm && (
                <ConfirmModal
                    title="Xác nhận cập nhật SePay"
                    confirmLabel="Lưu cấu hình"
                    confirmColor={C.blue}
                    loading={bankSaving}
                    onConfirm={handleBankSave}
                    onCancel={() => setBankConfirm(false)}
                    description={
                        <span>
                            Bạn đang cập nhật cấu hình SePay:{' '}
                            <strong style={{ color: C.navy }}>
                                {bankForm.bankCode} • {bankForm.bankAccount}
                            </strong>.
                            <br /><br />
                            Thay đổi sẽ có hiệu lực ngay và được ghi lại trong audit log.
                        </span>
                    }
                />
            )}
        </AdminLayout>
    );
}
