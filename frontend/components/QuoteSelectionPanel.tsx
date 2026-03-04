'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const C = {
    orange: '#f97316',
    orangeDark: '#ea6c0a',
    orangeLight: '#fff7ed',
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#f1f5f9',
    bg: '#f8fafc',
};

interface Quote {
    id: string;
    price: number;
    estimatedArrivalMinutes: number;
    message?: string;
    status: string;
    createdAt: string;
    provider: {
        id: string;
        name: string | null;
        avatar?: string | null;
        serviceName: string | null;
        phoneNumber: string | null;
    };
}

interface QuoteSelectionPanelProps {
    requestId: string;
    quoteCount: number;
    onQuoteAccepted: () => void;
}

function formatPrice(price: number) {
    return price.toLocaleString('vi-VN') + '₫';
}

export default function QuoteSelectionPanel({
    requestId,
    quoteCount,
    onQuoteAccepted,
}: QuoteSelectionPanelProps) {
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [acceptingId, setAcceptingId] = useState<string | null>(null);

    useEffect(() => {
        fetchQuotes();
    }, [requestId]);

    const fetchQuotes = async () => {
        try {
            setIsLoading(true);
            const res = await api.get(`/rescue-requests/${requestId}/quotes`);
            // Only show PENDING quotes (not yet accepted/rejected)
            const pending = res.data.filter((q: Quote) => q.status === 'PENDING');
            setQuotes(pending);
        } catch (err) {
            console.error('Error fetching quotes:', err);
            toast.error('Không thể tải danh sách báo giá');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAccept = async (quoteId: string) => {
        if (acceptingId) return;
        setAcceptingId(quoteId);
        try {
            await api.patch(`/rescue-requests/${requestId}/quotes/${quoteId}/respond`, {
                action: 'ACCEPT',
            });
            toast.success('Đã chọn báo giá! Provider đang chuẩn bị đến.');
            onQuoteAccepted();
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Không thể chọn báo giá. Vui lòng thử lại.';
            toast.error(msg);
            setAcceptingId(null);
        }
    };

    const pendingQuotes = quotes.filter(q => q.status === 'PENDING');

    if (isLoading) {
        return (
            <div className="bg-white rounded-2xl p-8 text-center" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto mb-3" style={{ borderColor: C.orange }} />
                <p className="text-sm" style={{ color: C.gray }}>Đang tải báo giá...</p>
            </div>
        );
    }

    if (pendingQuotes.length === 0) {
        return (
            <div className="bg-white rounded-2xl p-8 text-center" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: '#fefce8' }}>
                    <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#ca8a04" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h3 className="text-sm font-bold mb-1" style={{ color: C.navy }}>Các báo giá đã hết hạn</h3>
                <p className="text-xs" style={{ color: C.gray }}>Không còn báo giá khả dụng. Vui lòng thử lại yêu cầu.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#f5f3ff' }}>
                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#7c3aed" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="font-bold text-sm" style={{ color: C.navy }}>Chọn báo giá phù hợp</h2>
                        <p className="text-xs" style={{ color: C.gray }}>
                            Đã nhận <span className="font-semibold" style={{ color: '#7c3aed' }}>{pendingQuotes.length}</span> báo giá từ providers
                        </p>
                    </div>
                </div>
                <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: '#f5f3ff' }}>
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#7c3aed" strokeWidth={2} className="flex-shrink-0 mt-0.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs" style={{ color: '#7c3aed' }}>
                        Nhấn <strong>"Chọn báo giá này"</strong> để xác nhận provider. Các provider còn lại sẽ được thông báo và tự do nhận yêu cầu khác.
                    </p>
                </div>
            </div>

            {/* Quote Cards */}
            {pendingQuotes.map((quote, idx) => {
                const providerName = quote.provider.serviceName || quote.provider.name || 'Provider';
                const initials = providerName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                const isAccepting = acceptingId === quote.id;
                const isDisabled = !!acceptingId;

                return (
                    <div
                        key={quote.id}
                        className="bg-white rounded-2xl overflow-hidden"
                        style={{
                            boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
                            border: isAccepting ? `2px solid ${C.orange}` : '2px solid transparent',
                            opacity: isDisabled && !isAccepting ? 0.6 : 1,
                            transition: 'all 0.2s',
                        }}
                    >
                        {/* Rank badge */}
                        {idx === 0 && (
                            <div
                                className="px-4 py-1.5 flex items-center gap-1.5 text-xs font-semibold"
                                style={{ background: C.orangeLight, color: C.orange }}
                            >
                                <svg width="12" height="12" viewBox="0 0 20 20" fill={C.orange}>
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                                Báo giá tốt nhất
                            </div>
                        )}

                        <div className="p-4">
                            {/* Provider info */}
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                                    style={{ background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})` }}>
                                    {initials}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm" style={{ color: C.navy }}>{providerName}</p>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        <svg width="10" height="10" viewBox="0 0 20 20" fill="#f59e0b">
                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                        </svg>
                                        <span className="text-[11px] font-medium" style={{ color: C.navy }}>4.8</span>
                                        <span className="text-[11px]" style={{ color: C.gray }}>(52 đánh giá)</span>
                                    </div>
                                </div>
                                {quote.provider.phoneNumber && (
                                    <a
                                        href={`tel:${quote.provider.phoneNumber}`}
                                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                        style={{ background: '#f0fdf4', color: '#16a34a' }}
                                    >
                                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                        </svg>
                                    </a>
                                )}
                            </div>

                            {/* Price + ETA tiles */}
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="rounded-xl p-3" style={{ background: C.bg }}>
                                    <div className="flex items-center gap-1 mb-1">
                                        <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span className="text-[10px]" style={{ color: C.gray }}>Giá dịch vụ</span>
                                    </div>
                                    <p className="text-base font-bold" style={{ color: C.navy }}>{formatPrice(quote.price)}</p>
                                </div>
                                <div className="rounded-xl p-3" style={{ background: C.bg }}>
                                    <div className="flex items-center gap-1 mb-1">
                                        <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span className="text-[10px]" style={{ color: C.gray }}>Đến trong</span>
                                    </div>
                                    <p className="text-base font-bold" style={{ color: C.navy }}>{quote.estimatedArrivalMinutes} phút</p>
                                </div>
                            </div>

                            {/* Message */}
                            {quote.message && (
                                <div className="rounded-xl p-3 mb-4" style={{ background: C.bg }}>
                                    <p className="text-[10px] font-medium mb-1" style={{ color: C.gray }}>Lời nhắn từ provider</p>
                                    <p className="text-xs italic" style={{ color: C.navy }}>"{quote.message}"</p>
                                </div>
                            )}

                            {/* Accept button */}
                            <button
                                onClick={() => handleAccept(quote.id)}
                                disabled={isDisabled}
                                className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                style={{
                                    background: isAccepting
                                        ? C.gray
                                        : `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)`,
                                    boxShadow: isAccepting ? 'none' : `0 4px 12px ${C.orange}40`,
                                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                                }}
                            >
                                {isAccepting ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                        Đang xác nhận...
                                    </>
                                ) : (
                                    <>
                                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                        Chọn báo giá này
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
