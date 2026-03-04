'use client';

import { useState } from 'react';
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
    greenLight: '#f0fdf4',
};

function fmt(n: number) {
    return n.toLocaleString('vi-VN') + 'đ';
}

interface Payment {
    id: string;
    totalAmount: number;
    baseFee: number;
    distanceFee: number;
    overtimeFee: number;
    otherFee: number;
    surchargeNote?: string | null;
    note?: string | null;
    photoUrls: string[];
    paymentMethod: 'CASH' | 'QR';
    status: string;
    userConfirmedAt?: string | null;
}

interface PaymentRequestProps {
    requestId: string;
    payment: Payment;
    providerName?: string | null;
}

export default function PaymentRequest({ requestId, payment, providerName }: PaymentRequestProps) {
    const [showBreakdown, setShowBreakdown] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [showDispute, setShowDispute] = useState(false);
    const [disputeReason, setDisputeReason] = useState('');
    const [isDisputing, setIsDisputing] = useState(false);
    const [done, setDone] = useState(false);

    const alreadyConfirmed = !!payment.userConfirmedAt || done;

    const handleConfirm = async () => {
        setIsConfirming(true);
        try {
            await api.patch(`/rescue-requests/${requestId}/payment/confirm-sent`);
            toast.success('Xác nhận thành công!');
            setDone(true);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Xác nhận thất bại');
        } finally {
            setIsConfirming(false);
        }
    };

    const handleDispute = async () => {
        if (!disputeReason.trim()) { toast.error('Vui lòng nhập lý do'); return; }
        setIsDisputing(true);
        try {
            await api.post(`/rescue-requests/${requestId}/payment/dispute`, { reason: disputeReason });
            toast.success('Đã báo sự cố. Chúng tôi sẽ xem xét.');
            setShowDispute(false);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Gửi thất bại');
        } finally {
            setIsDisputing(false);
        }
    };

    // Parse surchargeNote: could be new {breakdown, surcharges} JSON or legacy array/text
    let breakdownItems: { label: string; amount: number }[] = [];
    let surchargeItems: { label: string; amount: number }[] = [];
    let surchargeText: string | null = null;

    if (payment.surchargeNote) {
        try {
            const parsed = JSON.parse(payment.surchargeNote);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                breakdownItems = parsed.breakdown ?? [];
                surchargeItems = parsed.surcharges ?? [];
            } else if (Array.isArray(parsed)) {
                breakdownItems = parsed;
            }
        } catch {
            surchargeText = payment.surchargeNote;
        }
    }

    const hasDetails = breakdownItems.length > 0 || surchargeItems.length > 0 || surchargeText ||
        payment.baseFee > 0 || payment.otherFee > 0;

    return (
        <>
            {/* Main Card */}
            <div className="rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 12px rgba(0,0,0,0.08)' }}>
                {/* Header */}
                <div className="px-4 py-3 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #f97316, #ea6c0a)' }}>
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-xs text-white/80">Yêu cầu thanh toán từ</p>
                        <p className="text-sm font-bold text-white">{providerName ?? 'Provider'}</p>
                    </div>
                </div>

                {/* Body */}
                <div className="bg-white px-4 py-4">
                    {/* Total */}
                    <div className="text-center mb-4">
                        <p className="text-xs mb-1" style={{ color: C.gray }}>Tổng tiền cần thanh toán</p>
                        <p className="text-3xl font-bold" style={{ color: C.orange }}>{fmt(payment.totalAmount)}</p>
                        <p className="text-xs mt-1" style={{ color: C.gray }}>
                            Thanh toán bằng <span className="font-semibold">{payment.paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản QR'}</span>
                        </p>
                    </div>

                    {/* Details toggle */}
                    {hasDetails && (
                        <button
                            onClick={() => setShowBreakdown(v => !v)}
                            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl mb-3"
                            style={{ background: C.bg }}
                        >
                            <span className="text-xs font-semibold" style={{ color: C.navy }}>
                                Xem chi tiết {breakdownItems.length > 0 && `(${breakdownItems.length} mục)`}
                                {surchargeItems.length > 0 && ` • ${surchargeItems.length} phụ phí`}
                            </span>
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.gray} strokeWidth={2.5}
                                className={`transition-transform ${showBreakdown ? 'rotate-180' : ''}`}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    )}

                    {showBreakdown && (
                        <div className="rounded-xl overflow-hidden mb-3" style={{ border: `1px solid ${C.border}` }}>
                            {breakdownItems.length > 0 && (
                                <>
                                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: '#eff6ff', color: '#2563eb' }}>
                                        Chi tiết
                                    </div>
                                    {breakdownItems.map(({ label, amount }: { label: string; amount: number }, i: number) => (
                                        <div key={i} className="flex justify-between px-3 py-2.5 text-sm"
                                            style={{ borderTop: `1px solid ${C.border}`, color: C.navy }}>
                                            <span style={{ color: C.gray }}>{label || `Mục ${i + 1}`}</span>
                                            <span className="font-semibold">{fmt(amount)}</span>
                                        </div>
                                    ))}
                                </>
                            )}

                            {breakdownItems.length === 0 && payment.baseFee > 0 && (
                                <div className="flex justify-between px-3 py-2.5 text-sm" style={{ color: C.navy }}>
                                    <span style={{ color: C.gray }}>Phí dịch vụ</span>
                                    <span className="font-semibold">{fmt(payment.baseFee)}</span>
                                </div>
                            )}

                            {surchargeItems.length > 0 && (
                                <>
                                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: '#fff7ed', color: C.orange }}>
                                        Phụ phí phát sinh
                                    </div>
                                    {surchargeItems.map(({ label, amount }: { label: string; amount: number }, i: number) => (
                                        <div key={i} className="flex justify-between px-3 py-2.5 text-sm"
                                            style={{ borderTop: `1px solid ${C.border}`, color: C.navy }}>
                                            <span style={{ color: C.gray }}>{label || `Khoản ${i + 1}`}</span>
                                            <span className="font-semibold" style={{ color: C.orange }}>+{fmt(amount)}</span>
                                        </div>
                                    ))}
                                </>
                            )}

                            {surchargeText && (
                                <div className="px-3 py-2 text-xs italic" style={{ color: C.gray, borderTop: `1px solid ${C.border}` }}>
                                    {surchargeText}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Note */}
                    {payment.note && (
                        <div className="px-3 py-2.5 rounded-xl mb-3 text-xs italic" style={{ background: C.bg, color: C.gray }}>
                            "{payment.note}"
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Post-confirm finish state ─── */}
            {alreadyConfirmed && (
                <div className="mt-3">
                    <div
                        className="rounded-2xl p-4 mb-3 text-center"
                        style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '1.5px solid #86efac' }}
                    >
                        <div
                            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                            style={{ background: 'white', boxShadow: '0 2px 8px rgba(22,163,74,0.2)' }}
                        >
                            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <p className="text-sm font-bold mb-1" style={{ color: '#15803d' }}>
                            Xác nhận thanh toán thành công!
                        </p>
                        <p className="text-xs" style={{ color: '#166534' }}>
                            Cảm ơn bạn đã sử dụng dịch vụ.{' '}
                            <span className="font-medium">Provider đang xác nhận nhận tiền.</span>
                        </p>
                    </div>

                    <div
                        className="flex items-center justify-between px-4 py-3 rounded-xl"
                        style={{ background: C.bg }}
                    >
                        <span className="text-xs" style={{ color: C.gray }}>Số tiền đã thanh toán</span>
                        <span className="text-base font-bold" style={{ color: C.orange }}>{fmt(payment.totalAmount)}</span>
                    </div>
                </div>
            )}


            {/* ─── Actions (not yet confirmed) ─── */}
            {!alreadyConfirmed && (
                <div className="mt-2 space-y-2">
                    <button
                        onClick={handleConfirm}
                        disabled={isConfirming}
                        className="w-full py-3.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                        style={{
                            background: isConfirming ? C.gray : `linear-gradient(135deg, ${C.green}, #15803d)`,
                            boxShadow: isConfirming ? 'none' : '0 4px 16px rgba(22,163,74,0.35)',
                        }}
                    >
                        {isConfirming ? (
                            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                                <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                        ) : (
                            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                        Tôi đã thanh toán tiền mặt
                    </button>
                    <button
                        onClick={() => setShowDispute(true)}
                        className="w-full py-3 rounded-2xl text-sm font-semibold"
                        style={{ background: '#fef2f2', color: '#dc2626' }}
                    >
                        Báo sự cố
                    </button>
                </div>
            )}

            {/* Dispute Modal */}
            {showDispute && (
                <div
                    className="fixed inset-0 z-[70] flex items-end"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                    onClick={() => setShowDispute(false)}
                >
                    <div
                        className="w-full px-4 pb-8 pt-5"
                        style={{ background: 'white', borderRadius: '24px 24px 0 0' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: C.border }} />
                        <h3 className="text-sm font-bold mb-1" style={{ color: C.navy }}>Báo sự cố thanh toán</h3>
                        <p className="text-xs mb-3" style={{ color: C.gray }}>Mô tả vấn đề bạn gặp phải, chúng tôi sẽ xem xét và liên hệ lại.</p>
                        <textarea
                            value={disputeReason}
                            onChange={e => setDisputeReason(e.target.value)}
                            placeholder="Ví dụ: Số tiền không khớp với thỏa thuận ban đầu..."
                            rows={3}
                            className="w-full py-2.5 px-3 rounded-xl text-sm outline-none resize-none mb-3"
                            style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.navy }}
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setShowDispute(false)}
                                className="py-3 rounded-2xl text-sm font-semibold"
                                style={{ background: C.bg, color: C.gray }}
                            >
                                Huỷ
                            </button>
                            <button
                                onClick={handleDispute}
                                disabled={isDisputing}
                                className="py-3 rounded-2xl text-sm font-bold text-white"
                                style={{ background: '#dc2626' }}
                            >
                                {isDisputing ? 'Đang gửi...' : 'Gửi báo cáo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
