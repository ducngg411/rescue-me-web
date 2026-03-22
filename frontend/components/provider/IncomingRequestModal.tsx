'use client';

import { useState, useEffect, useRef } from 'react';
import { PendingRequest } from '@/lib/hooks/usePendingRequests';
import { useLanguage } from '@/contexts/LanguageContext';
import AvatarImage from '@/components/AvatarImage';
import {
    matchingQuoteWindowSecondsRemaining,
    type MatchingQuoteWindowSource,
} from '@/lib/matchingQuoteWindowCountdown';

function pendingToMatchingSource(r: PendingRequest): MatchingQuoteWindowSource {
    return {
        status: 'MATCHING',
        quoteWindowOpen: r.quoteWindowOpen,
        quoteWindowExpiresAt: r.quoteWindowExpiresAt,
        expiresAt: r.expiresAt,
        quoteWindowTimeRemaining: r.quoteWindowTimeRemaining ?? r.timeRemaining,
    };
}

interface IncomingRequestModalProps {
    request: PendingRequest;
    onViewDetails: () => void;
    onClose: () => void;    // just closes the modal, request stays in inbox
    onDecline: () => void;  // actually declines the request
    isProcessing: boolean;
}



const C = {
    orange: '#f97316',
    orangeDark: '#ea6c0a',
    orangeLight: '#fff7ed',
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#f1f5f9',
    bg: '#f8fafc',
};

export default function IncomingRequestModal({
    request,
    onViewDetails,
    onClose,
    onDecline,
    isProcessing,
}: IncomingRequestModalProps) {
    const { t } = useLanguage();
    const requestRef = useRef(request);
    requestRef.current = request;
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    const [timeLeft, setTimeLeft] = useState(() =>
        matchingQuoteWindowSecondsRemaining(pendingToMatchingSource(request)),
    );
    const [progressDenom, setProgressDenom] = useState(() =>
        Math.max(1, matchingQuoteWindowSecondsRemaining(pendingToMatchingSource(request))),
    );

    useEffect(() => {
        setProgressDenom(1);

        const tick = () =>
            matchingQuoteWindowSecondsRemaining(pendingToMatchingSource(requestRef.current));

        const step = () => {
            const tLeft = tick();
            setTimeLeft(tLeft);
            setProgressDenom((d) => Math.max(d, tLeft));
            return tLeft;
        };

        const first = step();
        if (first <= 0) {
            onCloseRef.current();
            return;
        }

        const interval = setInterval(() => {
            const tLeft = step();
            if (tLeft <= 0) {
                clearInterval(interval);
                onCloseRef.current();
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [request.id]);

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const progressPercent = (timeLeft / Math.max(progressDenom, 1)) * 100;

    // Use real ETA from backend (VietMap API) or fallback to distance-based calculation
    const estimatedMinutes = request.eta || Math.ceil((request.distance / 40) * 60);

    const quoteWindowOpen = request.quoteWindowOpen ?? true;
    const quoteWindowCritical = quoteWindowOpen && timeLeft > 0 && timeLeft <= 10;
    const quoteWindowClosed = !quoteWindowOpen || timeLeft === 0;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* ─── Header ─── */}
                <div className="relative px-6 py-5 text-white flex-shrink-0" style={{ background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})` }}>
                    <h2 className="text-xl font-bold tracking-tight">{t('components.incomingRequest.newRescueRequest')}</h2>
                    <p className="text-sm text-white/90 mt-1 font-medium">{t('components.incomingRequest.pleaseRespond')}</p>
                    {/* Decorative element */}
                    <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2L4 7v10l8 5 8-5V7L12 2z" />
                        </svg>
                    </div>
                </div>

                {/* ─── Content ─── */}
                <div className="p-6 space-y-4 overflow-y-auto">
                    {/* Customer Info */}
                    <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                        <AvatarImage
                            name={request.user.name || request.user.phone || 'Khach hang'}
                            avatar={request.user.avatar}
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                            fallbackBackground={C.orange}
                            initialsCount={1}
                        />
                        <div>
                            <div className="text-[10px] font-bold tracking-wider mb-0.5" style={{ color: C.gray }}>{t('components.incomingRequest.customer')}</div>
                            <div className="font-semibold text-sm" style={{ color: C.navy }}>{request.user.name || t('components.incomingRequest.customerFallback')}</div>
                            <div className="text-sm font-medium opacity-70" style={{ color: C.navy }}>
                                {request.user.phone ? request.user.phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2') : ''}
                            </div>
                        </div>
                    </div>

                    {/* Location */}
                    <div className="rounded-2xl p-4" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                        <div className="text-[10px] font-bold tracking-wider mb-1.5" style={{ color: '#16aecb' }}>{t('components.incomingRequest.accidentLocation')}</div>
                        <div className="text-sm font-medium" style={{ color: C.navy }}>{request.pickupLocation.address}</div>
                    </div>

                    {/* Incident Details */}
                    <div className="rounded-2xl p-4 space-y-3" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                        <div className="text-[10px] font-bold tracking-wider" style={{ color: C.gray }}>{t('components.incomingRequest.incidentDetails')}</div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="text-[10px] uppercase mb-0.5" style={{ color: C.gray }}>{t('components.incomingRequest.vehicleType')}</div>
                                <div className="text-sm font-bold" style={{ color: C.navy }}>
                                    {t(`components.incomingRequest.vehicleLabels.${request.vehicleType}` as any) || request.vehicleType}
                                </div>
                            </div>
                            <div>
                                <div className="text-[10px] uppercase mb-0.5" style={{ color: C.gray }}>{t('components.incomingRequest.incidentType')}</div>
                                <div className="text-sm font-bold" style={{ color: C.navy }}>
                                    {t(`components.incomingRequest.incidentLabels.${request.incidentType}` as any) || request.incidentType}
                                </div>
                            </div>
                        </div>
                        {request.description && (
                            <div className="pt-3 mt-1" style={{ borderTop: `1px solid ${C.border}` }}>
                                <div className="text-[10px] uppercase mb-1" style={{ color: C.gray }}>{t('components.incomingRequest.description')}</div>
                                <div className="text-sm font-medium italic" style={{ color: C.navy }}>"{request.description}"</div>
                            </div>
                        )}
                    </div>

                    {/* Distance & Earnings */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl p-4 flex flex-col justify-center" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                            <div className="text-[10px] font-bold tracking-wider mb-1" style={{ color: '#2563eb' }}>{t('components.incomingRequest.fromYou')}</div>
                            <div className="text-2xl font-black tracking-tight" style={{ color: '#1d4ed8' }}>
                                ~{estimatedMinutes}'
                            </div>
                            <div className="text-xs font-semibold mt-0.5" style={{ color: '#3b82f6' }}>
                                {request.distance < 1
                                    ? `${(request.distance * 1000).toFixed(0)} m`
                                    : `${request.distance.toFixed(1)} km`
                                }
                            </div>
                        </div>
                        <div className="rounded-2xl p-4 flex flex-col justify-center" style={{ background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                            <div className="text-[10px] font-bold tracking-wider mb-1" style={{ color: '#059669' }}>{t('components.incomingRequest.estimatedEarnings2')}</div>
                            <div className="text-xl font-black tracking-tight" style={{ color: '#047857' }}>
                                {request.estimatedEarnings.toLocaleString()}₫
                            </div>
                        </div>
                    </div>

                    {/* Media Preview */}
                    {request.media && request.media.length > 0 && (
                        <div className="rounded-2xl p-4" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                            <div className="text-[10px] font-bold tracking-wider mb-2.5" style={{ color: C.gray }}>
                                {t('components.incomingRequest.mediaAttachments')} ({request.media.length})
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                                {request.media.slice(0, 4).map((media, idx) => (
                                    <div key={idx} className="flex-shrink-0 w-16 h-16 bg-white rounded-xl border overflow-hidden" style={{ borderColor: C.border }}>
                                        {media.type === 'IMAGE' ? (
                                            <img src={media.url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-100 text-xs text-gray-500 font-medium">
                                                VIDEO
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {request.media.length > 4 && (
                                    <div className="flex-shrink-0 w-16 h-16 rounded-xl border flex items-center justify-center" style={{ background: C.bg, borderColor: C.border }}>
                                        <span className="text-xs font-bold" style={{ color: C.navy }}>+{request.media.length - 4}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Countdown Timer */}
                    <div className="pt-2">
                        <div className="text-center mb-3">
                            <div className="text-3xl font-black tracking-tight" style={{ color: C.navy }}>
                                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                            </div>
                            <div className="text-xs font-medium mt-0.5" style={{ color: C.gray }}>
                                {request.quoteWindowExpiresAt
                                    ? t('components.incomingRequest.quoteTimeLabel')
                                    : t('components.incomingRequest.responseTimeLabel')
                                }
                            </div>
                        </div>
                        <div className="w-full rounded-full h-2.5 overflow-hidden" style={{ background: C.border }}>
                            <div
                                className="h-full transition-all duration-1000 rounded-full"
                                style={{
                                    width: `${progressPercent}%`,
                                    background: progressPercent < 25 ? '#ef4444' : C.orange
                                }}
                            />
                        </div>
                    </div>

                    {/* Quote Window Status Warning */}
                    {quoteWindowClosed && (
                        <div className="rounded-xl p-3" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                            <div className="flex items-center gap-2.5">
                                <span className="text-lg">⏰</span>
                                <div>
                                    <div className="text-sm font-bold" style={{ color: '#991b1b' }}>{t('components.incomingRequest.quoteWindowClosedTitle')}</div>
                                    <div className="text-xs font-medium" style={{ color: '#b91c1c' }}>{t('components.incomingRequest.quoteWindowClosedDesc')}</div>
                                </div>
                            </div>
                        </div>
                    )}
                    {!quoteWindowClosed && quoteWindowCritical && (
                        <div className="rounded-xl p-3" style={{ background: C.orangeLight, border: `1px solid #fed7aa` }}>
                            <div className="flex items-center gap-2.5">
                                <span className="text-lg">⚡</span>
                                <div>
                                    <div className="text-sm font-bold" style={{ color: '#9a3412' }}>{t('components.incomingRequest.quoteWindowCriticalTitle').replace('{time}', String(timeLeft))}</div>
                                    <div className="text-xs font-medium" style={{ color: C.orangeDark }}>{t('components.incomingRequest.quoteWindowCriticalDesc')}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons: 3 buttons in a row */}
                    <div className="grid grid-cols-3 gap-2 pt-4">
                        {/* Đóng – only closes modal */}
                        <button
                            onClick={onClose}
                            disabled={isProcessing}
                            className="px-2 py-3.5 border-2 text-xs font-bold rounded-2xl hover:bg-gray-50 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ borderColor: C.border, color: C.gray }}
                        >
                            {t('components.incomingRequest.closeBtn')}
                        </button>
                        {/* Decline – declines the request */}
                        <button
                            onClick={onDecline}
                            disabled={isProcessing}
                            className="px-2 py-3.5 text-xs font-bold rounded-2xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }}
                        >
                            {t('components.incomingRequest.declineBtn')}
                        </button>
                        {/* View Details & Submit Quote */}
                        <button
                            onClick={onViewDetails}
                            disabled={isProcessing || quoteWindowClosed}
                            className={`px-2 py-3.5 text-xs font-bold shadow-md rounded-2xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${quoteWindowClosed
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : 'text-white'
                                }`}
                            style={!quoteWindowClosed ? {
                                background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`,
                                boxShadow: `0 4px 14px ${C.orange}40`
                            } : {}}
                            title={quoteWindowClosed ? t('components.incomingRequest.expiredWindowTitle') : ''}
                        >
                            {quoteWindowClosed ? t('components.incomingRequest.expired') : t('components.incomingRequest.viewDetailsSend')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
