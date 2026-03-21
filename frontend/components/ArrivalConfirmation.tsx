'use client';

import { useState } from 'react';
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
};

interface ArrivalConfirmationProps {
    requestId: string;
    providerName: string;
    /** Called after user responds (either way) */
    onResponded: (confirmed: boolean) => void;
}

export default function ArrivalConfirmation({ requestId, providerName, onResponded }: ArrivalConfirmationProps) {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(false);

    const handleResponse = async (confirmed: boolean) => {
        setIsLoading(true);
        try {
            if (confirmed) {
                await api.patch(`/rescue-requests/${requestId}/confirm-arrival`);
            } else {
                await api.patch(`/rescue-requests/${requestId}/deny-arrival`);
            }
            onResponded(confirmed);
        } catch (err: any) {
            toast.error(err.response?.data?.message || t('user.tracking.arrival.defaultError'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-end"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
        >
            <div
                className="w-full px-4 pb-8 pt-6 animate-slide-up"
                style={{
                    background: 'white',
                    borderRadius: '28px 28px 0 0',
                    boxShadow: '0 -12px 48px rgba(0,0,0,0.20)',
                }}
            >
                {/* Drag handle */}
                <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: C.border }} />

                {/* Ping animation icon */}
                <div className="relative w-20 h-20 mx-auto mb-4">
                    <span
                        className="absolute inset-0 rounded-full animate-ping"
                        style={{ background: '#fef3c7', opacity: 0.6 }}
                    />
                    <div
                        className="relative w-20 h-20 rounded-full flex items-center justify-center"
                        style={{ background: '#fef9ee' }}
                    >
                        <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                </div>

                <h2 className="text-lg font-bold text-center mb-1" style={{ color: C.navy }}>
                    {t('user.tracking.arrival.title')}
                </h2>
                <p className="text-sm text-center mb-1" style={{ color: C.gray }} dangerouslySetInnerHTML={{ __html: t('user.tracking.arrival.desc', { name: providerName }) }} />
                <p className="text-sm text-center mb-7" style={{ color: C.gray }}>
                    {t('user.tracking.arrival.warning')}
                </p>

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-3">
                    {/* NO button */}
                    <button
                        onClick={() => handleResponse(false)}
                        disabled={isLoading}
                        className="py-4 rounded-2xl text-sm font-semibold border-2 flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
                        style={{
                            borderColor: '#fca5a5',
                            color: '#dc2626',
                            background: '#fef2f2',
                        }}
                    >
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#dc2626" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        {t('user.tracking.arrival.denyBtn')}
                    </button>

                    {/* YES button */}
                    <button
                        onClick={() => handleResponse(true)}
                        disabled={isLoading}
                        className="py-4 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
                        style={{
                            background: isLoading
                                ? C.gray
                                : 'linear-gradient(135deg, #16a34a, #15803d)',
                            boxShadow: isLoading ? 'none' : '0 4px 16px rgba(22,163,74,0.35)',
                        }}
                    >
                        {isLoading ? (
                            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                                <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                        ) : (
                            <>
                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                                {t('user.tracking.arrival.confirmBtn')}
                            </>
                        )}
                    </button>
                </div>

                {/* Contact note */}
                <p className="text-xs text-center mt-4" style={{ color: C.gray }}>
                    {t('user.tracking.arrival.contactNote')}
                </p>
            </div>

            <style jsx>{`
                @keyframes slide-up {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-slide-up {
                    animation: slide-up 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
            `}</style>
        </div>
    );
}
