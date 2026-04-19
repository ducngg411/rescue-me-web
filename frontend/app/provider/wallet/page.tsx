'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Wallet, ArrowDownCircle, ArrowUpCircle, Clock, CheckCircle2,
    XCircle, RefreshCw, TrendingUp, Banknote, ChevronDown, ChevronUp,
    AlertCircle, QrCode, ExternalLink, ShieldX, ArrowLeft, Plus
} from 'lucide-react';
import toast from 'react-hot-toast';
import RescueMeLogo from '@/components/RescueMeLogo';
import api from '@/lib/api';
import { displayWalletTxnCode, displayOrderCode } from '@/lib/reconciliation';
import { isJobPaymentQrProviderTx } from '@/lib/providerWalletTxLabels';
import { useProviderGuard } from '@/lib/guards';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import AvatarImage from '@/components/AvatarImage';
import { useRouter } from 'next/navigation';
import ProviderLayout from '@/components/ProviderLayout';
import PendingVerificationScreen from '@/components/PendingVerificationScreen';

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
    hasActivated: boolean;
    createdAt: string;
    updatedAt: string;
}

interface Transaction {
    id: string;
    txnCode?: string | null;
    type: 'CREDIT' | 'DEBIT';
    amount: number;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    referenceType: 'JOB' | 'JOB_PAYMENT' | 'WITHDRAW' | 'COMMISSION' | 'REFUND' | 'ADJUSTMENT' | 'TOPUP';
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
const MIN_TOPUP = 100_000; // TODO: restore to 100_000 after SePay testing

const TOPUP_QUICK_AMOUNTS = [100_000, 200_000, 500_000, 1_000_000, 2_000_000];

function formatVnd(amount: number) {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
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


// ─── Topup Modal (SePay VietQR – 3 step) ─────────────────────────────────────
function TopupModal({ availableBalance, minTopup, initialQrData, onClose, onSuccess }: {
    availableBalance: number;
    minTopup: number;
    initialQrData?: {
        topupTxId: string; topupTxnCode?: string; transferCode: string; qrUrl: string;
        bankAccount: string; bankCode: string; amount: number; expireAt: string;
    };
    onClose: () => void;
    onSuccess: () => void;
}) {
    type Step = 'amount' | 'qr' | 'done' | 'expired';
    const { t } = useLanguage();
    const [step, setStep] = useState<Step>(initialQrData ? 'qr' : 'amount');
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [manualChecking, setManualChecking] = useState(false);
    const [error, setError] = useState('');
    const [qrData, setQrData] = useState<{
        topupTxId: string; topupTxnCode?: string; transferCode: string; qrUrl: string;
        bankAccount: string; bankCode: string; amount: number; expireAt: string;
    } | null>(initialQrData ?? null);
    const [secsLeft, setSecsLeft] = useState(0);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const numeric = parseInt(amount.replace(/\D/g, ''), 10) || 0;
    const isBelowMin = numeric > 0 && numeric < minTopup;
    const isDisabled = loading || numeric < minTopup;

    const stopAll = () => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    };

    // If opened with pre-loaded QR data (resume flow), start polling+countdown immediately
    useEffect(() => {
        if (initialQrData) {
            startPolling(initialQrData.topupTxId);
            startCountdown(initialQrData.expireAt);
        }
        return stopAll;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const startCountdown = (expireAt: string) => {
        const tick = () => {
            const left = Math.max(0, Math.floor((new Date(expireAt).getTime() - Date.now()) / 1000));
            setSecsLeft(left);
            if (left === 0) { stopAll(); setStep('expired'); }
        };
        tick();
        countdownRef.current = setInterval(tick, 1000);
    };

    const handlePollResponse = (status: string) => {
        if (status === 'COMPLETED') {
            stopAll(); setStep('done'); onSuccess();
        } else if (status === 'EXPIRED' || status === 'FAILED' || status === 'CANCELLED') {
            stopAll(); setStep('expired');
        }
    };

    const startPolling = (txId: string) => {
        pollRef.current = setInterval(async () => {
            try {
                const res = await api.get(`/wallet/topup/${txId}/status`);
                handlePollResponse(res.data.status);
            } catch { /* ignore */ }
        }, 3000);
    };

    const handleInit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isDisabled) return;
        setLoading(true); setError('');
        try {
            const res = await api.post('/wallet/topup/init', { amount: numeric });
            setQrData(res.data);
            setStep('qr');
            startPolling(res.data.topupTxId);
            startCountdown(res.data.expireAt);
        } catch (err: any) {
            setError(err?.response?.data?.message || t('provider.topup.createError'));
        } finally { setLoading(false); }
    };

    const handleManualCheck = async () => {
        if (!qrData) return;
        setManualChecking(true); setError('');
        try {
            const res = await api.get(`/wallet/topup/${qrData.topupTxId}/status`);
            handlePollResponse(res.data.status);
            if (res.data.status === 'PENDING') {
                setError(t('provider.topup.notReceived'));
            }
        } catch { setError(t('provider.topup.checkError')); }
        finally { setManualChecking(false); }
    };

    const handleClose = () => { stopAll(); onClose(); };

    const mins = String(Math.floor(secsLeft / 60)).padStart(2, '0');
    const secs = String(secsLeft % 60).padStart(2, '0');
    const countdownColor = secsLeft < 60 ? '#ef4444' : secsLeft < 120 ? '#f97316' : '#16a34a';

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl" style={{ maxHeight: '90vh', overflowY: 'auto', paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px))' }}>
                {/* Drag handle (mobile) */}
                <div className="flex justify-center pt-3 pb-1 sm:hidden">
                    <div className="w-10 h-1 rounded-full bg-gray-200" />
                </div>

                {/* Header */}
                <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: C.border }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#eff6ff' }}>
                        <QrCode style={{ width: 20, height: 20, color: '#2563eb' }} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold" style={{ color: C.navy }}>{t('provider.topup.title')}</h2>
                        <p className="text-xs" style={{ color: C.gray }}>
                            {step === 'amount' ? t('provider.topup.stepAmount') :
                                step === 'qr' ? t('provider.topup.stepQr') :
                                    step === 'done' ? t('provider.topup.stepDone') : t('provider.topup.stepExpired')}
                        </p>
                    </div>
                    <button onClick={handleClose} className="ml-auto p-2 rounded-xl hover:bg-gray-100 transition-colors">
                        <XCircle style={{ width: 18, height: 18, color: '#94a3b8' }} />
                    </button>
                </div>

                {/* ── Step 1: Amount input ── */}
                {step === 'amount' && (
                    <form onSubmit={handleInit} className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1.5" style={{ color: C.navy }}>{t('provider.topup.amountLabel')}</label>
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
                                    className="w-full px-4 py-3 pr-16 border rounded-xl text-lg font-semibold focus:outline-none transition-all"
                                    style={{
                                        borderColor: isBelowMin ? '#fca5a5' : '#e2e8f0',
                                        color: isBelowMin ? '#ef4444' : C.navy,
                                    }}
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: C.gray }}>VND</span>
                            </div>
                            {isBelowMin ? (
                                <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />{t('provider.topup.belowMin').replace('{amount}', formatVndFull(minTopup))}
                                </p>
                            ) : numeric > 0 ? (
                                <p className="mt-1.5 text-xs flex items-center gap-1 font-medium" style={{ color: '#16a34a' }}>
                                    {t('provider.topup.afterTopup').replace('{amount}', formatVndFull(availableBalance + numeric))}
                                </p>
                            ) : null}
                        </div>

                        {/* Quick amounts */}
                        <div>
                            <p className="text-xs mb-2" style={{ color: C.gray }}>{t('provider.topup.quickSelect')}</p>
                            <div className="flex flex-wrap gap-2">
                                {TOPUP_QUICK_AMOUNTS.map(a => (
                                    <button
                                        key={a}
                                        type="button"
                                        onClick={() => setAmount(a.toLocaleString('vi-VN'))}
                                        className="px-3 py-1.5 text-xs rounded-lg border font-medium transition-all"
                                        style={{
                                            borderColor: numeric === a ? '#2563eb' : '#e2e8f0',
                                            background: numeric === a ? '#eff6ff' : 'white',
                                            color: numeric === a ? '#2563eb' : C.gray,
                                        }}
                                    >
                                        {formatVnd(a)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{ background: '#fff1f2', color: '#ef4444', border: '1px solid #fecdd3' }}>
                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}
                            </div>
                        )}

                        <div className="p-3 rounded-xl text-xs" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                            {t('provider.topup.autoConfirm')}
                        </div>

                        <div className="flex gap-3 pb-6 sm:pb-0">
                            <button type="button" onClick={handleClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium border" style={{ borderColor: '#e2e8f0', color: C.gray }}>
                                {t('provider.topup.cancel')}
                            </button>
                            <button
                                type="submit"
                                disabled={isDisabled}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
                                style={{ background: isDisabled ? '#94a3b8' : '#2563eb' }}
                            >
                                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                                {loading ? t('provider.topup.creatingQr') : t('provider.topup.createQr')}
                            </button>
                        </div>
                    </form>
                )}

                {/* ── Step 2: QR display + polling ── */}
                {step === 'qr' && qrData && (
                    <div className="p-6 space-y-4">
                        {/* QR image */}
                        <div className="flex justify-center">
                            <div className="p-3 rounded-2xl" style={{ background: '#f8fafc', border: '2px solid #e2e8f0' }}>
                                <img
                                    src={qrData.qrUrl}
                                    alt="VietQR"
                                    className="w-52 h-52 object-contain"
                                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                            </div>
                        </div>

                        {/* Transfer info table */}
                        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e2e8f0' }}>
                            <div className="px-4 py-2.5 flex justify-between items-center" style={{ background: '#f8fafc' }}>
                                <span className="text-xs" style={{ color: C.gray }}>{t('provider.topup.bank')}</span>
                                <span className="text-sm font-bold" style={{ color: C.navy }}>{qrData.bankCode}</span>
                            </div>
                            <div className="px-4 py-2.5 flex justify-between items-center border-t" style={{ borderColor: '#e2e8f0' }}>
                                <span className="text-xs" style={{ color: C.gray }}>{t('provider.topup.accountNumber')}</span>
                                <span className="text-sm font-bold" style={{ color: C.navy }}>{qrData.bankAccount}</span>
                            </div>
                            <div className="px-4 py-2.5 flex justify-between items-center border-t" style={{ borderColor: '#e2e8f0' }}>
                                <span className="text-xs" style={{ color: C.gray }}>{t('provider.topup.amount2')}</span>
                                <span className="text-sm font-bold" style={{ color: '#16a34a' }}>{formatVndFull(qrData.amount)}</span>
                            </div>
                            <div className="px-4 py-2.5 border-t" style={{ borderColor: '#e2e8f0' }}>
                                <div className="flex justify-between items-center mb-1.5">
                                    <span className="text-xs" style={{ color: C.gray }}>{t('provider.topup.transferContent')}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span
                                        className="flex-1 text-center py-1.5 rounded-lg text-sm font-bold font-mono tracking-widest"
                                        style={{ background: '#fef9c3', color: '#92400e', border: '1px dashed #fde68a' }}
                                    >
                                        {qrData.transferCode}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => navigator.clipboard?.writeText(qrData.transferCode)}
                                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-gray-200"
                                        style={{ background: '#f1f5f9', color: C.gray }}
                                    >
                                        Copy
                                    </button>
                                </div>
                                {qrData.topupTxnCode && (
                                    <p className="text-[10px] mt-2 text-center font-mono font-semibold" style={{ color: C.navy }}>
                                        Mã lệnh nạp: {qrData.topupTxnCode}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Countdown + waiting strip */}
                        <div className="rounded-xl overflow-hidden" style={{ border: `1.5px solid ${countdownColor}22` }}>
                            <div className="flex items-center justify-between px-4 py-2.5" style={{ background: `${countdownColor}11` }}>
                                <div className="flex items-center gap-2">
                                    <RefreshCw style={{ width: 14, height: 14, color: countdownColor }} className="animate-spin" />
                                    <span className="text-xs font-semibold" style={{ color: countdownColor }}>{t('provider.topup.waitingConfirm')}</span>
                                </div>
                                <span className="text-sm font-bold font-mono" style={{ color: countdownColor }}>{t('provider.topup.timeLeft')}: {mins}:{secs}</span>
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{ background: '#fff1f2', color: '#ef4444', border: '1px solid #fecdd3' }}>
                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={handleClose}
                                className="flex-1 py-2.5 rounded-xl text-sm font-medium border"
                                style={{ borderColor: '#e2e8f0', color: C.gray }}
                            >
                                {t('provider.topup.cancel')}
                            </button>
                            <button
                                onClick={handleManualCheck}
                                disabled={manualChecking}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                                style={{ background: '#2563eb' }}
                            >
                                {manualChecking
                                    ? <RefreshCw className="w-4 h-4 animate-spin" />
                                    : <CheckCircle2 className="w-4 h-4" />}
                                {manualChecking ? t('provider.topup.checking') : t('provider.topup.iTransferred')}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Step 3a: Success ── */}
                {step === 'done' && (
                    <div className="p-8 text-center space-y-4">
                        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto" style={{ background: '#f0fdf4' }}>
                            <CheckCircle2 style={{ width: 40, height: 40, color: '#16a34a' }} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold mb-1" style={{ color: '#15803d' }}>{t('provider.topup.successTitle')}</h3>
                            <p className="text-sm" style={{ color: '#166534' }}>
                                {t('provider.topup.successNote')}
                            </p>
                        </div>
                        <button
                            onClick={handleClose}
                            className="w-full py-3 rounded-xl text-sm font-bold text-white"
                            style={{ background: '#16a34a' }}
                        >
                            {t('provider.topup.close')}
                        </button>
                    </div>
                )}

                {/* ── Step 3b: Expired ── */}
                {step === 'expired' && (
                    <div className="p-8 text-center space-y-4">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: '#fff7ed' }}>
                            <Clock style={{ width: 30, height: 30, color: C.orange }} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold mb-1" style={{ color: C.navy }}>{t('provider.topup.expiredTitle')}</h3>
                            <p className="text-sm" style={{ color: C.gray }}>
                                {t('provider.topup.expiredNote')}
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={handleClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium border" style={{ borderColor: '#e2e8f0', color: C.gray }}>{t('provider.topup.close')}</button>
                            <button onClick={() => { setStep('amount'); setError(''); setSecsLeft(0); }} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: C.orange }}>{t('provider.topup.retry')}</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}


// ─── Withdraw Modal ───────────────────────────────────────────────────────────
function WithdrawModal({ availableBalance, withdrawalAccounts = [], onClose, onSuccess }: {
    availableBalance: number;
    withdrawalAccounts?: Array<{
        id: string;
        accountNumber: string;
        bankName: string;
        accountHolderName: string;
        branchName?: string | null;
    }>;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const { t } = useLanguage();
    const [amount, setAmount] = useState('');
    const [withdrawalAccountId, setWithdrawalAccountId] = useState<string>(withdrawalAccounts?.[0]?.id ?? '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!withdrawalAccountId && withdrawalAccounts?.[0]?.id) {
            setWithdrawalAccountId(withdrawalAccounts[0].id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [withdrawalAccounts]);

    const numeric = parseInt(amount.replace(/\D/g, ''), 10) || 0;
    const isInsufficient = numeric > availableBalance;
    const isBelowMin = numeric > 0 && numeric < MIN_WITHDRAWAL;
    const remainingAfterWithdraw = availableBalance - numeric;
    // Providers must keep at least 100,000 VND in their wallet to receive jobs
    const MIN_REQUIRED_BALANCE = 100_000;
    const isBelowRequiredBalance = numeric > 0 && !isInsufficient && remainingAfterWithdraw < MIN_REQUIRED_BALANCE;
    const hasAccounts = (withdrawalAccounts?.length ?? 0) > 0;
    const noAccountSelected = hasAccounts && !withdrawalAccountId;

    const isDisabled = loading || numeric <= 0 || isInsufficient || isBelowMin || isBelowRequiredBalance || !hasAccounts || noAccountSelected;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isDisabled) return;
        setLoading(true);
        setError('');
        try {
            await api.post('/wallet/withdraw', {
                amount: numeric,
                withdrawalAccountId: withdrawalAccountId || undefined,
            });
            onSuccess();
        } catch (err: any) {
            setError(err?.response?.data?.message || t('provider.wallet.withdrawModal.errorDefault'));
        } finally {
            setLoading(false);
        }
    };

    const maxWithdrawableAmount = Math.max(0, availableBalance - MIN_REQUIRED_BALANCE);
    const quickAmounts = [100_000, 200_000, 500_000, 1_000_000].filter(a => a <= maxWithdrawableAmount);

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl" style={{ maxHeight: '90vh', overflowY: 'auto', paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px))' }}>
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
                    {withdrawalAccounts?.length ? (
                        <div>
                            <label className="block text-sm font-medium mb-1.5" style={{ color: C.navy }}>{t('provider.wallet.withdrawModal.receivingAccountLabel')}</label>
                            <select
                                value={withdrawalAccountId}
                                onChange={e => setWithdrawalAccountId(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                                style={{ border: `1.5px solid ${C.border}`, color: C.navy, background: 'white' }}
                            >
                                <option value="">{t('provider.wallet.withdrawModal.selectAccountPlaceholder')}</option>
                                {withdrawalAccounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>
                                        {acc.bankName} · {acc.accountNumber}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div className="flex items-start gap-2 p-3 rounded-xl text-xs" style={{ background: '#fefce8', color: '#92400e' }}>
                            <Banknote style={{ width: 14, height: 14, marginTop: 1, flexShrink: 0 }} />
                            <span>
                                {t('provider.wallet.withdrawModal.noBankAccountHint')}{' '}
                                <a
                                    href="/provider/settings#withdrawal-accounts"
                                    onClick={onClose}
                                    className="font-semibold underline"
                                    style={{ color: C.orange }}
                                >
                                    {t('provider.wallet.withdrawModal.goToSettings')}
                                </a>
                            </span>
                        </div>
                    )}

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
                                    borderColor: isInsufficient || isBelowMin || isBelowRequiredBalance ? '#fca5a5' : '#e2e8f0',
                                    color: isInsufficient || isBelowMin || isBelowRequiredBalance ? '#ef4444' : C.navy,
                                    boxShadow: 'none',
                                }}
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: C.gray }}>VND</span>
                        </div>
                        {isBelowMin && <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{t('provider.wallet.withdrawModal.belowMinHint', { amount: formatVndFull(MIN_WITHDRAWAL) })}</p>}
                        {isInsufficient && <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{t('provider.wallet.withdrawModal.overBalance')}</p>}
                        {isBelowRequiredBalance && !isInsufficient && !isBelowMin && (
                            <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />{t('provider.wallet.withdrawModal.belowRequiredHint', { amount: formatVndFull(MIN_REQUIRED_BALANCE) })}
                            </p>
                        )}
                        {!isBelowMin && !isInsufficient && !isBelowRequiredBalance && numeric > 0 && (
                            <p className="mt-1.5 text-xs" style={{ color: C.gray }}>{t('provider.wallet.withdrawModal.afterWithdraw')}: {formatVndFull(remainingAfterWithdraw)}</p>
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
                                {maxWithdrawableAmount >= MIN_WITHDRAWAL && (
                                    <button
                                        type="button"
                                        onClick={() => setAmount(maxWithdrawableAmount.toLocaleString('vi-VN'))}
                                        className="px-3 py-1.5 text-xs rounded-lg border font-medium transition-all"
                                        style={{
                                            borderColor: numeric === maxWithdrawableAmount ? C.orange : '#e2e8f0',
                                            background: numeric === maxWithdrawableAmount ? C.orangeLight : 'white',
                                            color: numeric === maxWithdrawableAmount ? C.orange : C.gray,
                                        }}
                                    >
                                        {t('provider.wallet.withdrawModal.maxWithdraw')}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {noAccountSelected && (
                        <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{ background: '#fff1f2', color: '#ef4444', border: '1px solid #fecdd3' }}>
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            {t('provider.wallet.withdrawModal.selectAccountPlaceholder')}
                        </div>
                    )}
                    {error && (
                        <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{ background: '#fff1f2', color: '#ef4444', border: '1px solid #fecdd3' }}>
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}
                        </div>
                    )}

                    <div className="p-3 rounded-xl text-xs" style={{ background: C.orangeLight, color: C.orange }}>
                        {t('provider.wallet.withdrawModal.minBalanceHint', { amount: formatVndFull(MIN_REQUIRED_BALANCE) })}
                    </div>

                    <div className="flex gap-3 pb-6 sm:pb-0">
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
function TxRow({ tx }: { tx: Transaction }) {
    const { t } = useLanguage();
    const incidentLabels: Record<string, string> = {
        BREAKDOWN: t('provider.txDetail.incidentLabels.BREAKDOWN'),
        ACCIDENT: t('provider.txDetail.incidentLabels.ACCIDENT'),
        FLAT_TIRE: t('provider.txDetail.incidentLabels.FLAT_TIRE'),
        BATTERY_DEAD: t('provider.txDetail.incidentLabels.BATTERY_DEAD'),
        OUT_OF_FUEL: t('provider.txDetail.incidentLabels.OUT_OF_FUEL'),
        LOCKED_OUT: t('provider.txDetail.incidentLabels.LOCKED_OUT'),
        OTHER: t('provider.txDetail.incidentLabels.OTHER'),
    };
    const [expanded, setExpanded] = useState(false);
    const [jobDetails, setJobDetails] = useState<any>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    const isCredit = tx.type === 'CREDIT';

    const extractCommissionRate = (desc?: string | null): number | null => {
        const d = String(desc ?? '');
        const m = d.match(/(\d+(?:\.\d+)?)\s*%/);
        if (!m) return null;
        const p = parseFloat(m[1]);
        if (!Number.isFinite(p) || p < 0 || p > 100) return null;
        return p / 100;
    };

    // Build a translated description based on referenceType (avoids raw backend Vietnamese strings)
    const txDescription = (() => {
        const rmoMatch = tx.description?.match(/RMO-[A-Z0-9-]+/i);
        const refCodeFromDesc = rmoMatch ? rmoMatch[0] : null;

        const jobRef =
            jobDetails?.id && tx.referenceId === jobDetails.id
                ? displayOrderCode(jobDetails.orderCode, jobDetails.id)
                : (tx as any).orderCode 
                    ? displayOrderCode((tx as any).orderCode, tx.referenceId)
                    : (refCodeFromDesc || (tx.referenceId?.slice(0, 8).toUpperCase() ?? ''));
        
        const shortId = jobRef || (tx.referenceId?.slice(0, 8).toUpperCase() ?? '');
        const envRate = Math.round((Number(process.env.NEXT_PUBLIC_COMMISSION_RATE) || 0.2) * 100);
        switch (tx.referenceType) {
            case 'COMMISSION': {
                const parsedRate = extractCommissionRate(tx.description);
                const rateStr = String(parsedRate !== null ? Math.round(parsedRate * 100) : envRate);
                return t('provider.wallet.txDesc.commission').replace('{id}', shortId).replace('{rate}', rateStr);
            }
            case 'JOB_PAYMENT': {
                const jobId = shortId;
                const key = isJobPaymentQrProviderTx(tx.description)
                    ? 'provider.wallet.txDesc.jobPaymentQr'
                    : 'provider.wallet.txDesc.jobPaymentWallet';
                const parsedRate = extractCommissionRate(tx.description);
                const rateStr = String(parsedRate !== null ? Math.round(parsedRate * 100) : envRate);
                return t(key).replace('{id}', jobId).replace('{rate}', rateStr);
            }
            case 'TOPUP': {
                const code = tx.description?.split('·')[1]?.trim() ?? shortId;
                return t('provider.wallet.txDesc.topup').replace('{code}', code);
            }
            case 'WITHDRAW':
                return t('provider.wallet.txDesc.withdraw').replace('{id}', shortId);
            default:
                return null; // fall through to refLabel
        }
    })();

    const refLabel: Record<Transaction['referenceType'], string> = {
        JOB: t('provider.wallet.refLabel.JOB'),
        JOB_PAYMENT: t('provider.wallet.refLabel.JOB_PAYMENT'),
        WITHDRAW: t('provider.wallet.refLabel.WITHDRAW'),
        COMMISSION: t('provider.wallet.refLabel.COMMISSION'),
        REFUND: t('provider.wallet.refLabel.REFUND'),
        ADJUSTMENT: t('provider.wallet.refLabel.ADJUSTMENT'),
        TOPUP: t('provider.wallet.refLabel.TOPUP'),
    };
    const statusConfig = {
        PENDING: { label: t('provider.wallet.txStatus.PENDING'), bg: '#fefce8', color: '#ca8a04', Icon: Clock },
        COMPLETED: { label: t('provider.wallet.txStatus.COMPLETED'), bg: '#f0fdf4', color: '#16a34a', Icon: CheckCircle2 },
        FAILED: { label: t('provider.wallet.txStatus.FAILED'), bg: '#fff1f2', color: '#ef4444', Icon: XCircle },
    }[tx.status];
    const { Icon } = statusConfig;

    const canFetchDetails = (tx.referenceType === 'JOB' || tx.referenceType === 'JOB_PAYMENT' || tx.referenceType === 'COMMISSION') && tx.referenceId;

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
                        {txDescription ?? refLabel[tx.referenceType]}
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
                            <span className="text-xs" style={{ color: C.gray }}>{t('provider.txDetail.loading')}</span>
                        </div>
                    ) : jobDetails ? (
                        <div className="px-3 pt-3 space-y-2">
                            {/* Header label */}
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: C.orange }}>
                                {t('provider.txDetail.title')}
                            </p>

                            {/* Not payment-only: full request data */}
                            {!jobDetails._paymentOnly && (
                                <>
                                    {jobDetails.incidentType && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs" style={{ color: C.gray }}>{t('provider.txDetail.labels.incidentType')}</span>
                                            <span className="text-xs font-semibold" style={{ color: C.navy }}>
                                                {incidentLabels[jobDetails.incidentType] || jobDetails.incidentType}
                                            </span>
                                        </div>
                                    )}
                                    {(jobDetails.requesterType === 'GUEST' || jobDetails.user?.name || jobDetails.user?.fullName) && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs" style={{ color: C.gray }}>
                                                {jobDetails.requesterType === 'GUEST'
                                                    ? t('provider.txDetail.labels.walkInGuest')
                                                    : t('provider.txDetail.labels.customer')}
                                            </span>
                                            <span className="text-xs font-semibold" style={{ color: C.navy }}>
                                                {jobDetails.requesterType === 'GUEST'
                                                    ? (jobDetails.user?.fullName || jobDetails.user?.name || t('provider.requestDetail.walkInGuest'))
                                                    : (jobDetails.user?.fullName || jobDetails.user?.name)}
                                            </span>
                                        </div>
                                    )}
                                    {jobDetails.pickupLocation?.addressText && (
                                        <div className="flex justify-between items-start gap-4">
                                            <span className="text-xs flex-shrink-0" style={{ color: C.gray }}>{t('provider.wallet.txRow.location')}</span>
                                            <span className="text-xs font-semibold text-right" style={{ color: C.navy }}>
                                                {jobDetails.pickupLocation.addressText}
                                            </span>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Payment section */}
                            <div className="pt-2 mt-2" style={{ borderTop: '1px solid #e2e8f0' }}>
                                {tx.referenceType === 'JOB_PAYMENT' ? (() => {
                                    const rate = extractCommissionRate(tx.description) ?? 0.2;
                                    const grossAmount = rate >= 1 ? tx.amount : Math.round(tx.amount / (1 - rate));
                                    const commissionAmount = grossAmount - tx.amount;
                                    return (
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs" style={{ color: C.gray }}>{t('provider.txDetail.labels.grossRevenue')}</span>
                                                <span className="text-xs font-semibold" style={{ color: C.navy }}>{formatVndFull(grossAmount)}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs" style={{ color: C.gray }}>
                                                    {t('provider.txDetail.payment.platformFeeWithRate').replace('{rate}', String(Math.round(rate * 100)))}
                                                </span>
                                                <span className="text-xs font-semibold" style={{ color: '#ef4444' }}>−{formatVndFull(commissionAmount)}</span>
                                            </div>
                                            <div className="flex justify-between items-center pt-1" style={{ borderTop: '1px dashed #e2e8f0' }}>
                                                <span className="text-xs font-semibold" style={{ color: C.gray }}>{t('provider.txDetail.payment.netReceived')}</span>
                                                <span className="text-sm font-bold" style={{ color: '#16a34a' }}>+{formatVndFull(tx.amount)}</span>
                                            </div>
                                        </div>
                                    );
                                })() : (
                                    <>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs" style={{ color: C.gray }}>
                                                {tx.referenceType === 'COMMISSION' ? t('provider.wallet.refLabel.COMMISSION') : t('provider.wallet.txRow.transactionAmount')}
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
                                                <span className="text-xs" style={{ color: C.gray }}>{t('provider.txDetail.labels.grossRevenue')}</span>
                                                <span className="text-xs font-semibold" style={{ color: C.navy }}>
                                                    {formatVndFull(jobDetails.totalAmount)}
                                                </span>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Transaction ID */}
                            <div className="flex items-center justify-between pt-1">
                                <span className="text-[10px] font-mono" style={{ color: '#94a3b8' }}>
                                    {displayWalletTxnCode(tx.txnCode, tx.id)}
                                </span>
                                <button
                                    onClick={e => { e.stopPropagation(); window.location.href = `/provider/wallet/tx/${tx.id}`; }}
                                    className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg"
                                    style={{ background: C.orangeLight, color: C.orange }}
                                >
                                    <ExternalLink style={{ width: 10, height: 10 }} />
                                    {t('provider.wallet.txRow.viewDetails')}
                                </button>
                            </div>
                        </div>
                    ) : canFetchDetails ? (
                        <div className="flex items-center justify-center py-3 gap-2">
                            <span className="text-xs" style={{ color: C.gray }}>{t('provider.wallet.txRow.cannotLoadDetails')}</span>
                        </div>
                    ) : (
                        <div className="px-3 pt-3 space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: C.orange }}>
                                {t('provider.txDetail.title')}
                            </p>
                            <div className="flex justify-between items-center">
                                <span className="text-xs" style={{ color: C.gray }}>{t('provider.txDetail.rowLabels.type')}</span>
                                <span className="text-xs font-semibold" style={{ color: C.navy }}>
                                    {refLabel[tx.referenceType]}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs" style={{ color: C.gray }}>{t('provider.txDetail.labels.amount')}</span>
                                <span className="text-sm font-bold" style={{ color: isCredit ? '#16a34a' : '#ef4444' }}>
                                    {isCredit ? '+' : '-'}{formatVndFull(tx.amount)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs" style={{ color: C.gray }}>{t('provider.wallet.txRow.txCode')}</span>
                                <span className="text-[10px] font-mono" style={{ color: '#94a3b8' }}>
                                    {displayWalletTxnCode(tx.txnCode, tx.id)}
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

    const [wallet, setWallet] = useState<WalletData | null>(null);
    const [txData, setTxData] = useState<TransactionsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [txLoading, setTxLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [withdrawalAccounts, setWithdrawalAccounts] = useState<Array<{
        id: string;
        accountNumber: string;
        bankCode?: string | null;
        bankName: string;
        branchName?: string | null;
        accountHolderName: string;
    }>>([]);
    const [showTopup, setShowTopup] = useState(false);
    const [page, setPage] = useState(0);
    const [showAll, setShowAll] = useState(false);
    type PendingTopupData = {
        topupTxId: string; topupTxnCode?: string; transferCode: string; qrUrl: string;
        bankAccount: string; bankCode: string; amount: number; expireAt: string;
    };
    const [pendingTopup, setPendingTopup] = useState<PendingTopupData | null>(null);

    const loadWallet = useCallback(async () => {
        try {
            const [walletRes, pendingRes, accountsRes] = await Promise.all([
                api.get('/wallet/me'),
                api.get('/wallet/topup/pending').catch(() => ({ data: null })),
                api.get('/me/provider/withdrawal-accounts').catch(() => ({ data: [] })),
            ]);
            setWallet(walletRes.data);
            setPendingTopup(pendingRes.data);
            const list = accountsRes?.data?.data ?? accountsRes?.data;
            setWithdrawalAccounts(Array.isArray(list) ? list : []);
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

    // ── Guard: APPROVED only ──────────────────────────────────────────────────
    if (isReady && user && user.verificationStatus === 'PENDING') return <PendingVerificationScreen />;

    if (isReady && user && user.verificationStatus !== 'APPROVED') {
        return (
            <div className="min-h-screen flex items-center justify-center p-4" style={{ background: C.bg }}>
                <div className="bg-white rounded-2xl shadow-sm p-8 max-w-sm w-full text-center" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.08)' }}>
                    <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: C.orangeLight }}>
                        <ShieldX style={{ width: 24, height: 24, color: C.orange }} />
                    </div>
                    <h2 className="text-lg font-bold mb-2" style={{ color: C.navy }}>{t('provider.wallet.notVerified')}</h2>
                    <p className="text-sm mb-5" style={{ color: C.gray }}>{t('provider.wallet.notVerifiedDesc')}</p>
                    <button onClick={() => router.push('/provider/onboarding')} className="w-full py-2.5 rounded-xl text-white text-sm font-semibold mb-2" style={{ background: C.orange }}>{t('provider.wallet.completeVerification')}</button>
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
        <ProviderLayout activeTab="/provider/wallet">

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
                        <RescueMeLogo size={24} textClass="hidden" />
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
                    <AvatarImage
                        name={displayName}
                        avatar={user?.avatar}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        fallbackBackground={C.orange}
                        initialsCount={1}
                    />
                </div>
            </header>

            {/* ── Body ── */}
            <div className="p-4 md:p-6 max-w-3xl mx-auto w-full space-y-4">

                {/* Hero balance banner */}
                <div className="rounded-2xl p-6 text-white relative overflow-hidden" style={{ background: C.navy, boxShadow: '0 8px 24px rgba(26,26,46,0.15)' }}>
                    {/* Subtle flat aesthetic shapes instead of gradients */}
                    <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full border-[16px] border-white opacity-5 pointer-events-none" />
                    <div className="absolute -bottom-16 -right-8 w-40 h-40 rounded-full border-[16px] border-white opacity-5 pointer-events-none" />

                    <div className="relative z-10">
                        <p className="text-sm opacity-80 mb-1">{t('provider.wallet.totalBalance')}</p>
                        <p className="text-4xl font-bold tabular-nums mb-4">{formatVndFull(total)}</p>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 sm:gap-0">
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
                            <div className="flex items-center gap-2 w-full sm:w-auto mt-1 sm:mt-0">
                                <button
                                    onClick={() => setShowTopup(true)}
                                    className="flex-1 sm:flex-auto flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-xl text-sm font-bold transition-all hover:bg-white/10"
                                    style={{ background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
                                >
                                    <Plus style={{ width: 16, height: 16 }} />
                                    {t('provider.wallet.deposit')}
                                </button>
                                <button
                                    onClick={() => setShowModal(true)}
                                    disabled={!wallet || available < MIN_WITHDRAWAL}
                                    className="flex-1 sm:flex-auto flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-xl text-sm font-bold transition-all hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed"
                                    style={{ background: C.orange, color: 'white', border: `1px solid ${C.orangeDark}` }}
                                >
                                    <Banknote style={{ width: 16, height: 16 }} />
                                    {t('provider.wallet.withdraw')}
                                </button>
                            </div>
                        </div>
                        {available < MIN_WITHDRAWAL && (
                            <p className="mt-3 text-xs opacity-70 flex items-center gap-1">
                                <AlertCircle style={{ width: 12, height: 12 }} />
                                {t('provider.wallet.needMinimum').replace('{amount}', formatVndFull(MIN_WITHDRAWAL))}
                            </p>
                        )}
                    </div>
                </div>

                {/* Balance detail cards */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: C.orangeLight }}>
                            <Wallet style={{ width: 18, height: 18, color: C.orange }} />
                        </div>
                        <p className="text-xs mb-1" style={{ color: C.gray }}>{t('provider.wallet.availableBalance')}</p>
                        <p className="text-xl font-bold tabular-nums" style={{ color: C.navy }}>{formatVndFull(available)}</p>
                        <p className="text-xs mt-1" style={{ color: C.gray }}>{t('provider.wallet.withdrawableNow')}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: '#f1f5f9' }}>
                            <Clock style={{ width: 18, height: 18, color: '#64748b' }} />
                        </div>
                        <p className="text-xs mb-1" style={{ color: C.gray }}>{t('provider.wallet.pendingBalance')}</p>
                        <p className="text-xl font-bold tabular-nums" style={{ color: C.navy }}>{formatVndFull(pending)}</p>
                        <p className="text-xs mt-1" style={{ color: C.gray }}>{t('provider.wallet.disbursed24h')}</p>
                    </div>
                </div>

                {/* Pending topup resume banner */}
                {pendingTopup && !showTopup && (
                    <div
                        className="rounded-xl overflow-hidden mb-4 cursor-pointer"
                        style={{ border: '1.5px solid #bfdbfe', background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' }}
                        onClick={() => setShowTopup(true)}
                    >
                        <div className="flex items-center justify-between px-4 py-3">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#2563eb' }}>
                                    <QrCode style={{ width: 16, height: 16, color: 'white' }} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold" style={{ color: '#1e40af' }}>{t('provider.wallet.pendingTopup.waiting')}</p>
                                    <p className="text-xs" style={{ color: '#3b82f6' }}>{formatVndFull(pendingTopup.amount)} • {t('provider.wallet.pendingTopup.expiresAt')} {new Date(pendingTopup.expireAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                            </div>
                            <button
                                className="px-3 py-1.5 rounded-lg text-xs font-bold text-white flex-shrink-0"
                                style={{ background: '#2563eb' }}
                            >
                                {t('provider.wallet.pendingTopup.continue')}
                            </button>
                        </div>
                    </div>
                )}

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

            {/* Withdraw Modal */}
            {showModal && wallet && (
                <WithdrawModal
                    availableBalance={available}
                    withdrawalAccounts={withdrawalAccounts}
                    onClose={() => setShowModal(false)}
                    onSuccess={() => { setShowModal(false); loadWallet(); loadTransactions(0); }}
                />
            )}

            {/* Topup Modal */}
            {showTopup && (
                <TopupModal
                    availableBalance={available}
                    minTopup={wallet?.hasActivated ? 10_000 : MIN_TOPUP}
                    initialQrData={pendingTopup ?? undefined}
                    onClose={() => {
                        setShowTopup(false);
                        api.get('/wallet/topup/pending').catch(() => ({ data: null })).then(r => setPendingTopup(r.data));
                    }}
                    onSuccess={() => { setPendingTopup(null); loadWallet(); loadTransactions(0); }}
                />
            )}
        </ProviderLayout>
    );
}
