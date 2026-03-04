'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Wallet, ArrowDownCircle, ArrowUpCircle, Clock, CheckCircle2,
    XCircle, RefreshCw, TrendingUp, Banknote, ChevronDown, ChevronUp,
    AlertCircle, ShieldX, ArrowLeft, BookOpen, Settings,
} from 'lucide-react';
import api from '@/lib/api';
import { useProviderGuard } from '@/lib/guards';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useRouter } from 'next/navigation';

// ─── Same color tokens as provider dashboard ─────────────────────────────────
const C = {
    orange: '#f97316',
    orangeDark: '#ea6c0a',
    orangeLight: '#fff7ed',
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#f1f5f9',
    bg: '#f8fafc',
};

// navItems are defined inside ProviderWalletPage to use t()


// ─── Types ────────────────────────────────────────────────────────────────────
interface WalletData {
    id: string;
    availableBalance: number;
    pendingBalance: number;
    createdAt: string;
    updatedAt: string;
}

interface Transaction {
    id: string;
    type: 'CREDIT' | 'DEBIT';
    amount: number;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    referenceType: 'JOB' | 'WITHDRAW' | 'COMMISSION' | 'REFUND' | 'ADJUSTMENT';
    referenceId: string;
    description: string | null;
    createdAt: string;
}

interface TransactionsResponse {
    items: Transaction[];
    total: number;
    skip: number;
    take: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const MIN_WITHDRAWAL = 50_000;

function formatVnd(amount: number) {
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M ₫`;
    if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K ₫`;
    return `${amount} ₫`;
}

function formatVndFull(amount: number) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0 }).format(amount);
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

// REF_LABEL is now built inside TxRow using useLanguage


// ─── Withdraw Modal ───────────────────────────────────────────────────────────
function WithdrawModal({ availableBalance, onClose, onSuccess }: {
    availableBalance: number;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const { t } = useLanguage();
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const numeric = parseInt(amount.replace(/\D/g, ''), 10) || 0;
    const isInsufficient = numeric > availableBalance;
    const isBelowMin = numeric > 0 && numeric < MIN_WITHDRAWAL;
    const isDisabled = loading || numeric <= 0 || isInsufficient || isBelowMin;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isDisabled) return;
        setLoading(true);
        setError('');
        try {
            await api.post('/wallet/withdraw', { amount: numeric });
            onSuccess();
        } catch (err: any) {
            setError(err?.response?.data?.message || t('provider.wallet.withdrawModal.errorDefault'));
        } finally {
            setLoading(false);
        }
    };

    const quickAmounts = [100_000, 200_000, 500_000, 1_000_000].filter(a => a <= availableBalance);

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl">
                <div className="flex justify-center pt-3 pb-1 sm:hidden">
                    <div className="w-10 h-1 rounded-full bg-gray-200" />
                </div>

                {/* Header */}
                <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: C.border }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: C.orangeLight }}>
                        <Banknote style={{ width: 20, height: 20, color: C.orange }} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold" style={{ color: C.navy }}>{t('provider.wallet.withdrawModal.title')}</h2>
                        <p className="text-xs" style={{ color: C.gray }}>{t('provider.wallet.withdrawModal.available')}: {formatVndFull(availableBalance)}</p>
                    </div>
                    <button onClick={onClose} className="ml-auto p-2 rounded-xl hover:bg-gray-100 transition-colors">
                        <XCircle style={{ width: 18, height: 18, color: '#94a3b8' }} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: C.navy }}>{t('provider.wallet.withdrawModal.amountLabel')}</label>
                        <div className="relative">
                            <input
                                type="text"
                                inputMode="numeric"
                                value={amount}
                                onChange={e => {
                                    const raw = e.target.value.replace(/\D/g, '');
                                    setAmount(raw ? parseInt(raw, 10).toLocaleString('vi-VN') : '');
                                    setError('');
                                }}
                                placeholder="0"
                                className="w-full px-4 py-3 pr-16 border rounded-xl text-lg font-semibold focus:outline-none focus:ring-2 transition-all"
                                style={{
                                    borderColor: isInsufficient || isBelowMin ? '#fca5a5' : '#e2e8f0',
                                    color: isInsufficient || isBelowMin ? '#ef4444' : C.navy,
                                    boxShadow: 'none',
                                }}
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: C.gray }}>VND</span>
                        </div>
                        {isBelowMin && <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{t('provider.wallet.withdrawModal.belowMin')} {formatVndFull(MIN_WITHDRAWAL)}</p>}
                        {isInsufficient && <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{t('provider.wallet.withdrawModal.overBalance')}</p>}
                        {!isBelowMin && !isInsufficient && numeric > 0 && (
                            <p className="mt-1.5 text-xs" style={{ color: C.gray }}>{t('provider.wallet.withdrawModal.afterWithdraw')}: {formatVndFull(availableBalance - numeric)}</p>
                        )}
                    </div>

                    {quickAmounts.length > 0 && (
                        <div>
                            <p className="text-xs mb-2" style={{ color: C.gray }}>{t('provider.wallet.withdrawModal.quickSelect')}</p>
                            <div className="flex flex-wrap gap-2">
                                {quickAmounts.map(a => (
                                    <button
                                        key={a}
                                        type="button"
                                        onClick={() => setAmount(a.toLocaleString('vi-VN'))}
                                        className="px-3 py-1.5 text-xs rounded-lg border font-medium transition-all"
                                        style={{
                                            borderColor: numeric === a ? C.orange : '#e2e8f0',
                                            background: numeric === a ? C.orangeLight : 'white',
                                            color: numeric === a ? C.orange : C.gray,
                                        }}
                                    >
                                        {formatVnd(a)}
                                    </button>
                                ))}
                                {availableBalance > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setAmount(availableBalance.toLocaleString('vi-VN'))}
                                        className="px-3 py-1.5 text-xs rounded-lg border font-medium transition-all"
                                        style={{
                                            borderColor: numeric === availableBalance ? C.orange : '#e2e8f0',
                                            background: numeric === availableBalance ? C.orangeLight : 'white',
                                            color: numeric === availableBalance ? C.orange : C.gray,
                                        }}
                                    >
                                        {t('provider.wallet.withdrawModal.all')}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{ background: '#fff1f2', color: '#ef4444', border: '1px solid #fecdd3' }}>
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}
                        </div>
                    )}

                    <div className="p-3 rounded-xl text-xs" style={{ background: C.orangeLight, color: C.orange }}>
                        {t('provider.wallet.withdrawModal.hint')}
                    </div>

                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors" style={{ borderColor: '#e2e8f0', color: C.gray }}>
                            {t('provider.wallet.withdrawModal.cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={isDisabled}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
                            style={{ background: isDisabled ? '#94a3b8' : C.orange }}
                        >
                            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
                            {loading ? t('provider.wallet.withdrawModal.processing') : t('provider.wallet.withdrawModal.confirm')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Transaction Row (expandable) ────────────────────────────────────────────
const INCIDENT_LABELS_MAP: Record<string, string> = {
    BREAKDOWN: 'Hỏng xe',
    ACCIDENT: 'Tai nạn',
    FLAT_TIRE: 'Lốp xe hỏng',
    BATTERY_DEAD: 'Hết bình điện',
    OUT_OF_FUEL: 'Hết nhiên liệu',
    LOCKED_OUT: 'Khóa xe',
    OTHER: 'Khác',
};

function TxRow({ tx }: { tx: Transaction }) {
    const { t } = useLanguage();
    const [expanded, setExpanded] = useState(false);
    const [jobDetails, setJobDetails] = useState<any>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    const isCredit = tx.type === 'CREDIT';
    const refLabel: Record<Transaction['referenceType'], string> = {
        JOB: t('provider.wallet.refLabel.JOB'),
        WITHDRAW: t('provider.wallet.refLabel.WITHDRAW'),
        COMMISSION: t('provider.wallet.refLabel.COMMISSION'),
        REFUND: t('provider.wallet.refLabel.REFUND'),
        ADJUSTMENT: t('provider.wallet.refLabel.ADJUSTMENT'),
    };
    const statusConfig = {
        PENDING: { label: t('provider.wallet.txStatus.PENDING'), bg: '#fefce8', color: '#ca8a04', Icon: Clock },
        COMPLETED: { label: t('provider.wallet.txStatus.COMPLETED'), bg: '#f0fdf4', color: '#16a34a', Icon: CheckCircle2 },
        FAILED: { label: t('provider.wallet.txStatus.FAILED'), bg: '#fff1f2', color: '#ef4444', Icon: XCircle },
    }[tx.status];
    const { Icon } = statusConfig;

    const canFetchDetails = (tx.referenceType === 'JOB' || tx.referenceType === 'COMMISSION') && tx.referenceId;

    const handleExpand = async () => {
        const next = !expanded;
        setExpanded(next);
        if (next && canFetchDetails && !jobDetails) {
            setLoadingDetails(true);
            try {
                const res = await api.get(`/rescue-requests/${tx.referenceId}/provider-view`);
                setJobDetails(res.data);
            } catch {
                // Try payment endpoint as fallback for amount
                try {
                    const res2 = await api.get(`/rescue-requests/${tx.referenceId}/payment`);
                    setJobDetails({ _paymentOnly: true, ...res2.data });
                } catch { /* ignore */ }
            } finally {
                setLoadingDetails(false);
            }
        }
    };

    return (
        <div className="border-b last:border-0" style={{ borderColor: C.border }}>
            {/* Main row — clickable */}
            <button
                type="button"
                onClick={handleExpand}
                className="w-full flex items-center gap-3 py-3.5 text-left transition-colors"
                style={{ background: 'transparent' }}
            >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: isCredit ? '#f0fdf4' : '#fff1f2' }}>
                    {isCredit
                        ? <ArrowDownCircle style={{ width: 17, height: 17, color: '#16a34a' }} />
                        : <ArrowUpCircle style={{ width: 17, height: 17, color: '#ef4444' }} />}
                </div>
                <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium truncate" style={{ color: C.navy }}>
                        {tx.description || refLabel[tx.referenceType]}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: C.gray }}>{formatDate(tx.createdAt)}</p>
                </div>
                <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 mr-2"
                    style={{ background: statusConfig.bg, color: statusConfig.color }}>
                    <Icon style={{ width: 10, height: 10 }} />
                    {statusConfig.label}
                </div>
                <p className="text-sm font-bold tabular-nums flex-shrink-0 mr-2"
                    style={{ color: isCredit ? '#16a34a' : '#ef4444' }}>
                    {isCredit ? '+' : '-'}{formatVnd(tx.amount)}
                </p>
                {/* Expand chevron */}
                <ChevronDown
                    style={{
                        width: 15, height: 15, color: C.gray, flexShrink: 0,
                        transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s',
                    }}
                />
            </button>

            {/* Expanded detail panel */}
            {expanded && (
                <div
                    className="pb-3 px-1 rounded-xl mb-2"
                    style={{ background: '#f8fafc', border: '1px solid #f1f5f9', marginBottom: '8px' }}
                >
                    {loadingDetails ? (
                        <div className="flex items-center justify-center py-4 gap-2">
                            <RefreshCw style={{ width: 14, height: 14, color: C.orange }} className="animate-spin" />
                            <span className="text-xs" style={{ color: C.gray }}>Đang tải chi tiết...</span>
                        </div>
                    ) : jobDetails ? (
                        <div className="px-3 pt-3 space-y-2">
                            {/* Header label */}
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: C.orange }}>
                                Chi tiết giao dịch
                            </p>

                            {/* Not payment-only: full request data */}
                            {!jobDetails._paymentOnly && (
                                <>
                                    {jobDetails.incidentType && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs" style={{ color: C.gray }}>Loại sự cố</span>
                                            <span className="text-xs font-semibold" style={{ color: C.navy }}>
                                                {INCIDENT_LABELS_MAP[jobDetails.incidentType] || jobDetails.incidentType}
                                            </span>
                                        </div>
                                    )}
                                    {(jobDetails.user?.name || jobDetails.user?.fullName) && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs" style={{ color: C.gray }}>Khách hàng</span>
                                            <span className="text-xs font-semibold" style={{ color: C.navy }}>
                                                {jobDetails.user?.fullName || jobDetails.user?.name}
                                            </span>
                                        </div>
                                    )}
                                    {jobDetails.pickupLocation?.addressText && (
                                        <div className="flex justify-between items-start gap-4">
                                            <span className="text-xs flex-shrink-0" style={{ color: C.gray }}>Địa điểm</span>
                                            <span className="text-xs font-semibold text-right" style={{ color: C.navy }}>
                                                {jobDetails.pickupLocation.addressText}
                                            </span>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Payment section */}
                            <div className="pt-2 mt-2" style={{ borderTop: '1px solid #e2e8f0' }}>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs" style={{ color: C.gray }}>
                                        {tx.referenceType === 'COMMISSION' ? 'Hoa hồng nền tảng' : 'Số tiền giao dịch'}
                                    </span>
                                    <span
                                        className="text-sm font-bold"
                                        style={{ color: isCredit ? '#16a34a' : '#ef4444' }}
                                    >
                                        {isCredit ? '+' : '-'}{formatVndFull(tx.amount)}
                                    </span>
                                </div>
                                {tx.referenceType === 'COMMISSION' && jobDetails.totalAmount && !jobDetails._paymentOnly && (
                                    <div className="flex justify-between items-center mt-1">
                                        <span className="text-xs" style={{ color: C.gray }}>Tổng thu từ khách</span>
                                        <span className="text-xs font-semibold" style={{ color: C.navy }}>
                                            {formatVndFull(jobDetails.totalAmount)}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Transaction ID */}
                            <div className="flex justify-between items-center pt-1">
                                <span className="text-xs" style={{ color: C.gray }}>Mã GD</span>
                                <span className="text-[10px] font-mono" style={{ color: '#94a3b8' }}>
                                    #{tx.id.slice(0, 12).toUpperCase()}
                                </span>
                            </div>
                        </div>
                    ) : canFetchDetails ? (
                        <div className="flex items-center justify-center py-3 gap-2">
                            <span className="text-xs" style={{ color: C.gray }}>Không tải được chi tiết</span>
                        </div>
                    ) : (
                        <div className="px-3 pt-3 space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: C.orange }}>
                                Chi tiết giao dịch
                            </p>
                            <div className="flex justify-between items-center">
                                <span className="text-xs" style={{ color: C.gray }}>Loại</span>
                                <span className="text-xs font-semibold" style={{ color: C.navy }}>
                                    {refLabel[tx.referenceType]}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs" style={{ color: C.gray }}>Số tiền</span>
                                <span className="text-sm font-bold" style={{ color: isCredit ? '#16a34a' : '#ef4444' }}>
                                    {isCredit ? '+' : '-'}{formatVndFull(tx.amount)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs" style={{ color: C.gray }}>Mã GD</span>
                                <span className="text-[10px] font-mono" style={{ color: '#94a3b8' }}>
                                    #{tx.id.slice(0, 12).toUpperCase()}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}


// ─── Main Page ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 15;

export default function ProviderWalletPage() {
    const { isReady } = useProviderGuard();
    const { user } = useAuth();
    const router = useRouter();
    const { t } = useLanguage();

    const navItems = [
        {
            label: t('provider.nav.dashboard'), href: '/provider/active',
            icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
        },
        {
            label: t('provider.nav.history'), href: '#',
            icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        },
        {
            label: t('provider.nav.wallet'), href: '/provider/wallet',
            icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
        },
        {
            label: t('provider.nav.settings'), href: '#',
            icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
        },
    ];
    const [wallet, setWallet] = useState<WalletData | null>(null);
    const [txData, setTxData] = useState<TransactionsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [txLoading, setTxLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [page, setPage] = useState(0);
    const [showAll, setShowAll] = useState(false);

    const loadWallet = useCallback(async () => {
        try {
            const res = await api.get('/wallet/me');
            setWallet(res.data);
        } catch {
            setWallet(null);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadTransactions = useCallback(async (skip = 0) => {
        if (!wallet) return;
        setTxLoading(true);
        try {
            const res = await api.get(`/wallet/me/transactions?skip=${skip}&take=${PAGE_SIZE}`);
            setTxData(res.data);
            setPage(skip);
        } catch { } finally {
            setTxLoading(false);
        }
    }, [wallet]);

    useEffect(() => { if (isReady) loadWallet(); }, [isReady, loadWallet]);
    useEffect(() => { if (wallet) loadTransactions(0); }, [wallet, loadTransactions]);

    const displayName = (user as any)?.fullName?.split(' ').slice(-1)[0] || user?.email?.split('@')[0] || 'Provider';

    const nav = (href: string) => { if (href !== '#') router.push(href); };

    // ── Guard: APPROVED only ──────────────────────────────────────────────────
    if (isReady && user && user.verificationStatus !== 'APPROVED') {
        return (
            <div className="min-h-screen flex items-center justify-center p-4" style={{ background: C.bg }}>
                <div className="bg-white rounded-2xl shadow-sm p-8 max-w-sm w-full text-center" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.08)' }}>
                    <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: C.orangeLight }}>
                        <ShieldX style={{ width: 24, height: 24, color: C.orange }} />
                    </div>
                    <h2 className="text-lg font-bold mb-2" style={{ color: C.navy }}>{t('provider.wallet.notVerified')}</h2>
                    <p className="text-sm mb-5" style={{ color: C.gray }}>{t('provider.wallet.notVerifiedDesc')}</p>
                    <button onClick={() => router.push('/provider/verification')} className="w-full py-2.5 rounded-xl text-white text-sm font-semibold mb-2" style={{ background: C.orange }}>{t('provider.wallet.completeVerification')}</button>
                    <button onClick={() => router.push('/provider/active')} className="w-full py-2.5 rounded-xl text-sm font-medium border" style={{ color: C.gray, borderColor: '#e2e8f0' }}>{t('provider.wallet.backToDashboard')}</button>
                </div>
            </div>
        );
    }

    // ── Loading ───────────────────────────────────────────────────────────────
    if (!isReady || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto mb-3" style={{ borderColor: C.orange }} />
                    <p className="text-sm" style={{ color: C.gray }}>{t('provider.wallet.loadingWallet')}</p>
                </div>
            </div>
        );
    }

    const items = txData?.items ?? [];
    const displayedItems = showAll ? items : items.slice(0, 5);
    const hasMore = txData ? page + PAGE_SIZE < txData.total : false;
    const available = wallet?.availableBalance ?? 0;
    const pending = wallet?.pendingBalance ?? 0;
    const total = available + pending;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="h-screen overflow-hidden flex" style={{ fontFamily: 'Poppins, sans-serif', background: C.bg }}>

            {/* ═══ Desktop Sidebar ═══ */}
            <aside
                className="hidden md:flex flex-col justify-between py-6 px-4 flex-shrink-0"
                style={{ width: '220px', background: '#ffffff', borderRight: `1px solid ${C.border}` }}
            >
                <div>
                    <div className="flex items-center gap-2 mb-8 px-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.orange }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 7v10l8 5 8-5V7L12 2z" fill="white" opacity="0.9" /></svg>
                        </div>
                        <span className="font-bold text-base" style={{ color: C.navy }}>RescueMe</span>
                    </div>
                    <nav className="space-y-1">
                        {navItems.map(item => {
                            const active = item.label === t('provider.nav.wallet');
                            return (
                                <button
                                    key={item.label}
                                    onClick={() => nav(item.href)}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                                    style={{ background: active ? C.orangeLight : 'transparent', color: active ? C.orange : '#64748b' }}
                                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = C.bg; }}
                                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                >
                                    {item.icon}{item.label}
                                </button>
                            );
                        })}
                    </nav>
                </div>
                <div className="flex items-center gap-3 px-2 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: C.orange }}>
                        {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: C.navy }}>{displayName}</p>
                        <p className="text-xs" style={{ color: C.gray }}>{t('provider.dashboard.providerRole')}</p>
                    </div>
                </div>
            </aside>

            {/* ═══ Main Area ═══ */}
            <div className="flex-1 flex flex-col min-w-0" style={{ paddingBottom: '64px' }}>

                {/* ── Header ── */}
                <header
                    className="flex items-center justify-between px-4 py-3 flex-shrink-0 sticky top-0 z-20"
                    style={{ background: '#ffffff', borderBottom: `1px solid ${C.border}` }}
                >
                    {/* Mobile: back arrow + RescueMe | Desktop: Ví title */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/provider/active')}
                            className="flex md:hidden items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 transition-colors"
                            style={{ color: C.navy }}
                        >
                            <ArrowLeft style={{ width: 18, height: 18 }} />
                        </button>
                        <div className="flex md:hidden items-center gap-2">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: C.orange }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 7v10l8 5 8-5V7L12 2z" fill="white" opacity="0.9" /></svg>
                            </div>
                            <span className="font-bold text-sm" style={{ color: C.navy }}>RescueMe</span>
                        </div>
                        <h2 className="hidden md:block text-base font-semibold" style={{ color: C.navy }}>{t('provider.wallet.myWallet')}</h2>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
                            <span className="text-xs font-medium" style={{ color: '#64748b' }}>{t('common.systemOperational')}</span>
                        </div>
                        {/* Language Switcher */}
                        <LanguageSwitcher />
                        <button className="p-1.5 rounded-lg" style={{ color: '#94a3b8' }}>
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                        </button>
                        <button
                            onClick={() => { setLoading(true); loadWallet(); }}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: '#94a3b8' }}
                            title={t('provider.wallet.refresh')}
                        >
                            <RefreshCw style={{ width: 18, height: 18 }} />
                        </button>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: C.orange }}>
                            {displayName.charAt(0).toUpperCase()}
                        </div>
                    </div>
                </header>

                {/* ── Body ── */}
                <div className="flex-1 overflow-y-auto">
                    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">

                        {/* Hero balance banner */}
                        <div className="rounded-2xl p-6 text-white" style={{ background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)`, boxShadow: `0 8px 24px ${C.orange}40` }}>
                            <p className="text-sm opacity-80 mb-1">{t('provider.wallet.totalBalance')}</p>
                            <p className="text-4xl font-bold tabular-nums mb-4">{formatVndFull(total)}</p>
                            <div className="flex items-center justify-between">
                                <div className="flex gap-6">
                                    <div>
                                        <p className="text-xs opacity-70">{t('provider.wallet.available')}</p>
                                        <p className="text-sm font-semibold">{formatVndFull(available)}</p>
                                    </div>
                                    <div className="w-px bg-white/20" />
                                    <div>
                                        <p className="text-xs opacity-70">{t('provider.wallet.pending')}</p>
                                        <p className="text-sm font-semibold">{formatVndFull(pending)}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowModal(true)}
                                    disabled={!wallet || available < MIN_WITHDRAWAL}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                    style={{ background: 'white', color: C.orange }}
                                >
                                    <Banknote style={{ width: 16, height: 16 }} />
                                    {t('provider.wallet.withdraw')}
                                </button>
                            </div>
                            {available < MIN_WITHDRAWAL && (
                                <p className="mt-3 text-xs opacity-70 flex items-center gap-1">
                                    <AlertCircle style={{ width: 12, height: 12 }} />
                                    {t('provider.wallet.needMinimum').replace('{amount}', formatVndFull(MIN_WITHDRAWAL))}
                                </p>
                            )}
                        </div>

                        {/* Balance detail cards */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white rounded-xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: '#f0fdf4' }}>
                                    <Wallet style={{ width: 18, height: 18, color: '#16a34a' }} />
                                </div>
                                <p className="text-xs mb-1" style={{ color: C.gray }}>{t('provider.wallet.availableBalance')}</p>
                                <p className="text-xl font-bold tabular-nums" style={{ color: C.navy }}>{formatVndFull(available)}</p>
                                <p className="text-xs mt-1" style={{ color: C.gray }}>{t('provider.wallet.withdrawableNow')}</p>
                            </div>
                            <div className="bg-white rounded-xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: '#fefce8' }}>
                                    <Clock style={{ width: 18, height: 18, color: '#ca8a04' }} />
                                </div>
                                <p className="text-xs mb-1" style={{ color: C.gray }}>{t('provider.wallet.pendingBalance')}</p>
                                <p className="text-xl font-bold tabular-nums" style={{ color: C.navy }}>{formatVndFull(pending)}</p>
                                <p className="text-xs mt-1" style={{ color: C.gray }}>{t('provider.wallet.disbursed24h')}</p>
                            </div>
                        </div>

                        {/* Transaction history */}
                        <div className="bg-white rounded-xl" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                            <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: C.border }}>
                                <TrendingUp style={{ width: 18, height: 18, color: C.orange }} />
                                <h2 className="text-sm font-bold flex-1" style={{ color: C.navy }}>{t('provider.wallet.transactions')}</h2>
                                {txData && <span className="text-xs" style={{ color: C.gray }}>{txData.total} {t('provider.wallet.transactionCount')}</span>}
                                {txLoading && <RefreshCw style={{ width: 14, height: 14, color: C.gray }} className="animate-spin" />}
                            </div>

                            <div className="px-5">
                                {txLoading && items.length === 0 ? (
                                    <div className="py-10 text-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-3" style={{ borderColor: C.orange }} />
                                        <p className="text-sm" style={{ color: C.gray }}>{t('provider.wallet.loadingTransactions')}</p>
                                    </div>
                                ) : items.length === 0 ? (
                                    <div className="py-12 text-center">
                                        <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: C.border }}>
                                            <Wallet style={{ width: 22, height: 22, color: '#94a3b8' }} />
                                        </div>
                                        <p className="text-sm font-medium" style={{ color: C.navy }}>{t('provider.wallet.noTransactions')}</p>
                                        <p className="text-xs mt-1" style={{ color: C.gray }}>{t('provider.wallet.firstJobHint')}</p>
                                    </div>
                                ) : (
                                    <>
                                        {displayedItems.map(tx => <TxRow key={tx.id} tx={tx} />)}

                                        {items.length > 5 && (
                                            <button
                                                onClick={() => setShowAll(v => !v)}
                                                className="w-full py-3 flex items-center justify-center gap-1.5 text-sm font-medium border-t transition-colors"
                                                style={{ borderColor: C.border, color: C.orange }}
                                            >
                                                {showAll ? <><ChevronUp className="w-4 h-4" />{t('provider.wallet.collapse')}</> : <><ChevronDown className="w-4 h-4" />{t('provider.wallet.showMore')} ({items.length - 5})</>}
                                            </button>
                                        )}

                                        {(hasMore || page > 0) && showAll && (
                                            <div className="flex items-center justify-between py-3 border-t text-sm" style={{ borderColor: C.border, color: C.gray }}>
                                                <button onClick={() => loadTransactions(Math.max(0, page - PAGE_SIZE))} disabled={page === 0 || txLoading} className="px-3 py-1.5 rounded-lg border disabled:opacity-40" style={{ borderColor: '#e2e8f0' }}>{t('provider.wallet.prev')}</button>
                                                <span>{page + 1}–{Math.min(page + PAGE_SIZE, txData?.total ?? 0)} / {txData?.total ?? 0}</span>
                                                <button onClick={() => loadTransactions(page + PAGE_SIZE)} disabled={!hasMore || txLoading} className="px-3 py-1.5 rounded-lg border disabled:opacity-40" style={{ borderColor: '#e2e8f0' }}>{t('provider.wallet.next')}</button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {wallet && (
                            <p className="text-center text-xs" style={{ color: '#94a3b8' }}>
                                {t('provider.wallet.lastUpdated')}: {formatDate(wallet.updatedAt)}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* ═══ Mobile Bottom Nav ═══ */}
            <nav
                className="fixed bottom-0 left-0 right-0 md:hidden z-30 flex items-stretch"
                style={{ background: '#ffffff', borderTop: `1px solid ${C.border}`, height: '60px' }}
            >
                {navItems.map(item => {
                    const active = item.label === t('provider.nav.wallet');
                    return (
                        <button
                            key={item.label}
                            onClick={() => nav(item.href)}
                            className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
                            style={{ color: active ? C.orange : '#94a3b8' }}
                        >
                            <span style={{ color: active ? C.orange : '#94a3b8' }}>{item.icon}</span>
                            <span className="text-[9px] font-medium">{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            {/* Withdraw Modal */}
            {showModal && wallet && (
                <WithdrawModal
                    availableBalance={available}
                    onClose={() => setShowModal(false)}
                    onSuccess={() => { setShowModal(false); loadWallet(); loadTransactions(0); }}
                />
            )}
        </div>
    );
}
