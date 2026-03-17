'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProviderStatus } from '@/lib/hooks/useProviderStatus';
import { usePendingRequests } from '@/lib/hooks/usePendingRequests';
import { useProviderLocation } from '@/lib/hooks/useProviderLocation';
import IncomingRequestModal from '@/components/provider/IncomingRequestModal';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import PendingVerificationScreen from '@/components/PendingVerificationScreen';
import DepositGateScreen from '@/components/DepositGateScreen';
import AvatarImage from '@/components/AvatarImage';
import {
    Wallet, Settings, BookOpen, TrendingUp,
    Star, CheckCircle2,
    Bell, Clock, Wifi, WifiOff,
} from 'lucide-react';

// ─── same color tokens as user dashboard ──────────────────────────────────────
const C = {
    orange: '#f97316',
    orangeDark: '#ea6c0a',
    orangeLight: '#fff7ed',
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#f1f5f9',
    bg: '#f8fafc',
};

// ─── Dynamic VietMap (no SSR) ─────────────────────────────────────────────────
const VietMap = dynamic(() => import('@/components/VietMap'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex items-center justify-center" style={{ background: '#f1f5f9' }}>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: C.orange }} />
        </div>
    ),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatVnd(amount: number) {
    return `${amount.toLocaleString('vi-VN')}đ`;
}

// Greeting and incident labels are now handled via useLanguage() inside the component

// navItems are now built inside the component to access t()

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, bg }: { icon: React.ReactNode; label: string; value: string; sub?: string; bg: string }) {
    return (
        <div className="bg-white rounded-xl p-4 flex-1 min-w-0" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2.5" style={{ background: bg }}>
                {icon}
            </div>
            <p className="text-xs font-medium mb-1" style={{ color: C.gray }}>{label}</p>
            <p className="text-xl font-bold tabular-nums leading-none" style={{ color: C.navy }}>{value}</p>
            {sub && <p className="text-xs mt-1" style={{ color: C.gray }}>{sub}</p>}
        </div>
    );
}

// ─── Incoming Alert Card ──────────────────────────────────────────────────────
function AlertCard({ request, onView }: { request: any; onView: () => void }) {
    const timeAgo = request.createdAt
        ? Math.floor((Date.now() - new Date(request.createdAt).getTime()) / 60000)
        : 0;

    const { t } = useLanguage();
    const INCIDENT_LABELS_LOCAL: Record<string, string> = {
        BREAKDOWN: t('provider.incidents.BREAKDOWN'),
        ACCIDENT: t('provider.incidents.ACCIDENT'),
        FLAT_TIRE: t('provider.incidents.FLAT_TIRE'),
        BATTERY_DEAD: t('provider.incidents.BATTERY_DEAD'),
        OUT_OF_FUEL: t('provider.incidents.OUT_OF_FUEL'),
        LOCKED_OUT: t('provider.incidents.LOCKED_OUT'),
        OTHER: t('provider.incidents.OTHER'),
    };

    const customerName = request.user?.name || request.user?.phone || t('provider.history.customerFallback');

    return (
        <div className="rounded-xl p-3.5 mb-2 last:mb-0" style={{ background: '#fff5f5', border: '1px solid #fee2e2' }}>
            <div className="flex items-start gap-2.5 mb-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#fecaca' }}>
                    <Bell style={{ width: 13, height: 13, color: '#ef4444' }} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                        <p className="text-sm font-semibold truncate" style={{ color: C.navy }}>
                            {INCIDENT_LABELS_LOCAL[request.incidentType] || request.incidentType}
                        </p>
                        <span className="text-xs flex-shrink-0" style={{ color: '#ef4444' }}>
                            {timeAgo < 1 ? t('common.justNow') : `${timeAgo}${t('common.minutesAgo')}`}
                        </span>
                    </div>
                    {/* Customer name */}
                    <p className="text-xs font-medium mt-0.5" style={{ color: C.navy }}>
                        {customerName}
                    </p>
                    <p className="text-xs truncate mt-0.5" style={{ color: C.gray }}>
                        {request.pickupLocation?.address || t('components.incomingRequest.unknownLocation')}
                    </p>
                    {request.estimatedEarnings && (
                        <p className="text-xs font-semibold mt-1" style={{ color: C.orange }}>
                            ~{formatVnd(request.estimatedEarnings)} • {request.distance?.toFixed(1)}km
                        </p>
                    )}
                </div>
            </div>
            <button
                onClick={onView}
                className="w-full py-1.5 rounded-lg text-xs font-bold text-white transition-all active:scale-95"
                style={{ background: C.orange }}
            >
                {t('provider.active.viewDetails')}
            </button>
        </div>
    );
}



// ─── Quick Actions ────────────────────────────────────────────────────────────
function QuickActions({ router, t }: { router: ReturnType<typeof useRouter>; t: (k: string) => string }) {
    const actions = [
        { label: t('provider.quickActions.guide'), bg: '#dbeafe', color: '#2563eb', icon: <BookOpen style={{ width: 18, height: 18 }} />, onClick: () => { } },
        { label: t('provider.quickActions.earnings'), bg: '#dcfce7', color: '#16a34a', icon: <TrendingUp style={{ width: 18, height: 18 }} />, onClick: () => router.push('/provider/wallet') },
        { label: t('provider.quickActions.wallet'), bg: C.orangeLight, color: C.orange, icon: <Wallet style={{ width: 18, height: 18 }} />, onClick: () => router.push('/provider/wallet') },
        { label: t('provider.quickActions.settings'), bg: C.border, color: '#64748b', icon: <Settings style={{ width: 18, height: 18 }} />, onClick: () => router.push('/provider/settings') },
    ];

    return (
        <div className="bg-white rounded-xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: C.navy }}>{t('provider.quickActions.title')}</h3>
            <div className="grid grid-cols-4 gap-2 mb-3">
                {actions.map(a => (
                    <button key={a.label} onClick={a.onClick} className="flex flex-col items-center gap-1.5 group">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform" style={{ background: a.bg, color: a.color }}>
                            {a.icon}
                        </div>
                        <span className="text-[10px] font-medium" style={{ color: C.gray }}>{a.label}</span>
                    </button>
                ))}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg" style={{ background: '#f0fdf4' }}>
                    <CheckCircle2 style={{ width: 13, height: 13, color: '#16a34a' }} />
                    <div>
                        <p style={{ fontSize: 9, color: C.gray }}>{t('provider.quickActions.systemStatus')}</p>
                        <p className="text-xs font-semibold" style={{ color: '#15803d' }}>{t('provider.quickActions.systemOk')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg" style={{ background: '#eff6ff' }}>
                    <Clock style={{ width: 13, height: 13, color: '#2563eb' }} />
                    <div>
                        <p style={{ fontSize: 9, color: C.gray }}>{t('provider.quickActions.syncStatus')}</p>
                        <p className="text-xs font-semibold" style={{ color: '#1d4ed8' }}>{t('provider.quickActions.justUpdated')}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Live Map Panel ───────────────────────────────────────────────────────────
function LiveMapPanel({
    isOnline,
    location,
    nearbyCount,
}: {
    isOnline: boolean;
    location: { lat: number | null; lng: number | null; isTracking: boolean; error: string | null };
    nearbyCount: number;
}) {
    const { t } = useLanguage();
    const hasLocation = location.lat !== null && location.lng !== null;
    const DEFAULT = { lat: 21.028511, lng: 105.804817 };
    const mapCenter: [number, number] = hasLocation
        ? [location.lng!, location.lat!]
        : [DEFAULT.lng, DEFAULT.lat];

    return (
        <div className="relative w-full overflow-hidden rounded-xl" style={{ height: '100%' }}>
            {/* "My location" pill */}
            <div
                className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shadow"
                style={{ background: 'white', color: C.navy, border: `1px solid ${C.border}` }}
            >
                <svg width="10" height="10" viewBox="0 0 24 24" fill={C.orange}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" /></svg>
                {hasLocation ? t('provider.dashboard.myLocation') : t('provider.dashboard.defaultLocation')}
            </div>

            {/* GPS error badge */}
            {location.error && (
                <div
                    className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-1 rounded-full text-xs shadow"
                    style={{ background: C.orangeLight, color: C.orange, border: `1px solid ${C.orange}30` }}
                >
                    <svg width="10" height="10" viewBox="0 0 20 20" fill={C.orange}><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    {t('provider.dashboard.gpsFallback')}
                </div>
            )}

            {/* VietMap */}
            <VietMap
                center={mapCenter}
                zoom={hasLocation ? 15 : 12}
                showMarker={true}
                markerPosition={mapCenter}
            />

            {/* Bottom bar */}
            <div
                className="absolute bottom-2 left-2 right-2 z-10 flex items-center gap-2 px-3 py-2 rounded-xl shadow-lg"
                style={{ background: 'white', border: `1px solid ${C.border}` }}
            >
                <div
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: isOnline ? '#22c55e' : '#6b7280' }}
                >
                    {isOnline
                        ? <Wifi style={{ width: 13, height: 13, color: 'white' }} />
                        : <WifiOff style={{ width: 13, height: 13, color: 'white' }} />}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px]" style={{ color: C.gray }}>{t('common.status')}</p>
                    <p className="text-xs font-semibold truncate" style={{ color: C.navy }}>
                        {isOnline ? t('provider.dashboard.statusReceiving') : t('provider.dashboard.offline')}
                    </p>
                </div>
                {!isOnline && (
                    <span className="text-xs font-bold flex-shrink-0" style={{ color: C.orange }}>{t('provider.dashboard.goLive')}</span>
                )}
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProviderActivePage() {
    const router = useRouter();
    const { user, loading: authLoading, logout } = useAuth();
    const { t } = useLanguage();
    const { isOnline, isLoading: statusLoading, toggleOnlineStatus, setIsOnline } = useProviderStatus();
    const { requests } = usePendingRequests({ enabled: isOnline, pollInterval: 5000 });
    const { location } = useProviderLocation({ enabled: isOnline, updateInterval: 30000 });

    // Wallet balance — required to go online
    const MIN_DEPOSIT = 100_000;
    const [walletBalance, setWalletBalance] = useState<number | null>(null);
    useEffect(() => {
        if (user?.verificationStatus === 'APPROVED') {
            api.get('/wallet/me')
                .then(r => setWalletBalance(r.data.availableBalance ?? 0))
                .catch(() => setWalletBalance(0));
        }
    }, [user?.verificationStatus]);

    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [confirmDeclineReq, setConfirmDeclineReq] = useState<any>(null); // request pending decline confirmation
    // Load declinedIds synchronously in the initializer so it's ready before the
    // first render and before the auto-popup useEffect can run.
    const [declinedIds, setDeclinedIds] = useState<Set<string>>(() => {
        try {
            const stored = sessionStorage.getItem('provider_declined_ids');
            if (stored) return new Set<string>(JSON.parse(stored));
        } catch { }
        return new Set<string>();
    });
    // dismissed modal ids: persisted to sessionStorage so they survive navigation back to this page
    const dismissedModalIds = useRef<Set<string>>((() => {
        try {
            const stored = sessionStorage.getItem('provider_dismissed_modal_ids');
            if (stored) return new Set<string>(JSON.parse(stored));
        } catch { }
        return new Set<string>();
    })());

    // Helper to persist declined ids to session storage
    const addDeclinedId = (id: string) => {
        setDeclinedIds(prev => {
            const next = new Set(prev).add(id);
            sessionStorage.setItem('provider_declined_ids', JSON.stringify(Array.from(next)));
            return next;
        });
    };

    // Helper to add to dismissed set + persist so it survives remount
    const addDismissedModalId = (id: string) => {
        dismissedModalIds.current.add(id);
        try {
            sessionStorage.setItem(
                'provider_dismissed_modal_ids',
                JSON.stringify(Array.from(dismissedModalIds.current))
            );
        } catch { }
    };

    const [activeNav, setActiveNav] = useState(t('provider.nav.dashboard'));
    const [weeklyEarnings, setWeeklyEarnings] = useState<number | null>(null);
    const [weeklyJobCount, setWeeklyJobCount] = useState<number>(0);

    const navItems = [
        {
            label: t('provider.nav.dashboard'), href: '/provider/active',
            icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
        },
        {
            label: t('provider.nav.history'), href: '/provider/history',
            icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        },
        {
            label: t('provider.nav.wallet'), href: '/provider/wallet',
            icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
        },
        {
            label: t('provider.nav.settings'), href: '/provider/settings',
            icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
        },
    ];

    function getGreeting() {
        const h = new Date().getHours();
        if (h < 12) return t('provider.dashboard.greeting.morning');
        if (h < 18) return t('provider.dashboard.greeting.afternoon');
        return t('provider.dashboard.greeting.evening');
    }

    const INCIDENT_LABELS: Record<string, string> = {
        BREAKDOWN: t('provider.incidents.BREAKDOWN'),
        ACCIDENT: t('provider.incidents.ACCIDENT'),
        FLAT_TIRE: t('provider.incidents.FLAT_TIRE'),
        BATTERY_DEAD: t('provider.incidents.BATTERY_DEAD'),
        OUT_OF_FUEL: t('provider.incidents.OUT_OF_FUEL'),
        LOCKED_OUT: t('provider.incidents.LOCKED_OUT'),
        OTHER: t('provider.incidents.OTHER'),
    };

    const filteredRequests = requests.filter(r => !declinedIds.has(r.id));

    useEffect(() => {
        if (user?.isOnline !== undefined) setIsOnline(user.isOnline);
    }, [user, setIsOnline]);

    useEffect(() => {
        api.get('/wallet/me/stats')
            .then(res => {
                setWeeklyEarnings(res.data?.todayEarnings ?? 0);
                setWeeklyJobCount(res.data?.todayJobCount ?? 0);
            })
            .catch(() => { /* ignore – widget just stays with null */ });
    }, []);

    useEffect(() => {
        if (!authLoading && !user) router.push('/auth/login');
    }, [authLoading, user, router]);

    // Auto-popup: show modal for the first request not yet dismissed by the provider.
    // dismissed = provider explicitly pressed "Đóng" (close) — request stays in inbox list.
    useEffect(() => {
        if (selectedRequest) return; // modal already open
        const next = filteredRequests.find(r => !dismissedModalIds.current.has(r.id));
        if (next) setSelectedRequest(next);
    }, [filteredRequests, selectedRequest]);

    // ── Guards ────────────────────────────────────────────────────────────────
    if (authLoading) return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: C.orange }} />
        </div>
    );

    if (!user) return null;

    if (user.role !== 'PROVIDER') return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: C.bg }}>
            <div className="bg-white rounded-xl p-8 max-w-sm text-center" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.08)' }}>
                <p className="mb-4 text-sm" style={{ color: C.gray }}>{t('provider.dashboard.providerOnly')}</p>
                <button onClick={() => router.push('/')} className="px-5 py-2 rounded-xl text-white text-sm font-medium" style={{ background: C.orange }}>{t('common.back')}</button>
            </div>
        </div>
    );

    if (user.verificationStatus === 'PENDING') return <PendingVerificationScreen />;

    if (user.verificationStatus !== 'APPROVED') return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: C.bg }}>
            <div className="bg-white rounded-xl p-8 max-w-sm text-center" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.08)' }}>
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: C.orangeLight }}>
                    <Star style={{ width: 24, height: 24, color: C.orange }} />
                </div>
                <h2 className="text-lg font-bold mb-2" style={{ color: C.navy }}>{t('provider.dashboard.notVerified')}</h2>
                <p className="text-sm mb-5" style={{ color: C.gray }}>{t('provider.dashboard.verificationRequired')}</p>
                <button onClick={() => router.push('/provider/onboarding')} className="w-full py-2.5 rounded-xl text-white text-sm font-semibold" style={{ background: C.orange }}>{t('provider.dashboard.completeVerification')}</button>
            </div>
        </div>
    );

    // Deposit gate: APPROVED but insufficient balance (wait until balance loaded)
    if (walletBalance !== null && walletBalance < MIN_DEPOSIT) {
        return <DepositGateScreen currentBalance={walletBalance} />;
    }

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleToggle = async () => {
        if (statusLoading) return;

        if (!isOnline) {
            if (walletBalance === null) {
                toast.error('Đang kiểm tra số dư ví, vui lòng thử lại sau vài giây.');
                return;
            }
            if (walletBalance < MIN_DEPOSIT) {
                toast.error(`Bạn cần tối thiểu ${formatVnd(MIN_DEPOSIT)} trong ví ký quỹ để bật hoạt động.`);
                return;
            }
        }

        const result = await toggleOnlineStatus(!isOnline);
        if (result.success) toast.success(result.message); else toast.error(result.message);
    };

    const canToggleOnline = isOnline || (walletBalance !== null && walletBalance >= MIN_DEPOSIT);

    const handleViewDetails = (req: any) => {
        // Dismiss the modal for this request before navigating so that
        // pressing Back from the detail page won't re-trigger the auto-popup.
        addDismissedModalId(req.id);
        router.push(`/provider/requests/${req.id}`);
        setSelectedRequest(null);
    };

    // Closing the modal suppresses auto-popup for this request (persisted across navigation).
    const handleCloseModal = () => {
        if (selectedRequest) {
            addDismissedModalId(selectedRequest.id);
        }
        setSelectedRequest(null);
    };

    const handleDecline = async (req: any) => {
        // Show custom confirm dialog instead of window.confirm
        setConfirmDeclineReq(req);
    };

    const confirmDecline = async () => {
        const req = confirmDeclineReq;
        if (!req) return;
        setConfirmDeclineReq(null);
        addDeclinedId(req.id);
        if (selectedRequest?.id === req.id) setSelectedRequest(null);
        try { await api.post(`/rescue-requests/${req.id}/decline`); } catch { }
    };

    const displayName = user.name?.split(' ').slice(-1)[0] || user.email?.split('@')[0] || 'Provider';

    const nav = (label: string, href: string) => {
        setActiveNav(label);
        if (href !== '#') router.push(href);
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="h-screen overflow-hidden flex" style={{ fontFamily: 'Lexend, sans-serif', background: C.bg }}>

            {/* ═══ DESKTOP Sidebar ═══ */}
            <aside
                className="hidden md:flex flex-col justify-between py-6 px-4 flex-shrink-0"
                style={{ width: '220px', background: '#ffffff', borderRight: `1px solid ${C.border}` }}
            >
                <div>
                    {/* Logo */}
                    <div className="flex items-center gap-2 mb-8 px-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.orange }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 7v10l8 5 8-5V7L12 2z" fill="white" opacity="0.9" /></svg>
                        </div>
                        <span className="font-bold text-base" style={{ color: C.navy }}>RescueMe</span>
                    </div>
                    {/* Nav */}
                    <nav className="space-y-1">
                        {navItems.map(item => {
                            const active = activeNav === item.label;
                            return (
                                <button
                                    key={item.label}
                                    onClick={() => nav(item.label, item.href)}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                                    style={{ background: active ? C.orangeLight : 'transparent', color: active ? C.orange : '#64748b' }}
                                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = C.bg; }}
                                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                >
                                    {item.icon}{item.label}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Provider info at bottom + online toggle */}
                <div>
                    {/* Online/Offline toggle */}
                    <div className="flex items-center gap-2 px-2 mb-3 pb-3" style={{ borderBottom: `1px solid ${C.border}` }}>
                        <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <span className="flex-1 text-xs font-medium" style={{ color: C.gray }}>
                            {isOnline ? t('provider.dashboard.online') : t('provider.dashboard.offline')}
                        </span>
                        <button
                            onClick={handleToggle}
                            disabled={statusLoading || !canToggleOnline}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isOnline ? 'bg-green-500' : 'bg-gray-300'} ${statusLoading || !canToggleOnline ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${isOnline ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>
                    </div>
                    <div className="flex items-center gap-3 px-2" style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                        <AvatarImage
                            name={displayName}
                            avatar={user?.avatar}
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                            fallbackBackground={C.orange}
                            initialsCount={1}
                        />
                        <div className="min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: C.navy }}>{displayName}</p>
                            <p className="text-xs" style={{ color: C.gray }}>{t('provider.dashboard.providerRole')}</p>
                        </div>
                    </div>
                    {/* Logout Button */}
                    <div className="px-2 mt-4 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
                        <button
                            onClick={logout}
                            disabled={statusLoading}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold transition-all hover:bg-red-50"
                            style={{ color: '#ef4444' }}
                        >
                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            {t('common.logout')}
                        </button>
                    </div>
                </div>
            </aside>

            {/* ═══ Main Area ═══ */}
            <div className="flex-1 flex flex-col min-w-0" style={{ paddingBottom: '64px' }}>

                {/* ── Top Bar (matches user dashboard exactly) ── */}
                <header
                    className="flex items-center justify-between px-4 py-3 flex-shrink-0 sticky top-0 z-20"
                    style={{ background: '#ffffff', borderBottom: `1px solid ${C.border}` }}
                >
                    {/* Mobile: RescueMe logo | Desktop: "Dashboard" */}
                    <div className="flex items-center gap-2 md:hidden">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: C.orange }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 7v10l8 5 8-5V7L12 2z" fill="white" opacity="0.9" /></svg>
                        </div>
                        <span className="font-bold text-sm" style={{ color: C.navy }}>RescueMe</span>
                    </div>
                    <h2 className="hidden md:block text-base font-semibold" style={{ color: C.navy }}>{t('common.dashboard')}</h2>

                    <div className="flex items-center gap-3">
                        {/* System Operational */}
                        <div className="hidden sm:flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
                            <span className="text-xs font-medium" style={{ color: '#64748b' }}>{t('common.systemOperational')}</span>
                        </div>
                        {/* Language Switcher */}
                        <LanguageSwitcher />

                        {/* Bell */}
                        <button className="p-1.5 rounded-lg" style={{ color: '#94a3b8' }}>
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                        </button>

                        {/* Mobile: status dot only — not a button, to avoid confusion */}
                        <div className="flex md:hidden items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                            <span className="text-xs font-medium" style={{ color: isOnline ? '#16a34a' : C.gray }}>
                                {isOnline ? t('common.online') : t('common.offline')}
                            </span>
                        </div>

                        {/* Avatar */}
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
                <div className="flex-1 flex overflow-hidden">

                    {/* Scrollable left/center */}
                    <div className="flex-1 overflow-y-auto">
                        <div className="p-4 md:p-6 space-y-4">

                            {/* Greeting */}
                            <div>
                                <h1 className="text-xl md:text-2xl font-bold" style={{ color: C.navy }}>{getGreeting()}, {displayName} 👋</h1>
                                <p className="text-xs md:text-sm mt-0.5" style={{ color: C.gray }}>
                                    {isOnline ? t('provider.dashboard.onlineSubtitle') : t('provider.dashboard.offlineSubtitle')}
                                </p>
                            </div>

                            {/* Mobile-only: Online toggle card — clear label + switch, not a button chip */}
                            <div
                                className="flex md:hidden items-center gap-3 px-4 py-3 rounded-xl"
                                style={{ background: isOnline ? '#f0fdf4' : '#f8fafc', border: `1px solid ${isOnline ? '#bbf7d0' : C.border}` }}
                            >
                                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold" style={{ color: C.navy }}>
                                        {isOnline ? t('provider.dashboard.online') : t('provider.dashboard.offline')}
                                    </p>
                                    <p className="text-xs" style={{ color: C.gray }}>
                                        {isOnline ? t('provider.dashboard.receiving') : t('provider.dashboard.enableToReceive')}
                                    </p>
                                </div>
                                {/* Toggle switch — the only control, clearly paired with label */}
                                <button
                                    onClick={handleToggle}
                                    disabled={statusLoading || !canToggleOnline}
                                    aria-label="Toggle online status"
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${isOnline ? 'bg-green-500' : 'bg-gray-300'
                                        } ${statusLoading || !canToggleOnline ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform ${isOnline ? 'translate-x-5' : 'translate-x-0.5'
                                        }`} />
                                </button>
                            </div>

                            {/* Stat cards — always before map so they're never hidden */}
                            <div className="flex gap-3 overflow-x-auto pb-0.5">
                                <StatCard
                                    icon={<Bell style={{ width: 18, height: 18, color: '#2563eb' }} />}
                                    label={t('provider.dashboard.pendingRequests')}
                                    value={filteredRequests.length.toString()}
                                    sub={isOnline ? t('provider.dashboard.statusReceiving') : t('provider.dashboard.offline')}
                                    bg="#dbeafe"
                                />
                                <StatCard
                                    icon={<TrendingUp style={{ width: 18, height: 18, color: '#16a34a' }} />}
                                    label={t('provider.dashboard.todayEarnings')}
                                    value={weeklyEarnings === null ? '—' : formatVnd(weeklyEarnings)}
                                    sub={weeklyEarnings === null ? t('provider.active.todayLabel') : `${weeklyJobCount} ${t('provider.active.tripsLabel')}`}
                                    bg="#dcfce7"
                                />
                                <StatCard
                                    icon={<Star style={{ width: 18, height: 18, color: '#ca8a04' }} />}
                                    label={t('provider.dashboard.avgRating')}
                                    value={
                                        user?.averageRating != null
                                            ? `${user.averageRating.toFixed(1)} ★`
                                            : '— ★'
                                    }
                                    sub={
                                        user?.reviewCount
                                            ? `${user.reviewCount} ${t('provider.active.reviewsLabel')}`
                                            : t('provider.dashboard.excellentFeedback')
                                    }
                                    bg="#fef9c3"
                                />
                            </div>

                            {/* Mobile-only live map — AFTER stat cards */}
                            <div className="lg:hidden" style={{ height: '220px' }}>
                                <LiveMapPanel isOnline={isOnline} location={location} nearbyCount={filteredRequests.length || 12} />
                            </div>

                            {/* Incoming Alerts */}
                            <div className="bg-white rounded-xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-semibold" style={{ color: C.navy }}>{t('provider.dashboard.incomingAlerts')}</h3>
                                    {filteredRequests.length > 0 && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
                                </div>
                                {filteredRequests.length === 0 ? (
                                    <div className="py-6 text-center">
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2" style={{ background: C.border }}>
                                            <Bell style={{ width: 18, height: 18, color: '#94a3b8' }} />
                                        </div>
                                        <p className="text-sm" style={{ color: C.gray }}>
                                            {isOnline ? t('provider.dashboard.noNewRequests') : t('provider.dashboard.enableOnlineToReceive')}
                                        </p>
                                    </div>
                                ) : (
                                    <div>
                                        {filteredRequests.slice(0, 3).map(req => (
                                            <AlertCard
                                                key={req.id}
                                                request={req}
                                                onView={() => handleViewDetails(req)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Quick Actions */}
                            <QuickActions router={router} t={t} />

                            <div className="h-2 md:hidden" />
                        </div>
                    </div>

                    {/* Desktop: Live Map panel on right (matches user layout) */}
                    <div
                        className="hidden lg:block flex-shrink-0 overflow-hidden"
                        style={{ width: '380px', borderLeft: `1px solid ${C.border}` }}
                    >
                        <LiveMapPanel isOnline={isOnline} location={location} nearbyCount={filteredRequests.length || 12} />
                    </div>
                </div>
            </div>

            {/* ═══ Mobile Bottom Nav ═══ */}
            <nav
                className="fixed bottom-0 left-0 right-0 md:hidden z-30 flex items-stretch"
                style={{ background: '#ffffff', borderTop: `1px solid ${C.border}`, height: '60px' }}
            >
                {navItems.map(item => {
                    const active = activeNav === item.label;
                    return (
                        <button
                            key={item.label}
                            onClick={() => nav(item.label, item.href)}
                            className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
                            style={{ color: active ? C.orange : '#94a3b8' }}
                        >
                            <span style={{ color: active ? C.orange : '#94a3b8' }}>{item.icon}</span>
                            <span className="text-[9px] font-medium">{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            {/* Incoming request full-screen modal */}
            {selectedRequest && (
                <IncomingRequestModal
                    request={selectedRequest}
                    onViewDetails={() => handleViewDetails(selectedRequest)}
                    onClose={handleCloseModal}
                    onDecline={() => handleDecline(selectedRequest)}
                    isProcessing={isProcessing}
                />
            )}
            {/* Custom Decline Confirmation Dialog */}
            {confirmDeclineReq && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
                        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#dc2626" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                            </svg>
                        </div>
                        <h3 className="text-base font-bold text-center mb-1" style={{ color: '#1a1a2e' }}>{t('provider.active.declineConfirm.title')}</h3>
                        <p className="text-sm text-center text-gray-500 mb-6">
                            {t('provider.active.declineConfirm.desc')}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setConfirmDeclineReq(null)}
                                className="py-3 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                                {t('provider.active.declineConfirm.cancel')}
                            </button>
                            <button
                                onClick={confirmDecline}
                                className="py-3 rounded-xl text-sm font-bold text-white transition-colors"
                                style={{ background: '#dc2626' }}
                            >
                                {t('provider.active.declineConfirm.confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
