'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserGuard } from '@/lib/guards';
import dynamic from 'next/dynamic';

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

const recentActivity = [
    { id: 1, type: 'battery', title: 'Battery Jump Start', location: 'Main St. & 6th Ave', status: 'Completed', price: '$45.00', date: 'Oct 21' },
    { id: 2, type: 'tire', title: 'Flat Tire Change', location: 'Highway 101, Exit 42', status: 'Completed', price: '$65.00', date: 'Sep 12' },
];

const navItems = [
    {
        label: 'Home', href: '/user',
        icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
    },
    {
        label: 'History', href: '/user/requests',
        icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
        label: 'Profile', href: '/user/profile',
        icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    },
    {
        label: 'Settings', href: '#',
        icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    },
];

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
}

function BatteryIcon() {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="7" width="18" height="10" rx="2" /><path d="M22 11v2" strokeLinecap="round" /></svg>;
}
function TireIcon() {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /></svg>;
}

export default function UserDashboard() {
    const router = useRouter();
    const { isReady, user } = useUserGuard();
    const [activeNav, setActiveNav] = useState('Home');
    const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
    const [isLoadingLocation, setIsLoadingLocation] = useState(true);
    const [locationError, setLocationError] = useState<string | null>(null);

    const DEFAULT_LOCATION: LocationData = { lat: 21.028511, lng: 105.804817, address: 'Hà Nội, Việt Nam' };

    useEffect(() => {
        if (!('geolocation' in navigator)) {
            setCurrentLocation(DEFAULT_LOCATION);
            setLocationError('Browser không hỗ trợ định vị.');
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
                setLocationError(err.code === 1 ? 'Quyền vị trí bị từ chối.' : 'Không lấy được vị trí.');
                setIsLoadingLocation(false);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
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

    /* ── MapSection: shared between mobile inline + desktop side panel ── */
    const MapSection = ({ height }: { height: string }) => (
        <div className="relative w-full overflow-hidden rounded-xl" style={{ height }}>
            {/* current location pill */}
            {!isLoadingLocation && currentLocation && (
                <div
                    className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shadow"
                    style={{ background: 'white', color: C.navy, border: `1px solid ${C.border}` }}
                >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill={C.orange}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" /></svg>
                    {locationError ? 'Default location' : (currentLocation.address?.split(',')[0] ?? 'My location')}
                </div>
            )}
            {/* default location warning */}
            {locationError && (
                <div
                    className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-1 rounded-full text-xs shadow"
                    style={{ background: C.orangeLight, color: C.orange, border: `1px solid ${C.orange}30` }}
                >
                    <svg width="10" height="10" viewBox="0 0 20 20" fill={C.orange}><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    Mặc định
                </div>
            )}

            {isLoadingLocation ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ background: '#f1f5f9' }}>
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: C.orange }}></div>
                    <p className="text-xs" style={{ color: C.gray }}>Đang tải bản đồ...</p>
                </div>
            ) : currentLocation ? (
                <VietMap
                    center={[currentLocation.lng, currentLocation.lat]}
                    zoom={locationError ? 12 : 15}
                    showMarker={true}
                    markerPosition={[currentLocation.lng, currentLocation.lat]}
                />
            ) : null}

            {/* Bottom destination bar */}
            <div
                className="absolute bottom-2 left-2 right-2 z-10 flex items-center gap-2 px-3 py-2 rounded-xl shadow-lg"
                style={{ background: 'white', border: `1px solid ${C.border}` }}
            >
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.orange }}>
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px]" style={{ color: C.gray }}>Trạm cứu hộ gần nhất</p>
                    <p className="text-xs font-semibold truncate" style={{ color: C.navy }}>Nearest Service Center</p>
                </div>
                <span className="text-xs font-bold flex-shrink-0" style={{ color: C.orange }}>4.2 mi</span>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen flex" style={{ fontFamily: 'Poppins, sans-serif', background: C.bg }}>

            {/* ═══ DESKTOP Sidebar (md+) ═══ */}
            <aside
                className="hidden md:flex flex-col justify-between py-6 px-4 flex-shrink-0"
                style={{ width: '220px', background: '#ffffff', borderRight: `1px solid ${C.border}` }}
            >
                {/* Logo */}
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
                {/* User */}
                <div className="flex items-center gap-3 px-2 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: C.orange }}>
                        {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: C.navy }}>{displayName}</p>
                        <p className="text-xs" style={{ color: C.gray }}>Basic Plan</p>
                    </div>
                </div>
            </aside>

            {/* ═══ Main Area ═══ */}
            <div className="flex-1 flex flex-col min-w-0" style={{ paddingBottom: '64px' }}>
                {/* paddingBottom = mobile bottom nav height */}

                {/* Top Bar */}
                <header
                    className="flex items-center justify-between px-4 py-3 flex-shrink-0 sticky top-0 z-20"
                    style={{ background: '#ffffff', borderBottom: `1px solid ${C.border}` }}
                >
                    {/* Mobile: show logo. Desktop: show Dashboard title */}
                    <div className="flex items-center gap-2 md:hidden">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: C.orange }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 7v10l8 5 8-5V7L12 2z" fill="white" opacity="0.9" /></svg>
                        </div>
                        <span className="font-bold text-sm" style={{ color: C.navy }}>RescueMe</span>
                    </div>
                    <h2 className="hidden md:block text-base font-semibold" style={{ color: C.navy }}>Dashboard</h2>

                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }}></div>
                            <span className="text-xs font-medium" style={{ color: '#64748b' }}>System Operational</span>
                        </div>
                        <button className="p-1.5 rounded-lg" style={{ color: '#94a3b8' }}>
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                        </button>
                        {/* Mobile avatar */}
                        <div className="flex md:hidden w-8 h-8 rounded-full items-center justify-center text-white text-xs font-bold" style={{ background: C.orange }}>
                            {displayName.charAt(0).toUpperCase()}
                        </div>
                    </div>
                </header>

                {/* Body: split on desktop, stacked on mobile */}
                <div className="flex-1 flex overflow-hidden">

                    {/* ── Scrollable left/center content ── */}
                    <div className="flex-1 overflow-y-auto">
                        <div className="p-4 md:p-6 space-y-4">

                            {/* Greeting */}
                            <div>
                                <h1 className="text-xl md:text-2xl font-bold" style={{ color: C.navy }}>{getGreeting()}, {displayName} 👋</h1>
                                <p className="text-xs md:text-sm mt-0.5" style={{ color: C.gray }}>Stay safe on the road. We are here to help.</p>
                            </div>

                            {/* ── MAP: Mobile only (inline, takes full priority) ── */}
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
                                        <p className="font-bold text-sm leading-tight">Request Assistance</p>
                                        <p className="text-xs opacity-80 mt-0.5">Towing, Jump start, Tire change</p>
                                    </div>
                                </div>
                                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                            </button>

                            {/* Rescue in Progress */}
                            <div className="bg-white rounded-xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: C.orange }}></div>
                                        <h3 className="font-semibold text-sm" style={{ color: C.navy }}>Rescue in Progress</h3>
                                    </div>
                                    <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: C.orangeLight, color: C.orange }}>ETA: 12 Mins</span>
                                </div>

                                {/* Steps */}
                                <div className="flex items-start justify-between mb-4">
                                    {['Requested', 'Assigned', 'En Route', 'Arrived'].map((step, i) => {
                                        const done = i <= 1;
                                        const active = i === 2;
                                        return (
                                            <div key={step} className="flex flex-col items-center gap-1 flex-1">
                                                <div
                                                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                                                    style={{
                                                        background: done ? C.orange : active ? '#3b82f6' : '#f1f5f9',
                                                        color: (done || active) ? 'white' : '#94a3b8',
                                                    }}
                                                >
                                                    {done ? (
                                                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                                    ) : i + 1}
                                                </div>
                                                <span className="text-[9px] md:text-[10px] font-medium text-center leading-tight" style={{ color: active ? '#3b82f6' : done ? C.orange : '#94a3b8' }}>
                                                    {step}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Provider */}
                                <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: C.bg }}>
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ background: 'linear-gradient(135deg, #64748b, #475569)' }}>MT</div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold" style={{ color: C.navy }}>Michael Thompson</p>
                                        <p className="text-xs truncate" style={{ color: C.gray }}>Ford F-150 • License: 4X2-992</p>
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <svg width="10" height="10" viewBox="0 0 20 20" fill="#f59e0b"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                            <span className="text-xs font-medium" style={{ color: '#374151' }}>4.9</span>
                                            <span className="text-xs" style={{ color: C.gray }}>(124 rescues)</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#dcfce7', color: '#16a34a' }}>
                                            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                        </button>
                                        <button className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#dbeafe', color: '#2563eb' }}>
                                            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mt-3">
                                    <button className="text-xs font-medium" style={{ color: '#ef4444' }}>Cancel Request</button>
                                    <button className="text-xs font-semibold" style={{ color: C.orange }}>View Details →</button>
                                </div>
                            </div>

                            {/* Recent Activity */}
                            <div className="bg-white rounded-xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-semibold text-sm" style={{ color: C.navy }}>Recent Activity</h3>
                                    <button onClick={() => router.push('/user/requests')} className="text-xs font-medium" style={{ color: C.orange }}>View all</button>
                                </div>
                                <div className="space-y-2">
                                    {recentActivity.map((item, idx) => (
                                        <div
                                            key={item.id}
                                            className="flex items-center gap-3 py-2"
                                            style={{ borderBottom: idx < recentActivity.length - 1 ? `1px solid ${C.border}` : 'none' }}
                                        >
                                            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.orangeLight, color: C.orange }}>
                                                {item.type === 'battery' ? <BatteryIcon /> : <TireIcon />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium" style={{ color: C.navy }}>{item.title}</p>
                                                <p className="text-xs truncate" style={{ color: C.gray }}>{item.location} • {item.status}</p>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="text-sm font-semibold" style={{ color: C.navy }}>{item.price}</p>
                                                <p className="text-xs" style={{ color: C.gray }}>{item.date}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Extra bottom space so bottom nav doesn't cover content */}
                            <div className="h-2 md:hidden" />
                        </div>
                    </div>

                    {/* ── DESKTOP Map Panel (lg+) ── */}
                    <div
                        className="hidden lg:block flex-shrink-0 overflow-hidden"
                        style={{ width: '380px', borderLeft: `1px solid ${C.border}` }}
                    >
                        <MapSection height="100%" />
                    </div>
                </div>
            </div>

            {/* ═══ MOBILE Bottom Navigation (md and below) ═══ */}
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
