'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserGuard } from '@/lib/guards';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import AvatarImage from '@/components/AvatarImage';
import dynamic from 'next/dynamic';
import api from '@/lib/api';

const VietMap = dynamic(() => import('@/components/VietMap'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex items-center justify-center" style={{ background: '#f1f5f9' }}>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#f97316' }}></div>
        </div>
    )
});

interface LocationData {
    lat: number;
    lng: number;
    address?: string;
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

const ACTIVE_STATUSES = ['CREATED', 'MATCHING', 'SEARCHING', 'MATCHED', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'ARRIVED', 'WORKING', 'PAYMENT_PENDING'];

const STATUS_LABELS: Record<string, string> = {
    CREATED: 'Đã tạo', MATCHING: 'Đang tìm', SEARCHING: 'Đang tìm',
    MATCHED: 'Đã ghép đôi', ASSIGNED: 'Có provider', ACCEPTED: 'Đã chấp nhận',
    IN_PROGRESS: 'Đang di chuyển', ARRIVED: 'Đã đến', WORKING: 'Đang làm việc',
    PAYMENT_PENDING: 'Chờ thanh toán', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy',
    REJECTED: 'Từ chối', EXPIRED: 'Hết hạn',
};

const INCIDENT_LABELS: Record<string, string> = {
    BREAKDOWN: 'Hỏng xe', ACCIDENT: 'Tai nạn', FLAT_TIRE: 'Lốp xe hỏng',
    BATTERY_DEAD: 'Hết bình điện', OUT_OF_FUEL: 'Hết nhiên liệu', LOCKED_OUT: 'Khóa xe', OTHER: 'Khác',
};

function BatteryIcon() {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="7" width="18" height="10" rx="2" /><path d="M22 11v2" strokeLinecap="round" /></svg>;
}
function TireIcon() {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /></svg>;
}

export default function UserDashboard() {
    const router = useRouter();
    const { isReady, user } = useUserGuard();
    const { t } = useLanguage();
    const [activeNav, setActiveNav] = useState('Home');
    const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
    const [isLoadingLocation, setIsLoadingLocation] = useState(true);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [requests, setRequests] = useState<any[]>([]);
    const [isLoadingRequests, setIsLoadingRequests] = useState(true);

    const fetchRequests = async () => {
        try {
            const res = await api.get('/rescue-requests');
            setRequests(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingRequests(false);
        }
    };

    useEffect(() => {
        if (!isReady) return;
        fetchRequests();
    }, [isReady]);

    // Poll more aggressively when there's an active request
    useEffect(() => {
        if (!isReady) return;
        const hasActive = requests.some(r => ACTIVE_STATUSES.includes(r.status));
        const interval = hasActive ? 5000 : 15000;
        const id = setInterval(fetchRequests, interval);
        return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isReady, requests.some(r => ACTIVE_STATUSES.includes(r.status))]);

    const activeRequest = requests.find(r => ACTIVE_STATUSES.includes(r.status));
    const recentRequests = requests.filter(r => !ACTIVE_STATUSES.includes(r.status)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 3);

    const DEFAULT_LOCATION: LocationData = { lat: 21.028511, lng: 105.804817, address: 'Hà Nội, Việt Nam' };

    const navItems = [
        {
            label: t('user.nav.home'), href: '/user',
            icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
        },
        {
            label: t('user.nav.history'), href: '/user/requests',
            icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        },
        {
            label: t('user.nav.wallet'), href: '/user/wallet',
            icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
        },
        {
            label: t('user.nav.settings'), href: '/user/settings',
            icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
        },
    ];

    function getGreeting() {
        const h = new Date().getHours();
        if (h < 12) return t('user.dashboard.greeting.morning');
        if (h < 18) return t('user.dashboard.greeting.afternoon');
        return t('user.dashboard.greeting.evening');
    }

    useEffect(() => {
        if (!('geolocation' in navigator)) {
            setCurrentLocation(DEFAULT_LOCATION);
            setLocationError(t('user.dashboard.browserNoGeo'));
            setIsLoadingLocation(false);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setIsLoadingLocation(false);
            },
            (err) => {
                setCurrentLocation(DEFAULT_LOCATION);
                setLocationError(err.code === 1 ? t('user.dashboard.locationDenied') : t('user.dashboard.locationFailed'));
                setIsLoadingLocation(false);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!isReady) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: C.orange }}></div>
            </div>
        );
    }

    const displayName = user?.name || user?.email?.split('@')[0] || 'Alex';

    const nav = (label: string, href: string) => {
        setActiveNav(label);
        if (href !== '#') router.push(href);
    };

    const MapSection = ({ height }: { height: string }) => (
        <div className="relative w-full overflow-hidden rounded-xl" style={{ height }}>
            {!isLoadingLocation && currentLocation && (
                <div
                    className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shadow"
                    style={{ background: 'white', color: C.navy, border: `1px solid ${C.border}` }}
                >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill={C.orange}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" /></svg>
                    {locationError ? t('user.dashboard.locationDefault') : (currentLocation.address?.split(',')[0] ?? t('user.dashboard.locationDefault'))}
                </div>
            )}
            {locationError && (
                <div
                    className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-1 rounded-full text-xs shadow"
                    style={{ background: C.orangeLight, color: C.orange, border: `1px solid ${C.orange}30` }}
                >
                    <svg width="10" height="10" viewBox="0 0 20 20" fill={C.orange}><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    {t('user.dashboard.locationDefault')}
                </div>
            )}
            {isLoadingLocation ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ background: '#f1f5f9' }}>
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: C.orange }}></div>
                    <p className="text-xs" style={{ color: C.gray }}>{t('user.dashboard.loadingMap')}</p>
                </div>
            ) : currentLocation ? (
                <VietMap
                    center={[currentLocation.lng, currentLocation.lat]}
                    zoom={locationError ? 12 : 15}
                    showMarker={true}
                    markerPosition={[currentLocation.lng, currentLocation.lat]}
                />
            ) : null}
            <div
                className="absolute bottom-2 left-2 right-2 z-10 flex items-center gap-2 px-3 py-2 rounded-xl shadow-lg"
                style={{ background: 'white', border: `1px solid ${C.border}` }}
            >
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.orange }}>
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px]" style={{ color: C.gray }}>{t('user.dashboard.nearestStation')}</p>
                    <p className="text-xs font-semibold truncate" style={{ color: C.navy }}>{t('user.dashboard.nearestStation')}</p>
                </div>
                <span className="text-xs font-bold flex-shrink-0" style={{ color: C.orange }}>4.2 mi</span>
            </div>
        </div>
    );

    return (
        <div className="h-screen overflow-hidden flex" style={{ fontFamily: 'Lexend, sans-serif', background: C.bg }}>

            {/* ═══ DESKTOP Sidebar ═══ */}
            <aside
                className="hidden md:flex flex-col justify-between py-6 px-4 flex-shrink-0"
                style={{ width: '220px', background: '#ffffff', borderRight: `1px solid ${C.border}` }}
            >
                <div>
                    <div className="flex items-center gap-2 mb-8 px-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.orange }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 7v10l8 5 8-5V7L12 2z" fill="white" opacity="0.9" /></svg>
                        </div>
                        <span className="font-bold text-base" style={{ color: C.navy }}>RescueMe</span>
                    </div>
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
                <div className="flex items-center gap-3 px-2 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
                    <AvatarImage
                        name={displayName}
                        avatar={user?.avatar}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                        fallbackBackground={C.orange}
                        initialsCount={1}
                    />
                    <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: C.navy }}>{displayName}</p>
                        <p className="text-xs" style={{ color: C.gray }}>{t('user.dashboard.basicPlan')}</p>
                    </div>
                </div>
            </aside>

            {/* ═══ Main Area ═══ */}
            <div className="flex-1 flex flex-col min-w-0" style={{ paddingBottom: '64px' }}>
                {/* Top Bar */}
                <header
                    className="flex items-center justify-between px-4 py-3 flex-shrink-0 sticky top-0 z-20"
                    style={{ background: '#ffffff', borderBottom: `1px solid ${C.border}` }}
                >
                    <div className="flex items-center gap-2 md:hidden">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: C.orange }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 7v10l8 5 8-5V7L12 2z" fill="white" opacity="0.9" /></svg>
                        </div>
                        <span className="font-bold text-sm" style={{ color: C.navy }}>RescueMe</span>
                    </div>
                    <h2 className="hidden md:block text-base font-semibold" style={{ color: C.navy }}>{t('common.dashboard')}</h2>

                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }}></div>
                            <span className="text-xs font-medium" style={{ color: '#64748b' }}>{t('common.systemOperational')}</span>
                        </div>
                        {/* Language Switcher */}
                        <LanguageSwitcher />
                        <button className="p-1.5 rounded-lg" style={{ color: '#94a3b8' }}>
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                        </button>
                        <AvatarImage
                            name={displayName}
                            avatar={user?.avatar}
                            className="flex md:hidden w-8 h-8 rounded-full items-center justify-center text-white text-xs font-bold"
                            fallbackBackground={C.orange}
                            initialsCount={1}
                        />
                    </div>
                </header>

                {/* Body */}
                <div className="flex-1 flex overflow-hidden">
                    <div className="flex-1 overflow-y-auto">
                        <div className="p-4 md:p-6 space-y-4">
                            {/* Greeting */}
                            <div>
                                <h1 className="text-xl md:text-2xl font-bold" style={{ color: C.navy }}>{getGreeting()}, {displayName} 👋</h1>
                                <p className="text-xs md:text-sm mt-0.5" style={{ color: C.gray }}>{t('user.dashboard.subtitle')}</p>
                            </div>

                            {/* MAP: Mobile only */}
                            <div className="lg:hidden">
                                <MapSection height="220px" />
                            </div>

                            {/* Request Assistance CTA */}
                            <button
                                onClick={() => router.push('/user/create-request')}
                                className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-white transition-all active:scale-[0.98]"
                                style={{
                                    background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)`,
                                    boxShadow: `0 4px 16px ${C.orange}40`,
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
                                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                                    </div>
                                    <div className="text-left">
                                        <p className="font-bold text-sm leading-tight">{t('user.dashboard.requestAssistance')}</p>
                                        <p className="text-xs opacity-80 mt-0.5">{t('user.dashboard.requestSubtitle')}</p>
                                    </div>
                                </div>
                                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                            </button>

                            {/* Rescue in Progress */}
                            <div className="bg-white rounded-xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-2 h-2 rounded-full"
                                            style={{ background: activeRequest ? C.orange : '#94a3b8', animation: activeRequest ? 'pulse 2s infinite' : 'none' }}
                                        ></div>
                                        <h3 className="font-semibold text-sm" style={{ color: C.navy }}>{t('user.dashboard.rescueInProgress')}</h3>
                                    </div>
                                    {activeRequest && (
                                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: C.orangeLight, color: C.orange }}>
                                            {STATUS_LABELS[activeRequest.status] ?? activeRequest.status}
                                        </span>
                                    )}
                                </div>

                                {isLoadingRequests ? (
                                    /* Loading skeleton */
                                    <div className="space-y-3 py-1">
                                        <div className="flex items-center justify-between">
                                            {[0, 1, 2, 3].map(i => (
                                                <div key={i} className="flex flex-col items-center gap-1 flex-1">
                                                    <div className="w-8 h-8 rounded-full animate-pulse" style={{ background: '#f1f5f9' }}></div>
                                                    <div className="w-10 h-2 rounded animate-pulse" style={{ background: '#f1f5f9' }}></div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="h-14 rounded-lg animate-pulse" style={{ background: '#f8fafc' }}></div>
                                    </div>
                                ) : !activeRequest ? (
                                    /* Empty state */
                                    <div className="flex flex-col items-center justify-center py-5 gap-2">
                                        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: C.bg }}>
                                            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth={1.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <p className="text-sm font-medium" style={{ color: C.navy }}>Không có yêu cầu cứu hộ</p>
                                        <p className="text-xs text-center" style={{ color: C.gray }}>Hiện tại không có yêu cầu nào đang thực hiện</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Steps */}
                                        <div className="flex items-start justify-between mb-4">
                                            {[
                                                { label: t('user.dashboard.steps.requested'), done: true, active: false },
                                                { label: t('user.dashboard.steps.assigned'), done: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'ARRIVED', 'WORKING', 'PAYMENT_PENDING'].includes(activeRequest.status), active: ['MATCHING', 'SEARCHING', 'MATCHED'].includes(activeRequest.status) },
                                                { label: t('user.dashboard.steps.enRoute'), done: ['ARRIVED', 'WORKING', 'PAYMENT_PENDING'].includes(activeRequest.status), active: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'].includes(activeRequest.status) },
                                                { label: t('user.dashboard.steps.arrived'), done: ['WORKING', 'PAYMENT_PENDING'].includes(activeRequest.status), active: ['ARRIVED'].includes(activeRequest.status) }
                                            ].map((step, i) => {
                                                const done = step.done;
                                                const stepActive = step.active;
                                                return (
                                                    <div key={i} className="flex flex-col items-center gap-1 flex-1">
                                                        <div
                                                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                                                            style={{
                                                                background: done ? C.orange : stepActive ? '#3b82f6' : '#f1f5f9',
                                                                color: (done || stepActive) ? 'white' : '#94a3b8',
                                                            }}
                                                        >
                                                            {done ? (
                                                                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                                            ) : stepActive ? (
                                                                <div className="w-3 h-3 rounded-full bg-white opacity-80 animate-ping absolute"></div>
                                                            ) : i + 1}
                                                        </div>
                                                        <span className="text-[9px] md:text-[10px] font-medium text-center leading-tight" style={{ color: stepActive ? '#3b82f6' : done ? C.orange : '#94a3b8' }}>
                                                            {step.label}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Provider */}
                                        {activeRequest.assignedProvider ? (
                                            <div className="rounded-lg p-3" style={{ background: C.bg }}>
                                                {/* Top row: avatar + name/stats + call button */}
                                                <div className="flex items-center gap-3">
                                                    <AvatarImage
                                                        name={activeRequest.assignedProvider.name}
                                                        avatar={activeRequest.assignedProvider.avatar}
                                                        className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                                                        fallbackBackground={`linear-gradient(135deg, ${C.gray}, ${C.navy})`}
                                                        initialsCount={2}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold leading-tight" style={{ color: C.navy }}>{activeRequest.assignedProvider.name}</p>
                                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                            {/* Rating */}
                                                            <div className="flex items-center gap-0.5">
                                                                <svg width="10" height="10" viewBox="0 0 20 20" fill="#f59e0b"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                                                <span className="text-xs font-semibold" style={{ color: '#374151' }}>
                                                                    {activeRequest.assignedProvider.averageRating != null
                                                                        ? Number(activeRequest.assignedProvider.averageRating).toFixed(1)
                                                                        : '5.0'}
                                                                </span>
                                                            </div>
                                                            {/* Total trips */}
                                                            {activeRequest.assignedProvider.reviewCount != null && activeRequest.assignedProvider.reviewCount > 0 && (
                                                                <>
                                                                    <span style={{ color: '#cbd5e1', fontSize: '10px' }}>•</span>
                                                                    <div className="flex items-center gap-0.5">
                                                                        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#22c55e" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                                        <span className="text-xs" style={{ color: C.gray }}>{activeRequest.assignedProvider.reviewCount} chuyến</span>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {activeRequest.assignedProvider.phoneNumber && (
                                                        <a
                                                            href={`tel:${activeRequest.assignedProvider.phoneNumber}`}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 flex-shrink-0"
                                                            style={{ background: '#dcfce7', color: '#16a34a' }}
                                                        >
                                                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                                        </a>
                                                    )}
                                                </div>

                                                {/* Vehicle info row */}
                                                {(activeRequest.assignedProvider.licensePlate || activeRequest.assignedProvider.vehicleType) && (
                                                    <div className="flex items-center gap-2 mt-2.5 pt-2.5" style={{ borderTop: `1px solid ${C.border}` }}>
                                                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke={C.gray} strokeWidth={2}><rect x="1" y="3" width="15" height="13" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M16 8h4l3 3v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>
                                                        <span className="text-xs" style={{ color: C.gray }}>
                                                            {[activeRequest.assignedProvider.vehicleColor, activeRequest.assignedProvider.vehicleType].filter(Boolean).join(' ')}
                                                        </span>
                                                        {activeRequest.assignedProvider.licensePlate && (
                                                            <span
                                                                className="ml-auto text-xs font-bold px-2 py-0.5 rounded"
                                                                style={{ background: '#1e293b', color: '#fff', letterSpacing: '0.08em', fontFamily: 'monospace' }}
                                                            >
                                                                {activeRequest.assignedProvider.licensePlate}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* ETA row — only show once a quote is accepted */}
                                                {activeRequest.matchedEta != null && !['ARRIVED', 'WORKING', 'PAYMENT_PENDING'].includes(activeRequest.status) && (
                                                    <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
                                                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2}><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" /></svg>
                                                        <span className="text-xs" style={{ color: C.gray }}>Dự kiến đến nơi</span>
                                                        <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: C.orangeLight, color: C.orange }}>
                                                            {activeRequest.matchedEta} phút
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: C.bg }}>
                                                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 animate-pulse" style={{ background: C.gray }}>
                                                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold" style={{ color: C.navy }}>Đang tìm cứu hộ viên...</p>
                                                    <p className="text-xs truncate" style={{ color: C.gray }}>Hệ thống đang ghép nối với các xe gần bạn</p>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between mt-3">
                                            {['CREATED', 'MATCHING', 'SEARCHING'].includes(activeRequest.status) ? (
                                                <button onClick={() => router.push(`/user/requests/${activeRequest.id}`)} className="text-xs font-medium" style={{ color: '#ef4444' }}>{t('user.dashboard.cancelRequest')}</button>
                                            ) : (
                                                <span />
                                            )}
                                            <button onClick={() => router.push(`/user/requests/${activeRequest.id}`)} className="text-xs font-semibold" style={{ color: C.orange }}>{t('common.viewDetails')}</button>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Recent Activity */}
                            <div className="bg-white rounded-xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-semibold text-sm" style={{ color: C.navy }}>{t('user.dashboard.recentActivity')}</h3>
                                    <button onClick={() => router.push('/user/requests')} className="text-xs font-medium" style={{ color: C.orange }}>{t('common.viewAll')}</button>
                                </div>
                                {recentRequests.length === 0 ? (
                                    <div className="text-center py-6">
                                        <p className="text-sm" style={{ color: C.gray }}>Chưa có hoạt động nào gần đây</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {recentRequests.map((req: any, idx: number) => (
                                            <button
                                                key={req.id}
                                                onClick={() => router.push(`/user/requests/${req.id}`)}
                                                className="w-full text-left flex items-center gap-3 py-2 transition-all hover:bg-slate-50 rounded-lg px-2 -mx-2"
                                                style={{ borderBottom: idx < recentRequests.length - 1 ? `1px solid ${C.border}` : 'none' }}
                                            >
                                                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.orangeLight, color: C.orange }}>
                                                    {req.incidentType === 'BATTERY_DEAD' ? <BatteryIcon /> : <TireIcon />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate" style={{ color: C.navy }}>
                                                        {INCIDENT_LABELS[req.incidentType] || req.incidentType}
                                                    </p>
                                                    <p className="text-xs truncate" style={{ color: C.gray }}>
                                                        {(req.pickupLocation?.addressText?.split(',') || [''])[0]} • {STATUS_LABELS[req.status] || req.status}
                                                    </p>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <p className="text-sm font-semibold" style={{ color: C.navy }}>
                                                        {req.payment?.totalAmount ? `${req.payment.totalAmount.toLocaleString('vi-VN')} đ` : '-'}
                                                    </p>
                                                    <p className="text-xs" style={{ color: C.gray }}>
                                                        {new Date(req.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                                                    </p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="h-2 md:hidden" />
                        </div>
                    </div>

                    {/* DESKTOP Map Panel */}
                    <div
                        className="hidden lg:block flex-shrink-0 overflow-hidden"
                        style={{ width: '380px', borderLeft: `1px solid ${C.border}` }}
                    >
                        <MapSection height="100%" />
                    </div>
                </div>
            </div>

            {/* ═══ MOBILE Bottom Navigation ═══ */}
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
        </div>
    );
}
