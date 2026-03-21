'use client';

import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import PaymentSheet from './PaymentSheet';

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



interface WorkingViewProps {
    requestId: string;
    request: {
        incidentType?: string;
        vehicleType?: string;
        description?: string;
        pickupLocation?: { addressText?: string };
        contactPhone?: string;
    };
    customerName?: string | null;
    acceptedQuotePrice?: number | null;
    autoOpenPaymentSheet?: boolean;
    defaultPaymentMethod?: 'CASH' | 'QR' | 'WALLET';
    onPaymentSubmitted: (method?: 'CASH' | 'QR' | 'WALLET') => void;
}

export default function WorkingView({
    requestId,
    request,
    customerName,
    acceptedQuotePrice,
    autoOpenPaymentSheet = false,
    defaultPaymentMethod,
    onPaymentSubmitted,
}: WorkingViewProps) {
    const { t } = useLanguage();
    const [showPaymentSheet, setShowPaymentSheet] = useState(autoOpenPaymentSheet);

    const incidentLabels: Record<string, string> = {
        BREAKDOWN: t('provider.requestDetail.incidentLabels.BREAKDOWN'),
        ACCIDENT: t('provider.requestDetail.incidentLabels.ACCIDENT'),
        FLAT_TIRE: t('provider.requestDetail.incidentLabels.FLAT_TIRE'),
        BATTERY_DEAD: t('provider.requestDetail.incidentLabels.BATTERY_DEAD'),
        OUT_OF_FUEL: t('provider.requestDetail.incidentLabels.OUT_OF_FUEL'),
        LOCKED_OUT: t('provider.requestDetail.incidentLabels.LOCKED_OUT'),
        OTHER: t('provider.requestDetail.incidentLabels.OTHER'),
    };

    const tips = [
        { icon: '', text: t('provider.working.tip1') },
        { icon: '', text: t('provider.working.tip2') },
        { icon: '', text: t('provider.working.tip3') },
        { icon: '', text: t('provider.working.tip4') },
    ];

    return (
        <>
            <div
                className="fixed inset-0 z-50 overflow-y-auto"
                style={{ background: C.bg }}
            >
                {/* Header */}
                <div
                    className="sticky top-0 z-10 px-4 pt-10 pb-4"
                    style={{ background: 'white', borderBottom: `1px solid ${C.border}` }}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-full flex items-center justify-center"
                            style={{ background: C.greenLight }}
                        >
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={C.green} strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-xs font-medium" style={{ color: C.green }}>{t('provider.working.headerBadge')}</p>
                            <h1 className="text-base font-bold" style={{ color: C.navy }}>{t('provider.working.headerTitle')}</h1>
                        </div>
                        <div
                            className="ml-auto px-3 py-1 rounded-full text-xs font-semibold"
                            style={{ background: C.greenLight, color: C.green }}
                        >
                            {t('provider.working.activeBadge')}
                        </div>
                    </div>
                </div>

                <div className="px-4 py-4 space-y-4 pb-32">
                    {/* Request Info Card */}
                    <div
                        className="rounded-2xl p-4"
                        style={{ background: 'white', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
                    >
                        <h2 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: C.gray }}>
                            {t('provider.working.requestInfoTitle')}
                        </h2>

                        <div className="space-y-3">
                            {/* Incident */}
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#fff7ed' }}>
                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-xs" style={{ color: C.gray }}>{t('provider.working.incidentLabel')}</p>
                                    <p className="text-sm font-semibold" style={{ color: C.navy }}>
                                        {incidentLabels[request.incidentType ?? ''] ?? request.incidentType ?? '—'}
                                        {request.vehicleType && <span className="ml-1 text-xs font-normal" style={{ color: C.gray }}>({t(`provider.requestDetail.vehicleLabels.${request.vehicleType}` as any) ?? request.vehicleType})</span>}
                                    </p>
                                </div>
                            </div>

                            {/* Location */}
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#eff6ff' }}>
                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#2563eb" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-xs" style={{ color: C.gray }}>{t('provider.working.locationLabel')}</p>
                                    <p className="text-sm font-semibold" style={{ color: C.navy }}>
                                        {request.pickupLocation?.addressText ?? '—'}
                                    </p>
                                </div>
                            </div>

                            {/* Customer */}
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: C.greenLight }}>
                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={C.green} strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-xs" style={{ color: C.gray }}>{t('provider.working.customerLabel')}</p>
                                    <p className="text-sm font-semibold" style={{ color: C.navy }}>{customerName ?? '—'}</p>
                                    {request.contactPhone && (
                                        <p className="text-xs" style={{ color: C.gray }}>{request.contactPhone}</p>
                                    )}
                                </div>
                            </div>

                            {/* Description */}
                            {request.description && (
                                <div className="pt-2 border-t" style={{ borderColor: C.border }}>
                                    <p className="text-xs italic" style={{ color: C.gray }}>"{request.description}"</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Tips */}
                    <div
                        className="rounded-2xl p-4"
                        style={{ background: 'white', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
                    >
                        <h2 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: C.gray }}>
                            {t('provider.working.tipsTitle')}
                        </h2>
                        <div className="space-y-2">
                            {tips.map((tip, i) => (
                                <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl" style={{ background: C.bg }}>
                                    <span className="text-sm flex-shrink-0">{tip.icon}</span>
                                    <p className="text-xs leading-relaxed" style={{ color: C.navy }}>{tip.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Sticky CTA */}
                <div
                    className="fixed bottom-0 left-0 right-0 px-4 pb-8 pt-4"
                    style={{ background: 'white', borderTop: `1px solid ${C.border}`, boxShadow: '0 -4px 20px rgba(0,0,0,0.08)' }}
                >
                    <button
                        onClick={() => setShowPaymentSheet(true)}
                        className="w-full py-4 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2"
                        style={{
                            background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`,
                            boxShadow: `0 4px 20px ${C.orange}50`,
                        }}
                    >
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {t('provider.working.completeBtn')}
                    </button>
                    <p className="text-center text-xs mt-2" style={{ color: C.gray }}>
                        {t('provider.working.completeHint')}
                    </p>
                </div>
            </div>

            {/* Payment Sheet */}
            {showPaymentSheet && (
                <PaymentSheet
                    requestId={requestId}
                    defaultAmount={acceptedQuotePrice ?? 0}
                    defaultPaymentMethod={defaultPaymentMethod}
                    onClose={() => setShowPaymentSheet(false)}
                    onSubmitted={(method?: 'CASH' | 'QR' | 'WALLET') => onPaymentSubmitted(method)}
                />
            )}
        </>
    );
}
