'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';

const C = {
    orange: '#f97316',
    orangeDark: '#ea6c0a',
    navy: '#1a1a2e',
    gray: '#6b7280',
    bg: '#f8fafc',
    border: '#f1f5f9',
    green: '#16a34a',
};

interface Item { id: number; label: string; amount: number; }

interface PaymentSheetProps {
    requestId: string;
    defaultAmount: number;
    defaultPaymentMethod?: 'CASH' | 'QR' | 'WALLET';
    /** When true the WALLET option is shown but disabled (e.g. guest requester) */
    disableWallet?: boolean;
    onClose: () => void;
    onSubmitted: (method?: 'CASH' | 'QR' | 'WALLET') => void;
}

let nextId = 1;
const makeItem = (): Item => ({ id: nextId++, label: '', amount: 0 });

export default function PaymentSheet({ requestId, defaultAmount, defaultPaymentMethod, disableWallet = false, onClose, onSubmitted }: PaymentSheetProps) {
    const { t, locale } = useLanguage();
    const numLoc = locale === 'en' ? 'en-US' : 'vi-VN';
    const fmt = useMemo(
        () => (n: number) => n.toLocaleString(numLoc) + 'đ',
        [numLoc],
    );

    // ── Primary total (editable, pre-filled from accepted quote) ──────────────
    const [baseFee, setBaseFee] = useState(defaultAmount > 0 ? defaultAmount : 0);

    // Sync if defaultAmount arrives after mount (async quote fetch)
    useEffect(() => {
        if (defaultAmount > 0 && baseFee === 0) setBaseFee(defaultAmount);
    }, [defaultAmount]);

    // ── Chi tiết: breakdowns of what makes up baseFee (informational, no total change) ──
    const [breakdownItems, setBreakdownItems] = useState<Item[]>([]);
    const [showBreakdown, setShowBreakdown] = useState(false);

    // ── Phụ phí: extra on-site charges ADDED to the total ────────────────────
    const [surchargeItems, setSurchargeItems] = useState<Item[]>([]);
    const [showSurcharge, setShowSurcharge] = useState(false);

    const [note, setNote] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QR' | 'WALLET'>(defaultPaymentMethod ?? 'CASH');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [cashSent, setCashSent] = useState(false);  // show cash-pending overlay after CASH submit
    const [walletSent, setWalletSent] = useState(false); // show wallet-sent overlay after WALLET submit
    const [walletReceived, setWalletReceived] = useState(false); // wallet payment confirmed by user
    const walletPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Photo upload state ────────────────────────────────────────────────────
    interface PhotoItem {
        localId: string;        // random id for React key
        previewUrl: string;     // object URL for preview
        publicUrl: string | null; // R2 public URL after upload
        uploadId: string | null;  // DB upload record id
        status: 'uploading' | 'done' | 'error';
    }
    const [photos, setPhotos] = useState<PhotoItem[]>([]);
    const photoInputRef = useRef<HTMLInputElement>(null);
    const MAX_PHOTOS = 5;

    const surchargeTotal = surchargeItems.reduce((s, i) => s + i.amount, 0);
    const totalAmount = baseFee + surchargeTotal;

    const paymentOptions = useMemo(
        () =>
            [
                { value: 'CASH' as const, label: t('provider.paymentFinalizeModal.methodCash'), sub: t('provider.paymentFinalizeModal.methodCashSub') },
                { value: 'QR' as const, label: t('provider.paymentFinalizeModal.methodQr'), sub: t('provider.paymentFinalizeModal.methodQrSub') },
                {
                    value: 'WALLET' as const,
                    label: t('provider.paymentFinalizeModal.methodWallet'),
                    sub: t('provider.paymentFinalizeModal.methodWalletSub'),
                },
            ] as const,
        [t],
    );

    // ── Helpers ───────────────────────────────────────────────────────────────
    const addTo = (setter: React.Dispatch<React.SetStateAction<Item[]>>, show: () => void) => {
        setter(prev => [...prev, makeItem()]);
        show();
    };

    const updateItem = (
        setter: React.Dispatch<React.SetStateAction<Item[]>>,
        id: number, field: 'label' | 'amount', val: string | number
    ) => setter(prev => prev.map(i => i.id === id ? { ...i, [field]: val } : i));

    const removeItem = (
        setter: React.Dispatch<React.SetStateAction<Item[]>>, id: number
    ) => setter(prev => prev.filter(i => i.id !== id));

    const amountInput = (
        setter: React.Dispatch<React.SetStateAction<Item[]>>, id: number
    ) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/\D/g, '');
        updateItem(setter, id, 'amount', raw ? parseInt(raw, 10) : 0);
    };

    // ── QR Modal state ────────────────────────────────────────────────────────
    const [qrData, setQrData] = useState<{
        jobPaymentTxId: string; transferCode: string; qrUrl: string;
        bankAccount: string; bankCode: string; amount: number; expireAt: string;
    } | null>(null);
    const [qrStep, setQrStep] = useState<'qr' | 'done' | 'expired'>('qr');
    const [secsLeft, setSecsLeft] = useState(0);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const cdRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopAll = () => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        if (cdRef.current) { clearInterval(cdRef.current); cdRef.current = null; }
        if (walletPollRef.current) { clearInterval(walletPollRef.current); walletPollRef.current = null; }
    };

    useEffect(() => () => stopAll(), []);

    // Start polling for wallet payment confirmation by user
    const startWalletPoll = (reqId: string) => {
        walletPollRef.current = setInterval(async () => {
            try {
                const res = await api.get(`/rescue-requests/${reqId}/payment`);
                const status = res.data?.status;
                if (status === 'COMPLETED') {
                    if (walletPollRef.current) { clearInterval(walletPollRef.current); walletPollRef.current = null; }
                    setWalletReceived(true);
                }
            } catch { /* ignore polling errors */ }
        }, 3000);
    };

    const startCountdown = (expireAt: string) => {
        const tick = () => {
            const left = Math.max(0, Math.floor((new Date(expireAt).getTime() - Date.now()) / 1000));
            setSecsLeft(left);
            if (left === 0) { stopAll(); setQrStep('expired'); }
        };
        tick();
        cdRef.current = setInterval(tick, 1000);
    };

    const pollStatus = (requestId: string) => {
        pollRef.current = setInterval(async () => {
            try {
                const res = await api.get(`/rescue-requests/${requestId}/payment/qr/status`);
                if (res.data.status === 'COMPLETED') {
                    clearInterval(pollRef.current!); pollRef.current = null;
                    clearInterval(cdRef.current!); cdRef.current = null;
                    setQrStep('done'); onSubmitted('QR');
                } else if (res.data.status === 'EXPIRED' || res.data.status === 'CANCELLED') {
                    clearInterval(pollRef.current!); pollRef.current = null;
                    clearInterval(cdRef.current!); cdRef.current = null;
                    setQrStep('expired');
                }
            } catch { /* ignore polling errors */ }
        }, 3000);
    };

    // ── Photo upload helpers ──────────────────────────────────────────────────
    const handlePickPhotos = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        const remaining = MAX_PHOTOS - photos.length;
        if (remaining <= 0) {
            toast.error(t('provider.paymentFinalizeModal.toastMaxPhotos').replace('{max}', String(MAX_PHOTOS)));
            return;
        }

        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        const toUpload = files.slice(0, remaining).filter(f => {
            if (!allowed.includes(f.type)) {
                toast.error(t('provider.paymentFinalizeModal.toastBadFileType').replace('{name}', f.name));
                return false;
            }
            if (f.size > 5 * 1024 * 1024) {
                toast.error(t('provider.paymentFinalizeModal.toastFileTooBig').replace('{name}', f.name));
                return false;
            }
            return true;
        });

        // Reset input so same file can be re-selected
        if (photoInputRef.current) photoInputRef.current.value = '';

        toUpload.forEach(file => {
            const localId = Math.random().toString(36).slice(2);
            const previewUrl = URL.createObjectURL(file);

            // Add placeholder immediately
            setPhotos(prev => [...prev, { localId, previewUrl, publicUrl: null, uploadId: null, status: 'uploading' }]);

            // Async upload
            (async () => {
                try {
                    // 1) Presign
                    const presignRes = await api.post('/uploads/presign', {
                        purpose: 'request_photo',
                        fileName: file.name,
                        fileSize: file.size,
                        contentType: file.type,
                    });
                    const { uploadUrl, publicUrl, uploadId } = presignRes.data;

                    // 2) PUT to R2
                    await fetch(uploadUrl, {
                        method: 'PUT',
                        body: file,
                        headers: { 'Content-Type': file.type },
                    });

                    // 3) Confirm
                    await api.post('/uploads/confirm', { uploadId });

                    setPhotos(prev => prev.map(p =>
                        p.localId === localId ? { ...p, publicUrl, uploadId, status: 'done' } : p
                    ));
                } catch {
                    setPhotos(prev => prev.map(p =>
                        p.localId === localId ? { ...p, status: 'error' } : p
                    ));
                    toast.error(t('provider.paymentFinalizeModal.toastPhotoUploadFailed'));
                }
            })();
        });
    }, [photos.length, t]);

    const removePhoto = useCallback((localId: string) => {
        setPhotos(prev => {
            const item = prev.find(p => p.localId === localId);
            if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
            return prev.filter(p => p.localId !== localId);
        });
    }, []);

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (totalAmount <= 0) {
            toast.error(t('provider.paymentFinalizeModal.toastEnterAmount'));
            return;
        }

        // Don't submit while photos are still uploading
        const stillUploading = photos.filter(p => p.status === 'uploading');
        if (stillUploading.length > 0) {
            toast.error(
                t('provider.paymentFinalizeModal.toastPhotosUploading').replace('{count}', String(stillUploading.length)),
            );
            return;
        }

        setIsSubmitting(true);

        // Store both breakdown and surcharges in surchargeNote as JSON
        const structured = {
            breakdown: breakdownItems.filter(i => i.label || i.amount > 0).map(({ label, amount }) => ({ label, amount })),
            surcharges: surchargeItems.filter(i => i.label || i.amount > 0).map(({ label, amount }) => ({ label, amount })),
        };
        const surchargeNote = (structured.breakdown.length > 0 || structured.surcharges.length > 0)
            ? JSON.stringify(structured)
            : undefined;

        const photoUrls = photos.filter(p => p.status === 'done' && p.publicUrl).map(p => p.publicUrl as string);

        try {
            await api.post(`/rescue-requests/${requestId}/payment`, {
                baseFee,
                distanceFee: 0,
                overtimeFee: 0,
                otherFee: surchargeTotal,
                totalAmount,
                surchargeNote,
                note: note || undefined,
                photoUrls,
                paymentMethod,
            });

            if (paymentMethod === 'QR') {
                // Generate QR code for customer to scan
                const qrRes = await api.post(`/rescue-requests/${requestId}/payment/qr/init`);
                setQrData(qrRes.data);
                setQrStep('qr');
                startCountdown(qrRes.data.expireAt);
                pollStatus(requestId);
            } else if (paymentMethod === 'WALLET') {
                // Wallet payment — user will receive a notification to confirm
                toast.success(t('provider.paymentFinalizeModal.toastWalletRequestSent'));
                setWalletSent(true);
                startWalletPoll(requestId);
            } else {
                toast.success(t('provider.paymentFinalizeModal.toastRequestSent'));
                setCashSent(true); // Show cash-pending overlay instead of closing immediately
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || t('provider.paymentFinalizeModal.toastSubmitFailed'));
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Render row of items ───────────────────────────────────────────────────
    const renderItems = (
        items: Item[],
        setter: React.Dispatch<React.SetStateAction<Item[]>>,
        labelPlaceholder: string,
    ) => (
        <div className="space-y-2">
            {items.map(item => (
                <div
                    key={item.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{ background: C.bg, border: `1px solid ${C.border}` }}
                >
                    <input
                        type="text"
                        value={item.label}
                        onChange={e => updateItem(setter, item.id, 'label', e.target.value)}
                        placeholder={labelPlaceholder}
                        className="flex-1 text-xs outline-none bg-transparent min-w-0"
                        style={{ color: C.navy }}
                    />
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                        <input
                            type="text"
                            inputMode="numeric"
                            value={item.amount === 0 ? '' : item.amount.toLocaleString(numLoc)}
                            onChange={amountInput(setter, item.id)}
                            placeholder="0"
                            className="w-24 text-right text-xs font-semibold outline-none bg-transparent"
                            style={{ color: C.orange }}
                        />
                        <span className="text-xs" style={{ color: C.orange }}>đ</span>
                    </div>
                    <button
                        onClick={() => removeItem(setter, item.id)}
                        className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full"
                        style={{ background: '#fef2f2' }}
                    >
                        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            ))}
        </div>
    );

    return (
        <>
            <div
                className="fixed inset-0 z-[60] flex items-end"
                style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                onClick={onClose}
            >
                <div
                    className="w-full max-h-[92vh] overflow-y-auto"
                    style={{ background: 'white', borderRadius: '24px 24px 0 0', boxShadow: '0 -8px 40px rgba(0,0,0,0.2)' }}
                    onClick={e => e.stopPropagation()}
                >
                    <div className="w-10 h-1 rounded-full mx-auto mt-3 mb-1" style={{ background: C.border }} />

                    <div className="px-4 pb-6 pt-2">
                        {/* Title */}
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-base font-bold" style={{ color: C.navy }}>{t('provider.paymentFinalizeModal.title')}</h2>
                                <p className="text-xs" style={{ color: C.gray }}>{t('provider.paymentFinalizeModal.subtitle')}</p>
                            </div>
                            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: C.bg }}>
                                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.gray} strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* ── Tổng tiền — totalAmount is always the hero number ── */}
                        <div
                            className="rounded-2xl px-4 py-4 mb-4"
                            style={{ background: 'linear-gradient(135deg, #fff7ed, #fff)', border: `1.5px solid #fed7aa` }}
                        >
                            <p className="text-xs text-center mb-1" style={{ color: C.gray }}>{t('provider.paymentFinalizeModal.totalLabel')}</p>

                            {/* Always-prominent total */}
                            <p className="text-4xl font-extrabold text-center" style={{ color: C.orange }}>
                                {totalAmount > 0 ? fmt(totalAmount) : '—'}
                            </p>

                            {/* Editable base price line */}
                            <div className="flex items-center justify-center gap-1 mt-3 pt-3" style={{ borderTop: `1px solid #fed7aa` }}>
                                <span className="text-xs flex-shrink-0" style={{ color: C.gray }}>
                                    {surchargeTotal > 0 ? t('provider.paymentFinalizeModal.basePriceWithExtras') : t('provider.paymentFinalizeModal.basePriceEnter')}
                                </span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={baseFee === 0 ? '' : baseFee.toLocaleString(numLoc)}
                                    onChange={e => {
                                        const raw = e.target.value.replace(/\D/g, '');
                                        setBaseFee(raw ? parseInt(raw, 10) : 0);
                                    }}
                                    placeholder="0"
                                    className="text-center text-sm font-bold outline-none bg-transparent w-32"
                                    style={{ color: C.orange, caretColor: C.orange }}
                                />
                                <span className="text-sm font-bold" style={{ color: C.orange }}>đ</span>
                                {defaultAmount > 0 && baseFee !== defaultAmount && (
                                    <button
                                        onClick={() => setBaseFee(defaultAmount)}
                                        className="text-xs underline ml-1 flex-shrink-0"
                                        style={{ color: C.gray }}
                                    >{t('provider.paymentFinalizeModal.resetToQuote')}</button>
                                )}
                            </div>

                            {/* Surcharge & quote reference lines */}
                            {surchargeTotal > 0 && (
                                <div className="flex items-center justify-center gap-1 mt-1.5">
                                    <span className="text-xs" style={{ color: C.gray }}>{t('provider.paymentFinalizeModal.surchargePlus')}</span>
                                    <span className="text-xs font-semibold" style={{ color: '#d97706' }}>{fmt(surchargeTotal)}</span>
                                </div>
                            )}
                            {defaultAmount > 0 && (
                                <div
                                    className="flex items-center justify-center gap-1.5 mt-2 px-3 py-1.5 rounded-full mx-auto w-fit"
                                    style={{ background: '#fef3c7', border: '1px solid #fcd34d' }}
                                >
                                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#d97706" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p className="text-xs font-semibold" style={{ color: '#92400e' }}>
                                        {t('provider.paymentFinalizeModal.quoteBanner').replace('{amount}', fmt(defaultAmount))}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* ── Chi tiết (breakdown of base fee — informational) ── */}
                        <div className="mb-3">
                            <div className="flex items-center justify-between mb-2">
                                <button
                                    className="flex items-center gap-1 text-xs font-semibold"
                                    style={{ color: C.navy }}
                                    onClick={() => setShowBreakdown(v => !v)}
                                >
                                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                                        className={`transition-transform ${showBreakdown ? 'rotate-180' : ''}`}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                    {t('provider.paymentFinalizeModal.breakdownToggle')}
                                    {breakdownItems.length > 0
                                        ? t('provider.paymentFinalizeModal.breakdownCount').replace('{count}', String(breakdownItems.length))
                                        : ''}
                                </button>
                                <button
                                    onClick={() => addTo(setBreakdownItems, () => setShowBreakdown(true))}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold"
                                    style={{ background: '#eff6ff', color: '#2563eb' }}
                                >
                                    <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                    </svg>
                                    {t('provider.paymentFinalizeModal.addBreakdownLine')}
                                </button>
                            </div>

                            {showBreakdown && breakdownItems.length > 0 && (
                                <>
                                    {renderItems(breakdownItems, setBreakdownItems, t('provider.paymentFinalizeModal.breakdownPlaceholder'))}
                                    {/* Sum hint */}
                                    {breakdownItems.some(i => i.amount > 0) && (
                                        <p className="text-right text-xs mt-1.5 pr-1" style={{ color: C.gray }}>
                                            {t('provider.paymentFinalizeModal.breakdownSum')} <span className="font-semibold">
                                                {fmt(breakdownItems.reduce((s, i) => s + i.amount, 0))}
                                            </span>
                                            {breakdownItems.reduce((s, i) => s + i.amount, 0) !== baseFee && baseFee > 0 && (
                                                <span style={{ color: '#d97706' }}> ≠ {fmt(baseFee)}</span>
                                            )}
                                        </p>
                                    )}
                                </>
                            )}
                            {showBreakdown && breakdownItems.length === 0 && (
                                <p className="text-xs text-center py-2" style={{ color: C.gray }}>{t('provider.paymentFinalizeModal.breakdownEmptyHint')}</p>
                            )}
                        </div>

                        {/* ── Phụ phí (extra charges that ADD to total) ── */}
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <button
                                    className="flex items-center gap-1 text-xs font-semibold"
                                    style={{ color: C.navy }}
                                    onClick={() => setShowSurcharge(v => !v)}
                                >
                                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                                        className={`transition-transform ${showSurcharge ? 'rotate-180' : ''}`}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                    {t('provider.paymentFinalizeModal.surchargeToggle')}
                                    {surchargeItems.length > 0
                                        ? t('provider.paymentFinalizeModal.surchargeCountTotal')
                                            .replace('{count}', String(surchargeItems.length))
                                            .replace('{amount}', fmt(surchargeTotal))
                                        : ''}
                                </button>
                                <button
                                    onClick={() => addTo(setSurchargeItems, () => setShowSurcharge(true))}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold"
                                    style={{ background: '#fff7ed', color: C.orange }}
                                >
                                    <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                    </svg>
                                    {t('provider.paymentFinalizeModal.addSurchargeLine')}
                                </button>
                            </div>

                            {showSurcharge && surchargeItems.length > 0 && renderItems(
                                surchargeItems, setSurchargeItems, t('provider.paymentFinalizeModal.surchargePlaceholder')
                            )}
                            {showSurcharge && surchargeItems.length === 0 && (
                                <p className="text-xs text-center py-2" style={{ color: C.gray }}>{t('provider.paymentFinalizeModal.surchargeEmptyHint')}</p>
                            )}
                        </div>

                        {/* ── Ghi chú ── */}
                        <div className="mb-4">
                            <p className="text-xs mb-1 font-medium" style={{ color: C.gray }}>{t('provider.paymentFinalizeModal.noteLabel')}</p>
                            <textarea
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                placeholder={t('provider.paymentFinalizeModal.notePlaceholder')}
                                rows={2}
                                className="w-full py-2.5 px-3 rounded-xl text-sm outline-none resize-none"
                                style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.navy }}
                            />
                        </div>

                        {/* ── Ảnh hiện trường (tùy chọn) ── */}
                        <div className="mb-5">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-bold" style={{ color: C.navy }}>
                                    {t('provider.paymentFinalizeModal.photosTitle')}
                                    <span className="font-normal ml-1" style={{ color: C.gray }}>
                                        {t('provider.paymentFinalizeModal.photosOptional').replace('{max}', String(MAX_PHOTOS))}
                                    </span>
                                </p>
                                {photos.length < MAX_PHOTOS && (
                                    <button
                                        type="button"
                                        onClick={() => photoInputRef.current?.click()}
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-[0.97]"
                                        style={{ background: '#eff6ff', color: '#2563eb' }}
                                    >
                                        <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                        </svg>
                                        {t('provider.paymentFinalizeModal.choosePhotos')}
                                    </button>
                                )}
                            </div>

                            {/* Hidden file input */}
                            <input
                                ref={photoInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                multiple
                                capture="environment"
                                className="hidden"
                                onChange={handlePickPhotos}
                            />

                            {photos.length === 0 ? (
                                /* Empty state — tap to pick */
                                <button
                                    type="button"
                                    onClick={() => photoInputRef.current?.click()}
                                    className="w-full py-5 rounded-2xl flex flex-col items-center gap-2 transition-all active:scale-[0.98]"
                                    style={{ background: C.bg, border: `1.5px dashed ${C.border}` }}
                                >
                                    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke={C.gray} strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <p className="text-xs" style={{ color: C.gray }}>{t('provider.paymentFinalizeModal.photosEmptyHint')}</p>
                                </button>
                            ) : (
                                /* Photo thumbnails grid */
                                <div className="grid grid-cols-3 gap-2">
                                    {photos.map(photo => (
                                        <div key={photo.localId} className="relative aspect-square rounded-xl overflow-hidden" style={{ background: C.bg }}>
                                            <img
                                                src={photo.previewUrl}
                                                alt={t('provider.paymentFinalizeModal.photoAlt')}
                                                className="w-full h-full object-cover"
                                            />
                                            {/* Status overlay */}
                                            {photo.status === 'uploading' && (
                                                <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
                                                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                                                        <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8H4z" />
                                                    </svg>
                                                </div>
                                            )}
                                            {photo.status === 'error' && (
                                                <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(220,38,38,0.6)' }}>
                                                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                                    </svg>
                                                </div>
                                            )}
                                            {photo.status === 'done' && (
                                                <div className="absolute top-1 left-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: '#16a34a' }}>
                                                    <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </div>
                                            )}
                                            {/* Remove button */}
                                            <button
                                                type="button"
                                                onClick={() => removePhoto(photo.localId)}
                                                className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                                                style={{ background: 'rgba(0,0,0,0.55)' }}
                                            >
                                                <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                    {/* Add more button (inline in grid) */}
                                    {photos.length < MAX_PHOTOS && (
                                        <button
                                            type="button"
                                            onClick={() => photoInputRef.current?.click()}
                                            className="aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-[0.96]"
                                            style={{ background: C.bg, border: `1.5px dashed ${C.border}` }}
                                        >
                                            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={C.gray} strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                            </svg>
                                            <span className="text-[9px]" style={{ color: C.gray }}>{t('provider.paymentFinalizeModal.addPhoto')}</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ── Phương thức thanh toán ── */}
                        <div className="mb-5">
                            <p className="text-xs font-bold mb-2" style={{ color: C.navy }}>{t('provider.paymentFinalizeModal.paymentMethodTitle')}</p>
                            <div className="space-y-2">
                                {paymentOptions.map(opt => {
                                    const isDisabled = opt.value === 'WALLET' && disableWallet;
                                    const isSelected = paymentMethod === opt.value;
                                    return (
                                        <button
                                            key={opt.value}
                                            onClick={() => !isDisabled && setPaymentMethod(opt.value)}
                                            disabled={isDisabled}
                                            className="w-full flex items-center gap-3 p-3 rounded-2xl text-left"
                                            style={{
                                                border: `1.5px solid ${isDisabled ? '#e5e7eb' : isSelected ? C.orange : C.border}`,
                                                background: isDisabled ? '#f9fafb' : isSelected ? '#fff7ed' : 'white',
                                                opacity: isDisabled ? 0.5 : 1,
                                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                                            }}
                                        >
                                            <div
                                                className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                                                style={{ borderColor: isDisabled ? '#d1d5db' : isSelected ? C.orange : C.border }}
                                            >
                                                {isSelected && !isDisabled && (
                                                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: C.orange }} />
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-semibold" style={{ color: isDisabled ? '#9ca3af' : C.navy }}>{opt.label}</p>
                                                <p className="text-xs" style={{ color: isDisabled ? '#9ca3af' : C.gray }}>
                                                    {isDisabled ? t('provider.paymentFinalizeModal.methodWalletDisabledGuest') : opt.sub}
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── Submit ── */}
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting || totalAmount <= 0}
                            className="w-full py-4 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 active:scale-[0.98]"
                            style={{
                                background: isSubmitting || totalAmount <= 0 ? C.gray : `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`,
                                boxShadow: totalAmount > 0 ? `0 4px 16px ${C.orange}50` : 'none',
                            }}
                        >
                            {isSubmitting ? (
                                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                                    <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>
                            ) : (
                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            )}
                            {isSubmitting
                                ? t('provider.paymentFinalizeModal.submitting')
                                : t('provider.paymentFinalizeModal.submitBtn').replace('{amount}', fmt(totalAmount))}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── QR Payment Overlay (provider side) ── */}
            {
                qrData && (
                    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
                        <div className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden" style={{ background: 'white' }}>
                            {qrStep === 'done' ? (
                                <div className="p-8 text-center">
                                    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#f0fdf4' }}>
                                        <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    </div>
                                    <p className="text-lg font-bold mb-1" style={{ color: C.navy }}>{t('provider.paymentFinalizeModal.qrSuccessTitle')}</p>
                                    <p className="text-sm" style={{ color: C.gray }}>{t('provider.paymentFinalizeModal.qrSuccessSubtitle')}</p>
                                </div>
                            ) : qrStep === 'expired' ? (
                                <div className="p-6 text-center">
                                    <p className="text-base font-bold mb-3" style={{ color: '#dc2626' }}>{t('provider.paymentFinalizeModal.qrExpiredTitle')}</p>
                                    <button onClick={async () => {
                                        const r = await api.post(`/rescue-requests/${requestId}/payment/qr/init`);
                                        setQrData(r.data); setQrStep('qr');
                                        startCountdown(r.data.expireAt); pollStatus(requestId);
                                    }} className="w-full py-3 rounded-2xl text-sm font-bold text-white mb-3" style={{ background: C.orange }}>{t('provider.paymentFinalizeModal.qrRegenerate')}</button>
                                    <button onClick={async () => {
                                        try { await api.patch(`/rescue-requests/${requestId}/payment/switch-to-cash`); } catch { /* ignore */ }
                                        stopAll(); setQrData(null); onSubmitted('CASH');
                                    }} className="w-full py-3 rounded-xl text-xs font-semibold transition-all active:scale-[0.98]" style={{ background: '#fff7ed', color: C.orange, border: `1.5px solid ${C.orange}` }}>
                                        {t('provider.paymentFinalizeModal.switchToCash')}
                                    </button>
                                </div>
                            ) : (
                                <div className="px-5 pt-5 pb-6">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <p className="text-sm font-bold" style={{ color: C.navy }}>{t('provider.paymentFinalizeModal.qrSheetTitle')}</p>
                                            <p className="text-xs" style={{ color: C.gray }}>{t('provider.paymentFinalizeModal.qrTransferRef')} <span className="font-mono font-semibold" style={{ color: C.orange }}>{qrData.transferCode}</span></p>
                                        </div>
                                        <span className="text-sm font-bold tabular-nums px-3 py-1 rounded-xl" style={{
                                            background: secsLeft > 60 ? '#f0fdf4' : secsLeft > 30 ? '#fff7ed' : '#fef2f2',
                                            color: secsLeft > 60 ? '#16a34a' : secsLeft > 30 ? C.orange : '#dc2626',
                                        }}>
                                            {String(Math.floor(secsLeft / 60)).padStart(2, '0')}:{String(secsLeft % 60).padStart(2, '0')}
                                        </span>
                                    </div>
                                    <img src={qrData.qrUrl} alt="QR" className="w-full rounded-2xl mb-3" style={{ border: '2px solid #f1f5f9' }} />
                                    <p className="text-center text-xs mb-3" style={{ color: C.gray }}>
                                        {t('provider.paymentFinalizeModal.qrWaitingLine').replace('{amount}', fmt(qrData.amount))}
                                    </p>
                                    <button
                                        onClick={async () => {
                                            try { await api.patch(`/rescue-requests/${requestId}/payment/switch-to-cash`); } catch { /* ignore */ }
                                            stopAll(); setQrData(null); onSubmitted('CASH');
                                        }}
                                        className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-[0.98]"
                                        style={{ background: '#fff7ed', color: C.orange, border: `1.5px solid ${C.orange}` }}
                                    >
                                        {t('provider.paymentFinalizeModal.switchToCash')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {/* ── Cash Pending Overlay ── */}
            {cashSent && (
                <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
                    <div className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden" style={{ background: 'white' }}>
                        <div className="px-5 pt-5 pb-6">
                            {/* Header */}
                            <div className="text-center mb-5">
                                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: '#f0fdf4' }}>
                                    <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                </div>
                                <p className="text-base font-bold" style={{ color: C.navy }}>{t('provider.paymentFinalizeModal.cashSentTitle')}</p>
                                <p className="text-2xl font-bold mt-1" style={{ color: C.orange }}>{fmt(totalAmount)}</p>
                                <p className="text-xs mt-1" style={{ color: C.gray }}>{t('provider.paymentFinalizeModal.cashSentSubtitle')}</p>
                            </div>

                            {/* Switch to QR */}
                            <button
                                onClick={async () => {
                                    try {
                                        await api.patch(`/rescue-requests/${requestId}/payment/switch-to-qr`);
                                    } catch { /* may not exist, proceed anyway */ }
                                    try {
                                        const qrRes = await api.post(`/rescue-requests/${requestId}/payment/qr/init`);
                                        setCashSent(false);
                                        setPaymentMethod('QR');
                                        setQrData(qrRes.data);
                                        setQrStep('qr');
                                        startCountdown(qrRes.data.expireAt);
                                        pollStatus(requestId);
                                    } catch (err: any) {
                                        toast.error(err.response?.data?.message || t('provider.paymentFinalizeModal.toastQrSwitchFailed'));
                                    }
                                }}
                                className="w-full py-3 rounded-2xl text-sm font-semibold mb-3 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                style={{ background: '#eff6ff', color: '#2563eb', border: '1.5px solid #bfdbfe' }}
                            >
                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#2563eb" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                </svg>
                                {t('provider.paymentFinalizeModal.switchToQrBtn')}
                            </button>

                            {/* Close / confirm cash */}
                            <button
                                onClick={() => { setCashSent(false); onSubmitted('CASH'); }}
                                className="w-full py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
                                style={{ background: C.bg, color: C.gray }}
                            >
                                {t('provider.paymentFinalizeModal.close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* ── Wallet Sent Overlay ── */}
            {walletSent && (
                <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
                    <div className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden" style={{ background: 'white' }}>
                        <div className="px-5 pt-5 pb-6">
                            {walletReceived ? (
                                /* ── User confirmed → payment received ── */
                                <div className="text-center">
                                    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: '#f0fdf4' }}>
                                        <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <p className="text-base font-bold mb-1" style={{ color: C.navy }}>{t('provider.paymentFinalizeModal.walletReceivedTitle')}</p>
                                    <p className="text-3xl font-extrabold mt-2 mb-1" style={{ color: '#16a34a' }}>{fmt(totalAmount)}</p>
                                    <p className="text-xs mb-4" style={{ color: C.gray }}>{t('provider.paymentFinalizeModal.walletReceivedSubtitle')}</p>
                                    <button
                                        onClick={() => { setWalletSent(false); setWalletReceived(false); onSubmitted('WALLET'); }}
                                        className="w-full py-3.5 rounded-2xl text-sm font-bold text-white transition-all active:scale-[0.98]"
                                        style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', boxShadow: '0 4px 14px rgba(22,163,74,0.35)' }}
                                    >
                                        {t('provider.paymentFinalizeModal.walletReceivedClose')}
                                    </button>
                                </div>
                            ) : (
                                /* ── Waiting for user to confirm ── */
                                <>
                                    <div className="text-center mb-5">
                                        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: '#eff6ff' }}>
                                            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#2563eb" strokeWidth={2.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                            </svg>
                                        </div>
                                        <p className="text-base font-bold" style={{ color: C.navy }}>{t('provider.paymentFinalizeModal.walletPendingTitle')}</p>
                                        <p className="text-2xl font-bold mt-1" style={{ color: '#2563eb' }}>{fmt(totalAmount)}</p>
                                        <p className="text-xs mt-2" style={{ color: C.gray }}>{t('provider.paymentFinalizeModal.walletPendingSubtitle')}</p>
                                    </div>
                                    <div className="rounded-2xl p-3 mb-4" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                                        <div className="flex items-center gap-2">
                                            <svg className="animate-spin w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#2563eb" strokeWidth="4" />
                                                <path className="opacity-75" fill="#2563eb" d="M4 12a8 8 0 018-8v8H4z" />
                                            </svg>
                                            <p className="text-xs font-semibold" style={{ color: '#1d4ed8' }}>
                                                {t('provider.paymentFinalizeModal.walletPendingNote')}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { if (walletPollRef.current) { clearInterval(walletPollRef.current); walletPollRef.current = null; } setWalletSent(false); onSubmitted('WALLET'); }}
                                        className="w-full py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
                                        style={{ background: C.bg, color: C.gray }}
                                    >
                                        {t('provider.paymentFinalizeModal.walletCloseBackground')}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
