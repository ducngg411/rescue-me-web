'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Wallet, ArrowDownCircle, ArrowUpCircle, Clock, CheckCircle2,
    XCircle, RefreshCw, TrendingUp, Banknote, ChevronDown, ChevronUp,
    AlertCircle, ArrowLeft, QrCode, Plus,
} from 'lucide-react';
import { useUserGuard } from '@/lib/guards';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import AvatarImage from '@/components/AvatarImage';
import api from '@/lib/api';
import { displayWalletTxnCode } from '@/lib/reconciliation';
import RescueMeLogo from '@/components/RescueMeLogo';
import { useRouter } from 'next/navigation';
import { useUserDisputeNavBadge } from '@/contexts/UserDisputeNavBadgeContext';

// ─── Colors ──────────────────────────────────────────────────────────────────
const C = {
    orange: '#f97316',
    orangeDark: '#ea6c0a',
    orangeLight: '#fff7ed',
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#f1f5f9',
    bg: '#f8fafc',
};

// ─── Constants ───────────────────────────────────────────────────────────────
const MIN_WITHDRAWAL = 50_000;
const MIN_TOPUP = 1;
const TOPUP_QUICK_AMOUNTS = [100_000, 200_000, 500_000, 1_000_000, 2_000_000];
const PAGE_SIZE = 15;

// ─── Helpers ─────────────────────────────────────────────────────────────────
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

// ─── Types ───────────────────────────────────────────────────────────────────
interface UserWalletData {
    id: string;
    availableBalance: number;
    pendingBalance: number;
    createdAt: string;
    updatedAt: string;
}

interface UserTransaction {
    id: string;
    txnCode?: string | null;
    type: 'CREDIT' | 'DEBIT';
    amount: number;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    referenceType: 'TOPUP' | 'JOB_PAYMENT' | 'REFUND' | 'WITHDRAW' | 'ADJUSTMENT';
    referenceId: string;
    description: string | null;
    createdAt: string;
}

interface TransactionsResponse {
    items: UserTransaction[];
    total: number;
    skip: number;
    take: number;
}

// ─── Topup Modal ─────────────────────────────────────────────────────────────
function TopupModal({ initialQrData, onClose, onSuccess, t }: {
    initialQrData?: {
        topupTxId: string; topupTxnCode?: string; transferCode: string; qrUrl: string;
        bankAccount: string; bankCode: string; amount: number; expireAt: string;
    };
    onClose: () => void;
    onSuccess: () => void;
    t: any;
}) {
    type Step = 'amount' | 'qr' | 'done' | 'expired';
    const [step, setStep] = useState<Step>(initialQrData ? 'qr' : 'amount');
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [manualChecking, setManualChecking] = useState(false);
    const [error, setError] = useState('');
    const [qrData, setQrData] = useState<typeof initialQrData | null>(initialQrData ?? null);
    const [secsLeft, setSecsLeft] = useState(0);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const numeric = parseInt(amount.replace(/\D/g, ''), 10) || 0;
    const isDisabled = loading || numeric <= 0;

    const stopAll = () => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    };

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
        if (status === 'COMPLETED') { stopAll(); setStep('done'); onSuccess(); }
        else if (status === 'EXPIRED' || status === 'FAILED' || status === 'CANCELLED') { stopAll(); setStep('expired'); }
    };

    const startPolling = (txId: string) => {
        pollRef.current = setInterval(async () => {
            try {
                const res = await api.get(`/user-wallet/topup/${txId}/status`);
                handlePollResponse(res.data.status);
            } catch { /* ignore */ }
        }, 3000);
    };

    const handleInit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isDisabled) return;
        setLoading(true); setError('');
        try {
            const res = await api.post('/user-wallet/topup/init', { amount: numeric });
            setQrData(res.data);
            setStep('qr');
            startPolling(res.data.topupTxId);
            startCountdown(res.data.expireAt);
        } catch (err: any) {
            setError(err?.response?.data?.message || t('user.wallet.topupModal.errors.createFailed'));
        } finally { setLoading(false); }
    };

    const handleManualCheck = async () => {
        if (!qrData) return;
        setManualChecking(true); setError('');
        try {
            const res = await api.get(`/user-wallet/topup/${qrData.topupTxId}/status`);
            handlePollResponse(res.data.status);
            if (res.data.status === 'PENDING') setError(t('user.wallet.topupModal.errors.paymentNotReceived'));
        } catch { setError(t('user.wallet.topupModal.errors.checkFailed')); }
        finally { setManualChecking(false); }
    };

    const handleClose = () => { stopAll(); onClose(); };

    const mins = String(Math.floor(secsLeft / 60)).padStart(2, '0');
    const secs = String(secsLeft % 60).padStart(2, '0');
    const countdownColor = secsLeft < 60 ? '#ef4444' : secsLeft < 120 ? '#f97316' : '#16a34a';

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="flex justify-center pt-3 pb-1 sm:hidden">
                    <div className="w-10 h-1 rounded-full bg-gray-200" />
                </div>

                <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: C.border }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#eff6ff' }}>
                        <QrCode style={{ width: 20, height: 20, color: '#2563eb' }} />
                    </div>
                    <div className="flex-1">
                        <p className="font-bold text-base" style={{ color: C.navy }}>{t('user.wallet.topupModal.title')}</p>
                        <p className="text-xs" style={{ color: C.gray }}>{t('user.wallet.topupModal.method')}</p>
                    </div>
                    {step !== 'done' && (
                        <button onClick={handleClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.bg, color: C.gray }}>
                            <XCircle style={{ width: 18, height: 18 }} />
                        </button>
                    )}
                </div>

                <div className="px-6 py-5">

                    {/* Step: Amount */}
                    {step === 'amount' && (
                        <form onSubmit={handleInit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: C.gray }}>{t('user.wallet.topupModal.amountLabel')}</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={amount ? new Intl.NumberFormat('vi-VN').format(parseInt(amount.replace(/\D/g, ''), 10) || 0) : ''}
                                        onChange={e => setAmount(e.target.value.replace(/\D/g, ''))}
                                        placeholder="100.000"
                                        className="w-full px-4 py-3 pr-8 rounded-xl border text-sm font-medium"
                                        style={{ borderColor: C.border, outline: 'none' }}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: C.gray }}>₫</span>
                                </div>
                                {numeric > 0 && (
                                    <p className="text-xs mt-1" style={{ color: C.gray }}>
                                        {t('user.wallet.topupModal.balanceAfter')}<strong style={{ color: C.navy }}>{formatVndFull(numeric)}</strong>
                                    </p>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {TOPUP_QUICK_AMOUNTS.map(a => (
                                    <button type="button" key={a}
                                        onClick={() => setAmount(String(a))}
                                        className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                                        style={{
                                            background: numeric === a ? C.orange : 'white',
                                            color: numeric === a ? 'white' : C.gray,
                                            borderColor: numeric === a ? C.orange : C.border,
                                        }}
                                    >
                                        {formatVnd(a)}
                                    </button>
                                ))}
                            </div>

                            {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle style={{ width: 12, height: 12 }} />{error}</p>}

                            <button
                                type="submit" disabled={isDisabled}
                                className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-40"
                                style={{ background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)` }}
                            >
                                {loading ? t('user.wallet.topupModal.generatingQR') : t('user.wallet.topupModal.createQR')}
                            </button>
                        </form>
                    )}

                    {/* Step: QR */}
                    {step === 'qr' && qrData && (
                        <div className="space-y-4">
                            <div className="rounded-xl p-3 border text-center" style={{ borderColor: '#bfdbfe', background: '#eff6ff' }}>
                                <p className="text-xs font-semibold mb-0.5" style={{ color: '#1e40af' }}>{t('user.wallet.topupModal.transferAmount')}</p>
                                <p className="text-2xl font-bold" style={{ color: '#1e40af' }}>{formatVndFull(qrData.amount)}</p>
                                <div className="flex items-center justify-center gap-1.5 mt-1">
                                    <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: countdownColor }} />
                                    <p className="text-xs font-mono font-semibold" style={{ color: countdownColor }}>
                                        {t('user.wallet.topupModal.expiresIn').replace('{mins}', mins).replace('{secs}', secs)}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col items-center gap-3">
                                {qrData.qrUrl && (
                                    <img src={qrData.qrUrl} alt="VietQR" className="w-56 h-56 rounded-xl border object-contain" style={{ borderColor: C.border }} />
                                )}
                                <div className="w-full rounded-xl p-3 border space-y-2 text-xs" style={{ background: C.bg, borderColor: C.border }}>
                                    <div className="flex justify-between">
                                        <span style={{ color: C.gray }}>{t('user.wallet.topupModal.bank')}</span>
                                        <span className="font-semibold" style={{ color: C.navy }}>{qrData.bankCode}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span style={{ color: C.gray }}>{t('user.wallet.topupModal.accountNumber')}</span>
                                        <span className="font-semibold font-mono" style={{ color: C.navy }}>{qrData.bankAccount}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span style={{ color: C.gray }}>{t('user.wallet.topupModal.transferContent')}</span>
                                        <span className="font-bold uppercase text-sm tracking-wider" style={{ color: C.orange }}>{qrData.transferCode}</span>
                                    </div>
                                    {qrData.topupTxnCode && (
                                        <div className="flex justify-between items-center">
                                            <span style={{ color: C.gray }}>Mã lệnh nạp</span>
                                            <span className="font-mono font-semibold text-xs" style={{ color: C.navy }}>{qrData.topupTxnCode}</span>
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-center" style={{ color: '#ef4444' }}>
                                    {t('user.wallet.topupModal.warningNote')}
                                </p>
                            </div>

                            {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle style={{ width: 12, height: 12 }} />{error}</p>}

                            <div className="flex gap-2">
                                <button onClick={handleClose} className="flex-1 py-2.5 rounded-xl text-sm border font-medium" style={{ borderColor: C.border, color: C.gray }}>
                                    {t('user.wallet.topupModal.close')}
                                </button>
                                <button
                                    onClick={handleManualCheck} disabled={manualChecking}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                                    style={{ background: C.orange }}
                                >
                                    {manualChecking ? t('user.wallet.topupModal.checking') : t('user.wallet.topupModal.transferred')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step: Done */}
                    {step === 'done' && (
                        <div className="text-center py-4 space-y-4">
                            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: '#f0fdf4' }}>
                                <CheckCircle2 style={{ width: 32, height: 32, color: '#16a34a' }} />
                            </div>
                            <div>
                                <p className="font-bold text-lg" style={{ color: C.navy }}>{t('user.wallet.topupModal.successTitle')}</p>
                                <p className="text-sm mt-1" style={{ color: C.gray }}>{t('user.wallet.topupModal.successSubtitle')}</p>
                            </div>
                            <button onClick={handleClose} className="w-full py-3 rounded-xl font-semibold text-white text-sm" style={{ background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})` }}>
                                {t('user.wallet.topupModal.done')}
                            </button>
                        </div>
                    )}

                    {/* Step: Expired */}
                    {step === 'expired' && (
                        <div className="text-center py-4 space-y-4">
                            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: '#fefce8' }}>
                                <AlertCircle style={{ width: 32, height: 32, color: '#ca8a04' }} />
                            </div>
                            <div>
                                <p className="font-bold text-lg" style={{ color: C.navy }}>{t('user.wallet.topupModal.expiredTitle')}</p>
                                <p className="text-sm mt-1" style={{ color: C.gray }}>{t('user.wallet.topupModal.expiredSubtitle')}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handleClose} className="flex-1 py-2.5 rounded-xl text-sm border font-medium" style={{ borderColor: C.border, color: C.gray }}>{t('user.wallet.topupModal.close')}</button>
                                <button onClick={() => { setStep('amount'); setQrData(null); setError(''); }} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: C.orange }}>{t('user.wallet.topupModal.createNewCode')}</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Withdraw Modal ───────────────────────────────────────────────────────────
function WithdrawModal({ availableBalance, withdrawalAccounts, onClose, onSuccess, t }: {
    availableBalance: number;
    withdrawalAccounts: Array<{
        id: string;
        accountNumber: string;
        bankName: string;
        accountHolderName: string;
        branchName?: string | null;
    }>;
    onClose: () => void;
    onSuccess: () => void;
    t: any;
}) {
    const [rawAmount, setRawAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [withdrawalAccountId, setWithdrawalAccountId] = useState<string>(withdrawalAccounts?.[0]?.id ?? '');
    const amount = parseInt(rawAmount.replace(/\D/g, ''), 10) || 0;
    const isBelowMin = amount > 0 && amount < MIN_WITHDRAWAL;
    const isOverBalance = amount > availableBalance;
    const hasAccounts = (withdrawalAccounts?.length ?? 0) > 0;
    const noAccountSelected = hasAccounts && !withdrawalAccountId;
    const isDisabled = loading || amount < MIN_WITHDRAWAL || isOverBalance || !hasAccounts || noAccountSelected;
    const QUICK = [50_000, 100_000, 200_000, 500_000].filter(q => q <= availableBalance);

    const handleWithdraw = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isDisabled) return;
        setLoading(true); setError('');
        try {
            await api.post('/user-wallet/withdraw', {
                amount,
                withdrawalAccountId: withdrawalAccountId || undefined,
            });
            onSuccess();
        } catch (err: any) {
            setError(err?.response?.data?.message || t('user.wallet.withdrawModal.errors.withdrawFailed'));
        } finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
                <div className="flex justify-center pt-3 pb-1 sm:hidden">
                    <div className="w-10 h-1 rounded-full bg-gray-200" />
                </div>

                <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: C.border }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: C.orangeLight }}>
                        <Banknote style={{ width: 20, height: 20, color: C.orange }} />
                    </div>
                    <div className="flex-1">
                        <p className="font-bold text-base" style={{ color: C.navy }}>{t('user.wallet.withdrawModal.title')}</p>
                        <p className="text-xs" style={{ color: C.gray }}>{t('user.wallet.withdrawModal.available')}<strong>{formatVndFull(availableBalance)}</strong></p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.bg, color: C.gray }}>
                        <XCircle style={{ width: 18, height: 18 }} />
                    </button>
                </div>

                <form onSubmit={handleWithdraw} className="px-6 py-5 space-y-4">
                    {withdrawalAccounts?.length ? (
                        <div>
                            <label className="block text-xs font-semibold mb-1.5" style={{ color: C.gray }}>
                                {t('user.wallet.withdrawModal.receivingAccountLabel')}
                            </label>
                            <select
                                value={withdrawalAccountId}
                                onChange={e => setWithdrawalAccountId(e.target.value)}
                                className="w-full px-3 py-3 rounded-xl border text-sm font-medium"
                                style={{ borderColor: C.border, outline: 'none', background: 'white', color: C.navy }}
                            >
                                <option value="">{t('user.wallet.withdrawModal.selectAccountPlaceholder')}</option>
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
                                {t('user.wallet.withdrawModal.noBankAccountHint')}{' '}
                                <a
                                    href="/user/settings#withdrawal-accounts"
                                    onClick={onClose}
                                    className="font-semibold underline"
                                    style={{ color: C.orange }}
                                >
                                    {t('user.wallet.withdrawModal.goToSettings')}
                                </a>
                            </span>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: C.gray }}>{t('user.wallet.withdrawModal.amountLabel')}</label>
                        <div className="relative">
                            <input
                                type="text" inputMode="numeric"
                                value={rawAmount ? new Intl.NumberFormat('vi-VN').format(parseInt(rawAmount.replace(/\D/g, ''), 10) || 0) : ''}
                                onChange={e => setRawAmount(e.target.value.replace(/\D/g, ''))}
                                placeholder="50.000"
                                className="w-full px-4 py-3 pr-8 rounded-xl border text-sm font-medium"
                                style={{ borderColor: (isBelowMin || isOverBalance) ? '#ef4444' : C.border, outline: 'none' }}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: C.gray }}>₫</span>
                        </div>
                        {isBelowMin && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{t('user.wallet.withdrawModal.minAmount').replace('{amount}', formatVnd(MIN_WITHDRAWAL))}</p>}
                        {isOverBalance && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{t('user.wallet.withdrawModal.overBalance')}</p>}
                        {amount >= MIN_WITHDRAWAL && !isOverBalance && (
                            <p className="text-xs mt-1" style={{ color: C.gray }}>
                                {t('user.wallet.withdrawModal.balanceAfter')}<strong style={{ color: C.navy }}>{formatVndFull(availableBalance - amount)}</strong>
                            </p>
                        )}
                    </div>

                    {QUICK.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            <span className="text-xs" style={{ color: C.gray, alignSelf: 'center' }}>{t('user.wallet.withdrawModal.quickSelect')}</span>
                            {QUICK.map(q => (
                                <button type="button" key={q}
                                    onClick={() => setRawAmount(String(q))}
                                    className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                                    style={{
                                        background: amount === q ? C.orange : 'white',
                                        color: amount === q ? 'white' : C.gray,
                                        borderColor: amount === q ? C.orange : C.border,
                                    }}
                                >
                                    {formatVnd(q)}
                                </button>
                            ))}
                            <button type="button"
                                onClick={() => setRawAmount(String(availableBalance))}
                                className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                                style={{
                                    background: amount === availableBalance ? C.orange : 'white',
                                    color: amount === availableBalance ? 'white' : C.gray,
                                    borderColor: amount === availableBalance ? C.orange : C.border,
                                }}
                            >
                                {t('user.wallet.withdrawModal.all')}
                            </button>
                        </div>
                    )}

                    <div className="rounded-xl p-3 text-xs" style={{ background: '#fefce8', color: '#92400e' }}>
                        {t('user.wallet.withdrawModal.hint')}
                    </div>

                    {noAccountSelected && (
                        <p className="text-xs text-red-500 flex items-center gap-1">
                            <AlertCircle style={{ width: 12, height: 12 }} />
                            {t('user.wallet.withdrawModal.selectAccountPlaceholder')}
                        </p>
                    )}
                    {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle style={{ width: 12, height: 12 }} />{error}</p>}

                    <div className="flex gap-2 pt-1">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm border font-medium" style={{ borderColor: C.border, color: C.gray }}>
                            {t('user.wallet.withdrawModal.cancel')}
                        </button>
                        <button
                            type="submit" disabled={isDisabled}
                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                            style={{ background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})` }}
                        >
                            {loading ? t('user.wallet.withdrawModal.processing') : t('user.wallet.withdrawModal.confirm')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Transaction Row ──────────────────────────────────────────────────────────
const REF_LABEL: Record<string, string> = {
    TOPUP: 'Nạp tiền',
    JOB_PAYMENT: 'Thanh toán job',
    REFUND: 'Hoàn tiền',
    WITHDRAW: 'Rút tiền',
    ADJUSTMENT: 'Điều chỉnh',
};

const TX_STATUS_LABEL: Record<string, string> = {
    PENDING: 'Đang xử lý',
    COMPLETED: 'Hoàn thành',
    FAILED: 'Thất bại',
};

const TX_STATUS_COLOR: Record<string, string> = {
    PENDING: '#f59e0b',
    COMPLETED: '#16a34a',
    FAILED: '#ef4444',
};

function TxRow({ tx, t }: { tx: UserTransaction, t: any }) {
    const router = useRouter();
    const [expanded, setExpanded] = useState(false);
    const isCredit = tx.type === 'CREDIT';

    const iconBg = isCredit ? '#f0fdf4' : '#fef2f2';
    const iconColor = isCredit ? '#16a34a' : '#ef4444';
    const amountColor = isCredit ? '#16a34a' : '#ef4444';
    const amountText = (isCredit ? '+' : '−') + formatVndFull(tx.amount);

    return (
        <div className="border-b last:border-0" style={{ borderColor: C.border }}>
            <button
                onClick={() => setExpanded(v => !v)}
                className="w-full flex items-center gap-3 py-3.5 text-left transition-colors"
            >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
                    {isCredit
                        ? <ArrowDownCircle style={{ width: 18, height: 18, color: iconColor }} />
                        : <ArrowUpCircle style={{ width: 18, height: 18, color: iconColor }} />
                    }
                </div>

                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: C.navy }}>
                        {t('user.wallet.refLabel.' + tx.referenceType) || tx.referenceType}
                    </p>
                    <p className="text-xs" style={{ color: C.gray }}>
                        {new Date(tx.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>

                <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold" style={{ color: amountColor }}>{amountText}</p>
                    <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ background: TX_STATUS_COLOR[tx.status] + '18', color: TX_STATUS_COLOR[tx.status] }}
                    >
                        {t('user.wallet.txStatus.' + tx.status) || tx.status}
                    </span>
                </div>

                <div style={{ color: '#94a3b8' }}>
                    {expanded ? <ChevronUp style={{ width: 16, height: 16 }} /> : <ChevronDown style={{ width: 16, height: 16 }} />}
                </div>
            </button>

            {expanded && (
                <div className="pb-4 px-2 space-y-2.5 rounded-xl p-3 mb-2 text-xs" style={{ background: C.bg }}>
                    {tx.description && (
                        <div className="flex justify-between items-start gap-4">
                            <span style={{ color: C.gray }}>{t('user.wallet.txRow.note')}</span>
                            <span className="text-right font-medium max-w-[60%]" style={{ color: C.navy }}>{tx.description}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-center">
                        <span style={{ color: C.gray }}>{t('user.wallet.txRow.txType')}</span>
                        <span className="font-semibold" style={{ color: C.navy }}>{t('user.wallet.refLabel.' + tx.referenceType) || tx.referenceType}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span style={{ color: C.gray }}>{t('user.wallet.txRow.amount')}</span>
                        <span className="font-bold" style={{ color: amountColor }}>{amountText}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span style={{ color: C.gray }}>{t('user.wallet.txRow.txCode')}</span>
                        <span className="font-mono text-[10px]" style={{ color: '#94a3b8' }}>{displayWalletTxnCode(tx.txnCode, tx.id)}</span>
                    </div>
                    {tx.referenceType === 'JOB_PAYMENT' && (
                        <div className="pt-2 mt-2" style={{ borderTop: `1px dashed ${C.border}` }}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/user/requests/${tx.referenceId}`);
                                }}
                                className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-95"
                                style={{ background: C.orangeLight, color: C.orange }}
                            >
                                {t('user.wallet.txRow.viewDetails')}
                                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Nav Items ────────────────────────────────────────────────────────────────
const walletIcon = <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
const homeIcon = <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
const historyIcon = <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const settingsIcon = <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const mapIcon = <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.242-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function UserWalletPage() {
    const { isReady } = useUserGuard();
    const { user, logout } = useAuth();
    const router = useRouter();
    const { t } = useLanguage();
    const { disputeNavBadge, resetDisputeNavBadge } = useUserDisputeNavBadge();

    const [wallet, setWallet] = useState<UserWalletData | null>(null);
    const [txData, setTxData] = useState<TransactionsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [txLoading, setTxLoading] = useState(false);
    const [showTopup, setShowTopup] = useState(false);
    const [showWithdraw, setShowWithdraw] = useState(false);
    const [page, setPage] = useState(0);
    const [showAll, setShowAll] = useState(false);
    const [withdrawalAccounts, setWithdrawalAccounts] = useState<Array<{
        id: string;
        accountNumber: string;
        bankName: string;
        accountHolderName: string;
        branchName?: string | null;
    }>>([]);
    type PendingTopupData = {
        topupTxId: string; topupTxnCode?: string; transferCode: string; qrUrl: string;
        bankAccount: string; bankCode: string; amount: number; expireAt: string;
    };
    const [pendingTopup, setPendingTopup] = useState<PendingTopupData | null>(null);

    const navItems = [
        { label: t('user.nav.home'), href: '/user', icon: homeIcon },
        { label: t('user.nav.history'), href: '/user/requests', icon: historyIcon },
        { label: t('user.nav.wallet'), href: '/user/wallet', icon: walletIcon },
        { label: t('user.nav.disputes'), href: '/user/disputes', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> },
        { label: t('user.nav.map'), href: '/user/incident-map', icon: mapIcon },
        { label: t('user.nav.settings'), href: '/user/settings', icon: settingsIcon },
    ];

    const loadWallet = useCallback(async () => {
        try {
            const [walletRes, pendingRes, accountsRes] = await Promise.all([
                api.get('/user-wallet/me'),
                api.get('/user-wallet/topup/pending').catch(() => ({ data: null })),
                api.get('/me/withdrawal-accounts').catch(() => ({ data: [] })),
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
            const res = await api.get(`/user-wallet/me/transactions?skip=${skip}&take=${PAGE_SIZE}`);
            setTxData(res.data);
            setPage(skip);
        } catch { } finally { setTxLoading(false); }
    }, [wallet]);

    useEffect(() => { if (isReady) loadWallet(); }, [isReady, loadWallet]);
    useEffect(() => { if (wallet) loadTransactions(0); }, [wallet, loadTransactions]);

    const displayName = (user as any)?.name?.split(' ').slice(-1)[0] || user?.email?.split('@')[0] || 'Bạn';

    // Loading
    if (!isReady || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto mb-3" style={{ borderColor: C.orange }} />
                    <p className="text-sm" style={{ color: C.gray }}>{t('user.wallet.main.loadingWallet')}</p>
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

    return (
        <div className="min-h-screen flex" style={{ fontFamily: 'Lexend, sans-serif', background: C.bg }}>

            {/* ═══ DESKTOP Sidebar ═══ */}
            <aside
                className="hidden md:flex flex-col justify-between py-6 px-4 flex-shrink-0 sticky top-0 h-screen"
                style={{ width: '220px', background: '#ffffff', borderRight: `1px solid ${C.border}` }}
            >
                <div>
                    <div className="flex items-center gap-2 mb-8 px-2">
                        <RescueMeLogo size={28} textClass="text-base" />
                    </div>
                    <nav className="space-y-1">
                        {navItems.map(item => {
                            const active = item.href === '/user/wallet';
                            return (
                                <button
                                    key={item.label}
                                    onClick={() => {
                                        if (item.href === '/user/disputes') resetDisputeNavBadge();
                                        if (item.href !== '#') router.push(item.href);
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                                    style={{ background: active ? C.orangeLight : 'transparent', color: active ? C.orange : '#64748b' }}
                                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = C.bg; }}
                                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                >
                                    {item.icon}{item.label}
                                    {item.href === '/user/disputes' && disputeNavBadge > 0 && !active && (
                                        <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#fee2e2', color: '#dc2626' }}>
                                            {disputeNavBadge > 99 ? '99+' : disputeNavBadge}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                </div>
                {/* User chip */}
                <div className="flex items-center gap-3 px-2 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
                    <AvatarImage
                        name={displayName}
                        avatar={user?.avatar}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                        fallbackBackground={C.orange}
                        initialsCount={1}
                    />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate" style={{ color: C.navy }}>{displayName}</p>
                        <p className="text-xs" style={{ color: C.gray }}>{t('user.dashboard.customer')}</p>
                    </div>
                    <button
                        onClick={logout}
                        title="Đăng xuất"
                        className="flex-shrink-0 p-1.5 rounded-lg transition-colors hover:bg-red-50"
                        style={{ color: '#ef4444' }}
                    >
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                    </button>
                </div>
            </aside>

            {/* ═══ Main Content ═══ */}
            <div className="flex-1 flex flex-col min-w-0" style={{ paddingBottom: '64px' }}>

                {/* Header */}
                <header
                    className="flex items-center justify-between px-4 py-3 flex-shrink-0 sticky top-0 z-20"
                    style={{ background: '#ffffff', borderBottom: `1px solid ${C.border}` }}
                >
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/user')}
                            className="flex md:hidden items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-50 transition-colors"
                            style={{ color: C.navy }}
                        >
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="md:hidden flex items-center gap-2">
                            <RescueMeLogo size={24} textClass="hidden" />
                        </div>
                        <div className="flex-1 min-w-0 md:hidden">
                            <h1 className="font-bold text-base leading-tight" style={{ color: C.navy }}>{t('user.wallet.title')}</h1>
                            <p className="text-xs" style={{ color: C.gray }}>{t('user.wallet.subtitle')}</p>
                        </div>
                        <h2 className="hidden md:block text-base font-semibold" style={{ color: C.navy }}>{t('user.wallet.title')}</h2>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
                            <span className="text-xs font-medium" style={{ color: '#64748b' }}>{t('common.systemOperational')}</span>
                        </div>
                        <LanguageSwitcher />
                        <button
                            onClick={() => { setLoading(true); loadWallet(); }}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: '#94a3b8' }}
                            title="Làm mới"
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

                {/* Body */}
                <div className="p-4 md:p-6 max-w-3xl mx-auto w-full space-y-4">

                    {/* Hero Balance */}
                    <div className="rounded-2xl p-6 text-white" style={{ background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)`, boxShadow: `0 8px 24px ${C.orange}40` }}>
                        <p className="text-sm opacity-80 mb-1">{t('user.wallet.main.totalBalance')}</p>
                        <p className="text-4xl font-bold tabular-nums mb-4">{formatVndFull(total)}</p>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 sm:gap-0">
                            <div className="flex gap-6">
                                <div>
                                    <p className="text-xs opacity-70">{t('user.wallet.main.available')}</p>
                                    <p className="text-sm font-semibold">{formatVndFull(available)}</p>
                                </div>
                                <div className="w-px bg-white/20" />
                                <div>
                                    <p className="text-xs opacity-70">{t('user.wallet.main.pending')}</p>
                                    <p className="text-sm font-semibold">{formatVndFull(pending)}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto mt-1 sm:mt-0">
                                <button
                                    onClick={() => setShowTopup(true)}
                                    className="flex-1 sm:flex-auto flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-xl text-sm font-bold transition-all"
                                    style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
                                >
                                    <Plus style={{ width: 16, height: 16 }} />
                                    {t('user.wallet.main.topup')}
                                </button>
                                <button
                                    onClick={() => setShowWithdraw(true)}
                                    disabled={!wallet || available < MIN_WITHDRAWAL}
                                    className="flex-1 sm:flex-auto flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                    style={{ background: 'white', color: C.orange }}
                                >
                                    <Banknote style={{ width: 16, height: 16 }} />
                                    {t('user.wallet.main.withdraw')}
                                </button>
                            </div>
                        </div>
                        {available < MIN_WITHDRAWAL && (
                            <p className="mt-3 text-xs opacity-70 flex items-center gap-1">
                                <AlertCircle style={{ width: 12, height: 12 }} />
                                {t('user.wallet.main.minWithdraw').replace('{amount}', formatVndFull(MIN_WITHDRAWAL))}
                            </p>
                        )}
                    </div>

                    {/* Balance Cards */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white rounded-xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: '#f0fdf4' }}>
                                <Wallet style={{ width: 18, height: 18, color: '#16a34a' }} />
                            </div>
                            <p className="text-xs mb-1" style={{ color: C.gray }}>{t('user.wallet.main.availableBalance')}</p>
                            <p className="text-xl font-bold tabular-nums" style={{ color: C.navy }}>{formatVndFull(available)}</p>
                            <p className="text-xs mt-1" style={{ color: C.gray }}>{t('user.wallet.main.canWithdrawNow')}</p>
                        </div>
                        <div className="bg-white rounded-xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: '#fefce8' }}>
                                <Clock style={{ width: 18, height: 18, color: '#ca8a04' }} />
                            </div>
                            <p className="text-xs mb-1" style={{ color: C.gray }}>{t('user.wallet.main.pendingBalance')}</p>
                            <p className="text-xl font-bold tabular-nums" style={{ color: C.navy }}>{formatVndFull(pending)}</p>
                            <p className="text-xs mt-1" style={{ color: C.gray }}>{t('user.wallet.main.processing')}</p>
                        </div>
                    </div>

                    {/* Pending topup resume banner */}
                    {pendingTopup && !showTopup && (
                        <div
                            className="rounded-xl overflow-hidden cursor-pointer"
                            style={{ border: '1.5px solid #bfdbfe', background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' }}
                            onClick={() => setShowTopup(true)}
                        >
                            <div className="flex items-center justify-between px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#2563eb' }}>
                                        <QrCode style={{ width: 16, height: 16, color: 'white' }} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold" style={{ color: '#1e40af' }}>{t('user.wallet.main.pendingTopupTitle')}</p>
                                        <p className="text-xs" style={{ color: '#3b82f6' }}>{formatVndFull(pendingTopup.amount)} · {t('user.wallet.main.expiresAt').replace('{time}', new Date(pendingTopup.expireAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }))}</p>
                                    </div>
                                </div>
                                <button className="px-3 py-1.5 rounded-lg text-xs font-bold text-white flex-shrink-0" style={{ background: '#2563eb' }}>
                                    {t('user.wallet.main.continue')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Transaction History */}
                    <div className="bg-white rounded-xl" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                        <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: C.border }}>
                            <TrendingUp style={{ width: 18, height: 18, color: C.orange }} />
                            <h2 className="text-sm font-bold flex-1" style={{ color: C.navy }}>{t('user.wallet.main.txHistory')}</h2>
                            {txData && <span className="text-xs" style={{ color: C.gray }}>{t('user.wallet.main.txCount').replace('{count}', String(txData.total))}</span>}
                            {txLoading && <RefreshCw style={{ width: 14, height: 14, color: C.gray }} className="animate-spin" />}
                        </div>

                        <div className="px-5">
                            {txLoading && items.length === 0 ? (
                                <div className="py-10 text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-3" style={{ borderColor: C.orange }} />
                                    <p className="text-sm" style={{ color: C.gray }}>{t('user.wallet.main.loadingTx')}</p>
                                </div>
                            ) : items.length === 0 ? (
                                <div className="py-12 text-center">
                                    <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: C.border }}>
                                        <Wallet style={{ width: 22, height: 22, color: '#94a3b8' }} />
                                    </div>
                                    <p className="text-sm font-medium" style={{ color: C.navy }}>{t('user.wallet.main.noTxTitle')}</p>
                                    <p className="text-xs mt-1" style={{ color: C.gray }}>{t('user.wallet.main.noTxSubtitle')}</p>
                                </div>
                            ) : (
                                <>
                                    {displayedItems.map(tx => <TxRow key={tx.id} tx={tx} t={t} />)}

                                    {items.length > 5 && (
                                        <button
                                            onClick={() => setShowAll(v => !v)}
                                            className="w-full py-3 flex items-center justify-center gap-1.5 text-sm font-medium border-t transition-colors"
                                            style={{ borderColor: C.border, color: C.orange }}
                                        >
                                            {showAll
                                                ? <><ChevronUp className="w-4 h-4" />{t('user.wallet.main.collapse')}</>
                                                : <><ChevronDown className="w-4 h-4" />{t('user.wallet.main.showMore').replace('{count}', String(items.length - 5))}</>
                                            }
                                        </button>
                                    )}

                                    {(hasMore || page > 0) && showAll && (
                                        <div className="flex items-center justify-between py-3 border-t text-sm" style={{ borderColor: C.border, color: C.gray }}>
                                            <button onClick={() => loadTransactions(Math.max(0, page - PAGE_SIZE))} disabled={page === 0 || txLoading} className="px-3 py-1.5 rounded-lg border disabled:opacity-40" style={{ borderColor: '#e2e8f0' }}>{t('user.wallet.main.prev')}</button>
                                            <span>{page + 1}–{Math.min(page + PAGE_SIZE, txData?.total ?? 0)} / {txData?.total ?? 0}</span>
                                            <button onClick={() => loadTransactions(page + PAGE_SIZE)} disabled={!hasMore || txLoading} className="px-3 py-1.5 rounded-lg border disabled:opacity-40" style={{ borderColor: '#e2e8f0' }}>{t('user.wallet.main.next')}</button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {wallet && (
                        <p className="text-center text-xs" style={{ color: '#94a3b8' }}>
                            {t('user.wallet.main.lastUpdated').replace('{date}', formatDate(wallet.updatedAt))}
                        </p>
                    )}
                </div>
            </div>

            {/* ═══ MOBILE Bottom Navigation ═══ */}
            <nav
                className="fixed bottom-0 left-0 right-0 md:hidden z-30 flex items-stretch"
                style={{ background: '#ffffff', borderTop: `1px solid ${C.border}`, height: '60px' }}
            >
                {navItems.map(item => {
                    const active = item.href === '/user/wallet';
                    return (
                        <button
                            key={item.label}
                            onClick={() => {
                                if (item.href === '/user/disputes') resetDisputeNavBadge();
                                if (item.href !== '#') router.push(item.href);
                            }}
                            className="relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
                            style={{ color: active ? C.orange : '#94a3b8' }}
                        >
                            <span style={{ color: active ? C.orange : '#94a3b8' }}>{item.icon}</span>
                            <span className="text-[9px] font-medium">{item.label}</span>
                            {item.href === '/user/disputes' && disputeNavBadge > 0 && !active && (
                                <span className="absolute top-1 right-2 min-w-[16px] h-4 px-0.5 text-[9px] font-bold text-white rounded-full flex items-center justify-center" style={{ background: '#ef4444' }}>
                                    {disputeNavBadge > 99 ? '99+' : disputeNavBadge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Topup Modal */}
            {showTopup && (
                <TopupModal
                    initialQrData={pendingTopup ?? undefined}
                    onClose={() => {
                        setShowTopup(false);
                        api.get('/user-wallet/topup/pending').catch(() => ({ data: null })).then(r => setPendingTopup(r.data));
                    }}
                    onSuccess={() => { setPendingTopup(null); loadWallet(); loadTransactions(0); }}
                    t={t}
                />
            )}

            {/* Withdraw Modal */}
            {showWithdraw && wallet && (
                <WithdrawModal
                    availableBalance={available}
                    withdrawalAccounts={withdrawalAccounts}
                    onClose={() => setShowWithdraw(false)}
                    onSuccess={() => { setShowWithdraw(false); loadWallet(); loadTransactions(0); }}
                    t={t}
                />
            )}
        </div>
    );
}
