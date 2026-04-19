'use client';

import { useState, lazy, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/lib/hooks/useChat';
import { useLanguage } from '@/contexts/LanguageContext';

const ChatModal = lazy(() => import('@/components/ChatModal'));

const C = {
    orange: '#f97316',
    orangeDark: '#ea6c0a',
    orangeLight: '#fff7ed',
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#f1f5f9',
    bg: '#f8fafc',
};

interface Provider {
    id: string;
    name: string | null;
    avatar?: string | null;
    serviceName: string | null;
    serviceTypes: string[];
    phoneNumber: string | null;
    pricePerKm: number | null;
    baseFee: number | null;
    isOnline: boolean;
    averageRating: number | null;
    reviewCount: number;
}

interface AssignedProviderProps {
    provider: Provider;
    distance?: number;
    eta?: number;
    /** 'ASSIGNED' = chuẩn bị, 'IN_PROGRESS' = đang di chuyển */
    requestStatus?: string;
    /** requestId to identify which Firestore chat room to use */
    requestId?: string;
    /** Guest flow: stable id + display name for chat (Firestore); logged-in user ignored for chat when set */
    chatCustomerId?: string;
    chatCustomerName?: string;
}

export default function AssignedProvider({
    provider,
    distance,
    eta,
    requestStatus,
    requestId,
    chatCustomerId,
    chatCustomerName,
}: AssignedProviderProps) {
    const [isChatOpen, setIsChatOpen] = useState(false);

    const { user: currentUser } = useAuth();
    const { t } = useLanguage();
    const currentUserId = chatCustomerId ?? currentUser?.id ?? '';
    const currentUserName =
        chatCustomerName ??
        currentUser?.name ??
        currentUser?.email?.split('@')[0] ??
        t('user.tracking.assignedProvider.customerFallback');

    const displayName = provider.serviceName || provider.name || 'Provider';
    const initials = displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
    const serviceLabels = provider.serviceTypes
        .map(type => {
            const key = `provider.profileDashboard.serviceLabels.${type}`;
            const label = t(key);
            return label === key ? type : label;
        })
        .join(', ');

    const displayDistance = distance
        ? (distance < 1 ? `${(distance * 1000).toFixed(0)} m` : `${distance.toFixed(1)} km`)
        : t('user.tracking.assignedProvider.distanceUpdating');
    const displayEta = eta
        ? t('user.tracking.assignedProvider.etaMinutes', { minutes: eta })
        : t('user.tracking.assignedProvider.distanceUpdating');

    const handleCall = () => { if (provider.phoneNumber) window.location.href = `tel:${provider.phoneNumber}`; };

    // Subscribe to unread count even when chat is closed
    const chatEnabled = !!(requestId && currentUserId);
    const { unreadCount } = useChat({
        requestId: requestId ?? '__none__',
        currentUserId,
        currentUserRole: 'CUSTOMER',
        currentUserName,
        enabled: chatEnabled,
    });

    const providerDisplayName = provider.serviceName || provider.name || 'Provider';

    return (
        <div className="space-y-3">
            {/* Status badge */}
            <div className="flex justify-center">
                {requestStatus === 'IN_PROGRESS' ? (
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold" style={{ background: '#eff6ff', color: '#2563eb' }}>
                        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#3b82f6' }} />
                        {t('user.tracking.assignedProvider.statusInProgress')}
                    </div>
                ) : (
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#22c55e' }} />
                        {t('user.tracking.assignedProvider.statusAssigned')}
                    </div>
                )}
            </div>

            {/* Provider card */}
            <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                {/* Avatar + info */}
                <div className="flex items-start gap-3 mb-4">
                    <div
                        className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0 bg-cover bg-center"
                        style={{ background: provider?.avatar ? `url(${provider.avatar}) center/cover` : `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})` }}
                    >
                        {!provider?.avatar && initials}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold text-base leading-tight" style={{ color: C.navy }}>{displayName}</h3>
                            {provider.isOnline && (
                                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e' }} />
                                    {t('user.tracking.assignedProvider.onlineLabel')}
                                </div>
                            )}
                        </div>
                        {/* Rating */}
                        <div className="flex items-center gap-1.5 my-1">
                            <svg width="12" height="12" viewBox="0 0 20 20" fill="#f59e0b">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            {provider.averageRating != null ? (
                                <>
                                    <span className="text-xs font-medium" style={{ color: C.navy }}>{provider.averageRating.toFixed(1)}</span>
                                    {provider.reviewCount > 0 && (
                                        <span className="text-xs" style={{ color: C.gray }}>
                                            {t('user.tracking.quotes.reviews', { count: provider.reviewCount })}
                                        </span>
                                    )}
                                </>
                            ) : (
                                <span className="text-xs" style={{ color: C.gray }}>{t('user.tracking.assignedProvider.noReviews')}</span>
                            )}
                        </div>
                        {/* Services */}
                        {serviceLabels && (
                            <p className="text-xs" style={{ color: C.gray }}>{serviceLabels}</p>
                        )}
                    </div>
                </div>

                {/* Distance & ETA */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="rounded-xl p-3" style={{ background: C.bg }}>
                        <div className="flex items-center gap-1.5 mb-1">
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            <span className="text-[10px]" style={{ color: C.gray }}>{t('user.tracking.assignedProvider.distanceLabel')}</span>
                        </div>
                        <p className="text-lg font-bold" style={{ color: C.navy }}>{displayDistance}</p>
                    </div>
                    <div className="rounded-xl p-3" style={{ background: C.bg }}>
                        <div className="flex items-center gap-1.5 mb-1">
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-[10px]" style={{ color: C.gray }}>{t('user.tracking.assignedProvider.etaLabel')}</span>
                        </div>
                        <p className="text-lg font-bold" style={{ color: C.navy }}>{displayEta}</p>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={handleCall}
                        className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                        style={{ background: `linear-gradient(135deg, ${C.orange}, #ea6c0a)` }}
                    >
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {t('user.tracking.assignedProvider.callBtn')}
                    </button>

                    {/* In-app chat button with UNREAD BADGE */}
                    <button
                        onClick={() => setIsChatOpen(true)}
                        className="relative flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors"
                        style={{ background: C.orangeLight, color: C.orange, border: `1.5px solid ${C.orange}30` }}
                    >
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        {t('user.tracking.assignedProvider.messageBtn')}
                        {/* Unread badge */}
                        {unreadCount > 0 && (
                            <span
                                className="absolute -top-2 -right-2 min-w-[20px] h-[20px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                                style={{
                                    background: '#ef4444',
                                    boxShadow: '0 2px 6px rgba(239,68,68,0.6)',
                                    animation: 'pulse 1.5s cubic-bezier(0.4,0,0.6,1) infinite',
                                }}
                            >
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Info note */}
            <div className="rounded-xl p-3.5 flex items-start gap-3" style={{ background: requestStatus === 'IN_PROGRESS' ? '#eff6ff' : C.orangeLight }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={requestStatus === 'IN_PROGRESS' ? '#2563eb' : C.orange} strokeWidth={2} className="flex-shrink-0 mt-0.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                    {requestStatus === 'IN_PROGRESS' ? (
                        <>
                            <p className="text-sm font-semibold" style={{ color: '#1d4ed8' }}>{t('user.tracking.assignedProvider.noteInProgressTitle')}</p>
                            <p className="text-xs mt-0.5" style={{ color: '#3b82f6' }}>{t('user.tracking.assignedProvider.noteInProgressDesc')}</p>
                        </>
                    ) : (
                        <>
                            <p className="text-sm font-semibold" style={{ color: C.navy }}>{t('user.tracking.assignedProvider.noteAssignedTitle')}</p>
                            <p className="text-xs mt-0.5" style={{ color: C.gray }}>{t('user.tracking.assignedProvider.noteAssignedDesc')}</p>
                        </>
                    )}
                </div>
            </div>

            {/* Chat Modal */}
            {isChatOpen && requestId && currentUserId && (
                <Suspense fallback={null}>
                    <ChatModal
                        requestId={requestId}
                        currentUserId={currentUserId}
                        currentUserRole="CUSTOMER"
                        currentUserName={currentUserName}
                        myAvatar={currentUser?.avatar}
                        otherPartyName={providerDisplayName}
                        otherPartyAvatar={provider?.avatar}
                        onClose={() => setIsChatOpen(false)}
                    />
                </Suspense>
            )}
        </div>
    );
}
