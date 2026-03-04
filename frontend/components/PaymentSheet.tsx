'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const C = {
    orange: '#f97316',
    orangeDark: '#ea6c0a',
    navy: '#1a1a2e',
    gray: '#6b7280',
    bg: '#f8fafc',
    border: '#f1f5f9',
    green: '#16a34a',
};

function fmt(n: number) {
    return n.toLocaleString('vi-VN') + 'đ';
}

interface Item { id: number; label: string; amount: number; }

interface PaymentSheetProps {
    requestId: string;
    defaultAmount: number;
    onClose: () => void;
    onSubmitted: () => void;
}

let nextId = 1;
const makeItem = (): Item => ({ id: nextId++, label: '', amount: 0 });

export default function PaymentSheet({ requestId, defaultAmount, onClose, onSubmitted }: PaymentSheetProps) {
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
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QR'>('CASH');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const surchargeTotal = surchargeItems.reduce((s, i) => s + i.amount, 0);
    const totalAmount = baseFee + surchargeTotal;

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

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (totalAmount <= 0) { toast.error('Vui lòng nhập số tiền thanh toán'); return; }
        setIsSubmitting(true);

        // Store both breakdown and surcharges in surchargeNote as JSON
        const structured = {
            breakdown: breakdownItems.filter(i => i.label || i.amount > 0).map(({ label, amount }) => ({ label, amount })),
            surcharges: surchargeItems.filter(i => i.label || i.amount > 0).map(({ label, amount }) => ({ label, amount })),
        };
        const surchargeNote = (structured.breakdown.length > 0 || structured.surcharges.length > 0)
            ? JSON.stringify(structured)
            : undefined;

        try {
            await api.post(`/rescue-requests/${requestId}/payment`, {
                baseFee,
                distanceFee: 0,
                overtimeFee: 0,
                otherFee: surchargeTotal,
                totalAmount,
                surchargeNote,
                note: note || undefined,
                photoUrls: [],
                paymentMethod,
            });
            toast.success('Đã gửi yêu cầu thanh toán!');
            onSubmitted();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Gửi thất bại, thử lại');
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
                            value={item.amount === 0 ? '' : item.amount.toLocaleString('vi-VN')}
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
                            <h2 className="text-base font-bold" style={{ color: C.navy }}>Chốt phí & Thanh toán</h2>
                            <p className="text-xs" style={{ color: C.gray }}>Xác nhận chi tiết trước khi gửi khách</p>
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
                        <p className="text-xs text-center mb-1" style={{ color: C.gray }}>Tổng tiền cần thanh toán</p>

                        {/* Always-prominent total */}
                        <p className="text-4xl font-extrabold text-center" style={{ color: C.orange }}>
                            {totalAmount > 0 ? fmt(totalAmount) : '—'}
                        </p>

                        {/* Editable base price line */}
                        <div className="flex items-center justify-center gap-1 mt-3 pt-3" style={{ borderTop: `1px solid #fed7aa` }}>
                            <span className="text-xs flex-shrink-0" style={{ color: C.gray }}>
                                {surchargeTotal > 0 ? 'Giá dịch vụ:' : 'Nhập giá:'}
                            </span>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={baseFee === 0 ? '' : baseFee.toLocaleString('vi-VN')}
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
                                >đặt lại</button>
                            )}
                        </div>

                        {/* Surcharge & quote reference lines */}
                        {surchargeTotal > 0 && (
                            <div className="flex items-center justify-center gap-1 mt-1.5">
                                <span className="text-xs" style={{ color: C.gray }}>+ Phụ phí:</span>
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
                                    Báo giá bạn đã gửi trước đó: {fmt(defaultAmount)}
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
                                Chi tiết {breakdownItems.length > 0 && `(${breakdownItems.length})`}
                            </button>
                            <button
                                onClick={() => addTo(setBreakdownItems, () => setShowBreakdown(true))}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold"
                                style={{ background: '#eff6ff', color: '#2563eb' }}
                            >
                                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                </svg>
                                Thêm mục
                            </button>
                        </div>

                        {showBreakdown && breakdownItems.length > 0 && (
                            <>
                                {renderItems(breakdownItems, setBreakdownItems, 'VD: Công thay lốp, Ắc quy...')}
                                {/* Sum hint */}
                                {breakdownItems.some(i => i.amount > 0) && (
                                    <p className="text-right text-xs mt-1.5 pr-1" style={{ color: C.gray }}>
                                        Tổng chi tiết: <span className="font-semibold">
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
                            <p className="text-xs text-center py-2" style={{ color: C.gray }}>Bấm "+ Thêm mục" để liệt kê những gì trong tổng tiền</p>
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
                                Phụ phí phát sinh {surchargeItems.length > 0 && `(${surchargeItems.length} • +${fmt(surchargeTotal)})`}
                            </button>
                            <button
                                onClick={() => addTo(setSurchargeItems, () => setShowSurcharge(true))}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold"
                                style={{ background: '#fff7ed', color: C.orange }}
                            >
                                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                </svg>
                                Thêm khoản
                            </button>
                        </div>

                        {showSurcharge && surchargeItems.length > 0 && renderItems(
                            surchargeItems, setSurchargeItems, 'VD: Chi phí xe tải, Phụ tùng thêm...'
                        )}
                        {showSurcharge && surchargeItems.length === 0 && (
                            <p className="text-xs text-center py-2" style={{ color: C.gray }}>Bấm "+ Thêm khoản" để thêm phụ phí phát sinh tại hiện trường</p>
                        )}
                    </div>

                    {/* ── Ghi chú ── */}
                    <div className="mb-4">
                        <p className="text-xs mb-1 font-medium" style={{ color: C.gray }}>Ghi chú (tuỳ chọn)</p>
                        <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="Ghi chú thêm cho khách hàng..."
                            rows={2}
                            className="w-full py-2.5 px-3 rounded-xl text-sm outline-none resize-none"
                            style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.navy }}
                        />
                    </div>

                    {/* ── Phương thức thanh toán ── */}
                    <div className="mb-5">
                        <p className="text-xs font-bold mb-2" style={{ color: C.navy }}>Phương thức thanh toán</p>
                        <div className="space-y-2">
                            {([
                                { value: 'CASH', label: 'Tiền mặt', sub: 'Thanh toán trực tiếp tại nơi sửa chữa' },
                                { value: 'QR', label: 'Chuyển khoản QR', sub: 'Quét mã QR để chuyển tiền' },
                            ] as const).map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setPaymentMethod(opt.value)}
                                    className="w-full flex items-center gap-3 p-3 rounded-2xl text-left"
                                    style={{
                                        border: `1.5px solid ${paymentMethod === opt.value ? C.orange : C.border}`,
                                        background: paymentMethod === opt.value ? '#fff7ed' : 'white',
                                    }}
                                >
                                    <div
                                        className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                                        style={{ borderColor: paymentMethod === opt.value ? C.orange : C.border }}
                                    >
                                        {paymentMethod === opt.value && (
                                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: C.orange }} />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold" style={{ color: C.navy }}>{opt.label}</p>
                                        <p className="text-xs" style={{ color: C.gray }}>{opt.sub}</p>
                                    </div>
                                </button>
                            ))}
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
                        {isSubmitting ? 'Đang gửi...' : `Gửi yêu cầu thanh toán · ${fmt(totalAmount)}`}
                    </button>
                </div>
            </div>
        </div>
    );
}
