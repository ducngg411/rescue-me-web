'use client';

import { useEffect, useRef, useState, useCallback, lazy, Suspense } from 'react';
import ReactConfetti from 'react-confetti';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useChat } from '@/lib/hooks/useChat';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import WorkingView from './WorkingView';

const ChatModal = lazy(() => import('@/components/ChatModal'));

const VIETMAP_API_KEY = process.env.NEXT_PUBLIC_VIETMAP_API_KEY;

const C = {
    orange: '#f97316',
    orangeDark: '#ea6c0a',
    orangeLight: '#fff7ed',
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#f1f5f9',
    bg: '#f8fafc',
    green: '#16a34a',
};

// ── Polyline decoder (Google Polyline 5 format) ──────────────────────────────
function decodePolyline(encoded: string): [number, number][] {
    const coords: [number, number][] = [];
    let index = 0, lat = 0, lng = 0;
    while (index < encoded.length) {
        let b, shift = 0, result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        lat += (result & 1) ? ~(result >> 1) : (result >> 1);
        shift = 0; result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        lng += (result & 1) ? ~(result >> 1) : (result >> 1);
        // Route API returns [lat, lng] encoded → convert to [lng, lat] for VietMap
        coords.push([lng / 1e5, lat / 1e5]);
    }
    return coords;
}

// ── Global VietMap script loader (reuse from VietMap.tsx pattern) ─────────────
let isVietMapScriptLoaded = false;
let vietmapLoadPromise: Promise<void> | null = null;

const loadVietMapScript = (): Promise<void> => {
    if (isVietMapScriptLoaded && (window as any).vietmapgl) return Promise.resolve();
    if (vietmapLoadPromise) return vietmapLoadPromise;
    vietmapLoadPromise = new Promise((resolve, reject) => {
        if ((window as any).vietmapgl) { isVietMapScriptLoaded = true; resolve(); return; }
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/@vietmap/vietmap-gl-js@6.0.0/dist/vietmap-gl.css';
        document.head.appendChild(link);
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@vietmap/vietmap-gl-js@6.0.0/dist/vietmap-gl.js';
        script.async = true;
        script.onload = () => { isVietMapScriptLoaded = true; resolve(); };
        script.onerror = () => { vietmapLoadPromise = null; reject(new Error('Failed to load VietMap')); };
        document.head.appendChild(script);
    });
    return vietmapLoadPromise;
};

interface PickupLocation {
    lat: number;
    lng: number;
    addressText: string;
}

interface UserInfo {
    name?: string | null;
    phoneNumber?: string | null;
}

interface ProviderNavigationViewProps {
    pickupLocation: PickupLocation;
    user: UserInfo;
    eta?: number | null;
    requestId: string;
    /** Name of the customer (for ChatModal header) */
    customerName?: string;
    /** Full request details for WorkingView */
    requestDetails?: {
        incidentType?: string;
        vehicleType?: string;
        description?: string;
        pickupLocation?: { addressText?: string };
        contactPhone?: string;
    };
    /** Accepted quote price to pre-fill PaymentSheet */
    acceptedQuotePrice?: number | null;
    /** Called when provider presses back (stays in trip flow) */
    onBack?: () => void;
    /** Called after payment submitted (replaced onCompleted) */
    onCompleted?: () => void;
}

export default function ProviderNavigationView({
    pickupLocation,
    user,
    eta,
    requestId,
    customerName,
    requestDetails,
    acceptedQuotePrice,
    onBack,
    onCompleted,
}: ProviderNavigationViewProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<any>(null);
    const [isMapReady, setIsMapReady] = useState(false);
    const [providerLocation, setProviderLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
    const [isLoadingRoute, setIsLoadingRoute] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [arrivalState, setArrivalState] = useState<'idle' | 'waiting' | 'confirmed' | 'denied' | 'working'>('idle');
    const [isMarkingArrived, setIsMarkingArrived] = useState(false);
    const [workingCountdown, setWorkingCountdown] = useState(5);
    const [isPaymentPending, setIsPaymentPending] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QR'>('CASH');
    const [isConfirmingReceived, setIsConfirmingReceived] = useState(false);
    const [showJobDone, setShowJobDone] = useState(false);
    const [jobEarnings, setJobEarnings] = useState<{ totalAmount: number; commissionRate: number } | null>(null);
    const routeDrawn = useRef(false);
    const pollRef = useRef<NodeJS.Timeout | null>(null);
    const countdownRef = useRef<NodeJS.Timeout | null>(null);

    // Get provider identity directly from auth — avoids relying on props being undefined
    const { user: authUser } = useAuth();
    const { t } = useLanguage();
    const providerId = authUser?.id ?? '';
    const providerName = authUser?.name ?? 'Provider';

    // Chat hook for provider during navigation
    const chatEnabled = !!(providerId && requestId);
    const { unreadCount: chatUnreadCount } = useChat({
        requestId: requestId ?? '__none__',
        currentUserId: providerId,
        currentUserRole: 'PROVIDER',
        currentUserName: providerName,
        enabled: chatEnabled,
    });

    // Mark arrived — calls PATCH mark-arrived, then polls for customer response
    const handleMarkArrived = async () => {
        setIsMarkingArrived(true);
        try {
            await api.patch(`/rescue-requests/${requestId}/mark-arrived`);
            setArrivalState('waiting');
            setShowConfirm(false);
            // Poll every 3s for customer response
            pollRef.current = setInterval(async () => {
                try {
                    const res = await api.get(`/rescue-requests/${requestId}/provider-view`);
                    const status = res.data?.status;
                    if (status === 'WORKING') {
                        clearInterval(pollRef.current!);
                        setArrivalState('confirmed');
                        toast.success(t('provider.navigation.toastArrivalConfirmed'));
                    } else if (status === 'IN_PROGRESS') {
                        // Customer denied — went back to IN_PROGRESS
                        clearInterval(pollRef.current!);
                        setArrivalState('denied');
                        toast.error(t('provider.navigation.toastArrivalDenied'));
                    }
                } catch { /* ignore poll errors */ }
            }, 3000);
        } catch (err: any) {
            const msg = err.response?.data?.message || t('provider.navigation.confirmModal.confirming');
            toast.error(msg);
        } finally {
            setIsMarkingArrived(false);
        }
    };

    // Cleanup poll on unmount
    useEffect(() => () => {
        if (pollRef.current) clearInterval(pollRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
    }, []);

    // 5-second auto-countdown when customer confirms arrival
    useEffect(() => {
        if (arrivalState !== 'confirmed') return;
        setWorkingCountdown(5);
        countdownRef.current = setInterval(() => {
            setWorkingCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(countdownRef.current!);
                    setArrivalState('working');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
    }, [arrivalState]);

    // ── 1. Get provider's current GPS ───────────────────────────────────────
    useEffect(() => {
        if (!('geolocation' in navigator)) {
            setLocationError('Trình duyệt không hỗ trợ định vị');
            setProviderLocation({ lat: 21.028511, lng: 105.804817 }); // HN default
            return;
        }
        navigator.geolocation.getCurrentPosition(
            pos => setProviderLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            err => {
                setLocationError('Không lấy được vị trí GPS');
                setProviderLocation({ lat: 21.028511, lng: 105.804817 });
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }, []);

    // ── 2. Load VietMap and initialize ──────────────────────────────────────
    useEffect(() => {
        let isMounted = true;
        loadVietMapScript().then(() => {
            if (isMounted) setIsMapReady(true);
        });
        return () => { isMounted = false; };
    }, []);

    // ── 3. Draw route when both map + location are ready ────────────────────
    const drawRoute = useCallback(async (pLat: number, pLng: number) => {
        if (!map.current || routeDrawn.current) return;
        routeDrawn.current = true;
        setIsLoadingRoute(true);

        try {
            // Call Route API v1.1
            const url = `https://maps.vietmap.vn/api/route?api-version=1.1&apikey=${VIETMAP_API_KEY}` +
                `&point=${pLat},${pLng}&point=${pickupLocation.lat},${pickupLocation.lng}&vehicle=motorcycle`;

            const res = await fetch(url);
            const data = await res.json();

            if (data.code !== 'OK' || !data.paths?.length) throw new Error('Route not found');

            const path = data.paths[0];
            const coords = decodePolyline(path.points);
            const distKm = (path.distance / 1000).toFixed(1);
            const durationMin = Math.ceil(path.time / 60000);
            setRouteInfo({ distance: parseFloat(distKm), duration: durationMin });

            // Wait for map to be loaded
            const addRouteToMap = () => {
                try {
                    // Remove existing route layer/source if any
                    if (map.current.getLayer('route-line')) map.current.removeLayer('route-line');
                    if (map.current.getSource('route')) map.current.removeSource('route');

                    map.current.addSource('route', {
                        type: 'geojson',
                        data: {
                            type: 'Feature',
                            geometry: { type: 'LineString', coordinates: coords },
                        },
                    });
                    // Shadow/casing layer
                    map.current.addLayer({
                        id: 'route-casing',
                        type: 'line',
                        source: 'route',
                        layout: { 'line-join': 'round', 'line-cap': 'round' },
                        paint: { 'line-color': '#fff', 'line-width': 9, 'line-opacity': 0.8 },
                    });
                    // Main orange route line
                    map.current.addLayer({
                        id: 'route-line',
                        type: 'line',
                        source: 'route',
                        layout: { 'line-join': 'round', 'line-cap': 'round' },
                        paint: { 'line-color': C.orange, 'line-width': 5, 'line-opacity': 0.95 },
                    });

                    // FitBounds — leave bottom space for the bottom sheet (140px)
                    const lngs = coords.map(c => c[0]);
                    const lats = coords.map(c => c[1]);
                    map.current.fitBounds(
                        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
                        { padding: { top: 90, bottom: 180, left: 40, right: 40 }, duration: 1200 }
                    );
                } catch (e) {
                    console.warn('Error drawing route:', e);
                }
            };

            if (map.current.isStyleLoaded()) {
                addRouteToMap();
            } else {
                map.current.once('load', addRouteToMap);
            }
        } catch (err) {
            console.error('Route fetch error:', err);
            // Fallback: just show both markers without route line
        } finally {
            setIsLoadingRoute(false);
        }
    }, [pickupLocation]);

    // ── 4. Initialize map once VietMap ready + provider location ready ───────
    useEffect(() => {
        if (!isMapReady || !providerLocation || !mapContainer.current) return;
        if (map.current) return; // already initialized

        const vgl = (window as any).vietmapgl;

        // Center between provider and pickup
        const centerLng = (providerLocation.lng + pickupLocation.lng) / 2;
        const centerLat = (providerLocation.lat + pickupLocation.lat) / 2;

        map.current = new vgl.Map({
            container: mapContainer.current,
            style: `https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=${VIETMAP_API_KEY}`,
            center: [centerLng, centerLat],
            zoom: 13,
        });

        map.current.addControl(new vgl.NavigationControl(), 'top-right');

        // ── Provider marker (orange dot with ring) ──
        const providerEl = document.createElement('div');
        providerEl.style.cssText = `
            width:20px;height:20px;border-radius:50%;
            background:${C.orange};border:3px solid white;
            box-shadow:0 2px 8px rgba(249,115,22,0.6);
            position:relative;
        `;
        new vgl.Marker(providerEl)
            .setLngLat([providerLocation.lng, providerLocation.lat])
            .setPopup(new vgl.Popup({ offset: 25 }).setText(t('provider.navigation.providerMarker')))
            .addTo(map.current);

        // ── User/pickup marker (red pin) ──
        const userEl = document.createElement('div');
        userEl.innerHTML = `
            <div style="position:relative;width:28px;height:36px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 24 30">
                    <path d="M12 0C7.6 0 4 3.6 4 8c0 6 8 16 8 16s8-10 8-16c0-4.4-3.6-8-8-8z" fill="#ef4444"/>
                    <circle cx="12" cy="8" r="3.5" fill="white"/>
                </svg>
            </div>
        `;
        new vgl.Marker(userEl)
            .setLngLat([pickupLocation.lng, pickupLocation.lat])
            .setPopup(new vgl.Popup({ offset: 36 }).setText(user?.name ? t('provider.navigation.customerMarkerNamed').replace('{name}', user.name) : t('provider.navigation.customerMarker')))
            .addTo(map.current);

        // Draw route
        map.current.on('load', () => {
            drawRoute(providerLocation.lat, providerLocation.lng);
        });

        return () => {
            routeDrawn.current = false;
            try {
                if (map.current) { map.current.remove(); map.current = null; }
            } catch (e) { /* ignore */ }
        };
    }, [isMapReady, providerLocation, pickupLocation, drawRoute]);

    const displayName = user?.name || t('provider.navigation.customerMarker');
    const displayPhone = user?.phoneNumber;
    const displayDistance = routeInfo ? `${routeInfo.distance} km` : '~';
    const displayEta = routeInfo ? `${routeInfo.duration} ${t('provider.requestDetail.minutesLabel')}` : (eta ? `${eta} ${t('provider.requestDetail.minutesLabel')}` : '~');

    return (
        <>
            <div className="flex flex-col" style={{ height: '100vh', fontFamily: 'Poppins, sans-serif' }}>
                {/* ── Top overlay panel ── */}
                <div
                    className="absolute top-0 left-0 right-0 z-10 px-4 pt-3 pb-4"
                    style={{ background: 'white', borderBottom: `1px solid ${C.border}`, boxShadow: '0 2px 16px rgba(0,0,0,0.10)' }}
                >
                    {/* Title row — with back button */}
                    <div className="flex items-center gap-2 mb-3">
                        {/* Back button stays in trip flow */}
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-70"
                                style={{ background: C.bg }}
                            >
                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={C.navy} strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                        )}
                        <div className="flex items-center gap-2 flex-1">
                            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#22c55e' }} />
                            <span className="text-sm font-bold" style={{ color: C.navy }}>{t('provider.navigation.headerTitle')}</span>
                        </div>
                        {locationError && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: '#fefce8', color: '#ca8a04' }}>
                                {t('provider.navigation.gpsDefault')}
                            </span>
                        )}
                    </div>

                    {/* Customer info */}
                    <div className="flex items-center gap-3 mb-3">
                        <div
                            className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                            style={{ background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})` }}
                        >
                            {displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold" style={{ color: C.navy }}>{displayName}</p>
                            <p className="text-xs truncate" style={{ color: C.gray }}>
                                📍 {pickupLocation.addressText}
                            </p>
                        </div>
                    </div>

                    {/* Stats + Actions row */}
                    <div className="flex items-center gap-3">
                        {/* Distance chip */}
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl flex-shrink-0" style={{ background: C.bg }}>
                            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            {isLoadingRoute ? (
                                <div className="w-12 h-3.5 rounded animate-pulse" style={{ background: C.border }} />
                            ) : (
                                <span className="text-xs font-bold" style={{ color: C.navy }}>{displayDistance}</span>
                            )}
                        </div>
                        {/* ETA chip */}
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl flex-shrink-0" style={{ background: C.bg }}>
                            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {isLoadingRoute ? (
                                <div className="w-12 h-3.5 rounded animate-pulse" style={{ background: C.border }} />
                            ) : (
                                <span className="text-xs font-bold" style={{ color: C.navy }}>{displayEta}</span>
                            )}
                        </div>

                        <div className="flex-1" />

                        {/* Floating Chat Button */}
                        {chatEnabled && (
                            <button
                                onClick={() => setIsChatOpen(true)}
                                className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold flex-shrink-0"
                                style={{ background: '#eff6ff', color: '#2563eb' }}
                            >
                                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#2563eb" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                {t('provider.navigation.chatBtn')}
                                {chatUnreadCount > 0 && (
                                    <span
                                        className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-0.5 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                                        style={{ background: '#ef4444' }}
                                    >
                                        {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
                                    </span>
                                )}
                            </button>
                        )}

                        {/* Call button */}
                        {displayPhone && (
                            <a
                                href={`tel:${displayPhone}`}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white flex-shrink-0"
                                style={{ background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`, boxShadow: `0 2px 8px ${C.orange}40` }}
                            >
                                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                {t('provider.navigation.callBtn')}
                            </a>
                        )}
                    </div>
                </div>

                {/* ── VietMap Fullscreen ── */}
                <div className="relative flex-1">
                    <div ref={mapContainer} style={{ width: '100%', height: '100vh' }} />

                    {/* Loading overlay */}
                    {!isMapReady && (
                        <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#f1f5f9' }}>
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto mb-3" style={{ borderColor: C.orange }} />
                                <p className="text-sm" style={{ color: C.gray }}>{t('provider.navigation.loadingMap')}</p>
                            </div>
                        </div>
                    )}
                </div>


                {/* ── Bottom Sheet: multi-state ── */}
                <div
                    className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-6 pt-4"
                    style={{
                        background: 'white',
                        borderTop: `1px solid ${C.border}`,
                        boxShadow: '0 -4px 20px rgba(0,0,0,0.10)',
                        borderRadius: '20px 20px 0 0',
                    }}
                >
                    {/* Drag handle */}
                    <div className="w-10 h-1 rounded-full mx-auto mb-3" style={{ background: C.border }} />

                    {/* === IDLE: normal navigation, show stats + arrive button === */}
                    {arrivalState === 'idle' && (
                        <>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="flex-1 rounded-xl p-2.5 text-center" style={{ background: C.bg }}>
                                    <p className="text-[10px] mb-0.5" style={{ color: C.gray }}>{t('provider.navigation.distanceLabel')}</p>
                                    <p className="text-base font-bold" style={{ color: C.navy }}>{displayDistance}</p>
                                </div>
                                <div className="flex-1 rounded-xl p-2.5 text-center" style={{ background: C.bg }}>
                                    <p className="text-[10px] mb-0.5" style={{ color: C.gray }}>{t('provider.navigation.etaLabel')}</p>
                                    <p className="text-base font-bold" style={{ color: C.navy }}>{displayEta}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowConfirm(true)}
                                className="w-full py-4 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                style={{
                                    background: 'linear-gradient(135deg, #16a34a, #15803d)',
                                    boxShadow: '0 4px 16px rgba(22,163,74,0.35)',
                                }}
                            >
                                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {t('provider.navigation.arrivedBtn')}
                            </button>
                        </>
                    )}

                    {/* === WAITING: waiting for customer confirmation === */}
                    {arrivalState === 'waiting' && (
                        <div className="flex flex-col items-center py-2">
                            <div className="relative w-14 h-14 mb-3">
                                <span className="absolute inset-0 rounded-full animate-ping" style={{ background: '#fef3c7', opacity: 0.7 }} />
                                <div className="relative w-14 h-14 rounded-full flex items-center justify-center" style={{ background: '#fef9ee' }}>
                                    <svg className="animate-spin w-6 h-6" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke={C.orange} strokeWidth="4" />
                                        <path className="opacity-75" fill={C.orange} d="M4 12a8 8 0 018-8v8H4z" />
                                    </svg>
                                </div>
                            </div>
                            <p className="text-sm font-bold mb-1" style={{ color: C.navy }}>{t('provider.navigation.waiting.title')}</p>
                            <p className="text-xs text-center" style={{ color: C.gray }}>{t('provider.navigation.waiting.desc')}</p>
                        </div>
                    )}

                    {/* === CONFIRMED: 5s countdown then auto-transition to working === */}
                    {arrivalState === 'confirmed' && (
                        <div className="flex flex-col items-center py-2">
                            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ background: '#f0fdf4' }}>
                                <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <p className="text-sm font-bold mb-1" style={{ color: '#15803d' }}>{t('provider.navigation.confirmed.title')}</p>
                            <p className="text-xs text-center mb-4" style={{ color: C.gray }}>
                                {t('provider.navigation.confirmed.autoStart').replace('{count}', String(workingCountdown))}
                            </p>
                            <button
                                onClick={() => {
                                    if (countdownRef.current) clearInterval(countdownRef.current);
                                    setArrivalState('working');
                                }}
                                className="w-full py-3.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2"
                                style={{
                                    background: 'linear-gradient(135deg, #16a34a, #15803d)',
                                    boxShadow: '0 4px 16px rgba(22,163,74,0.3)',
                                }}
                            >
                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {t('provider.navigation.confirmed.startBtn')}
                            </button>
                        </div>
                    )}

                    {/* === WORKING: full-screen WorkingView takes over (rendered below) === */}
                    {arrivalState === 'working' && (
                        <div className="flex flex-col items-center py-2">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2" style={{ background: '#f0fdf4' }}>
                                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <p className="text-sm font-bold" style={{ color: '#15803d' }}>{t('provider.navigation.working.title')}</p>
                            <p className="text-xs text-center" style={{ color: C.gray }}>{t('provider.navigation.working.desc')}</p>
                        </div>
                    )}

                    {/* === DENIED: customer says not here yet → prompt to contact === */}
                    {arrivalState === 'denied' && (
                        <div>
                            <div className="flex items-center gap-3 p-3 rounded-2xl mb-3" style={{ background: '#fef2f2', border: '1.5px solid #fca5a5' }}>
                                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#dc2626" strokeWidth={2} className="flex-shrink-0">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <div>
                                    <p className="text-sm font-bold" style={{ color: '#dc2626' }}>{t('provider.navigation.denied.title')}</p>
                                    <p className="text-xs" style={{ color: '#b91c1c' }}>{t('provider.navigation.denied.desc')}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {displayPhone && (
                                    <a
                                        href={`tel:${displayPhone}`}
                                        className="flex flex-col items-center justify-center py-3 rounded-2xl text-xs font-semibold text-white gap-1"
                                        style={{ background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})` }}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                        </svg>
                                        {t('provider.navigation.denied.callBtn')}
                                    </a>
                                )}
                                <button
                                    onClick={() => setIsChatOpen(true)}
                                    className="flex flex-col items-center justify-center py-3 rounded-2xl text-xs font-semibold gap-1"
                                    style={{ background: '#eff6ff', color: '#2563eb' }}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    {t('provider.navigation.denied.chatBtn')}
                                </button>
                                <button
                                    onClick={() => setArrivalState('idle')}
                                    className="flex flex-col items-center justify-center py-3 rounded-2xl text-xs font-semibold gap-1"
                                    style={{ background: C.bg, color: C.gray }}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.gray} strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    {t('provider.navigation.denied.retryBtn')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Chat Modal for provider during navigation */}
            {isChatOpen && providerId && (
                <Suspense fallback={null}>
                    <ChatModal
                        requestId={requestId}
                        currentUserId={providerId}
                        currentUserRole="PROVIDER"
                        currentUserName={providerName ?? 'Provider'}
                        otherPartyName={customerName ?? user?.name ?? t('provider.navigation.customerMarker')}
                        onClose={() => setIsChatOpen(false)}
                    />
                </Suspense>
            )}

            {/* Pre-confirmation modal (confirm before sending mark-arrived) */}
            {showConfirm && arrivalState === 'idle' && (
                <div
                    className="fixed inset-0 z-50 flex items-end justify-center"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                    onClick={() => !isMarkingArrived && setShowConfirm(false)}
                >
                    <div
                        className="w-full max-w-lg mx-auto px-4 pb-8 pt-6"
                        style={{ background: 'white', borderRadius: '24px 24px 0 0', boxShadow: '0 -8px 40px rgba(0,0,0,0.25)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: '#f0fdf4' }}>
                            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        <h3 className="text-base font-bold text-center mb-1" style={{ color: C.navy }}>{t('provider.navigation.confirmModal.title')}</h3>
                        <p className="text-sm text-center mb-6" style={{ color: C.gray }}>
                            {t('provider.navigation.confirmModal.desc')}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setShowConfirm(false)}
                                disabled={isMarkingArrived}
                                className="py-3.5 rounded-2xl text-sm font-semibold"
                                style={{ background: C.bg, color: C.gray }}
                            >
                                {t('provider.navigation.confirmModal.cancelBtn')}
                            </button>
                            <button
                                onClick={handleMarkArrived}
                                disabled={isMarkingArrived}
                                className="py-3.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2"
                                style={{
                                    background: isMarkingArrived ? C.gray : 'linear-gradient(135deg, #16a34a, #15803d)',
                                    boxShadow: isMarkingArrived ? 'none' : '0 3px 12px rgba(22,163,74,0.35)',
                                }}
                            >
                                {isMarkingArrived ? (
                                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                                        <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8H4z" />
                                    </svg>
                                ) : t('provider.navigation.confirmModal.confirmBtn')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── WorkingView Full-screen overlay ─── */}
            {arrivalState === 'working' && !isPaymentPending && (
                <WorkingView
                    requestId={requestId}
                    request={requestDetails ?? { pickupLocation: { addressText: (pickupLocation as any).addressText } }}
                    customerName={customerName}
                    acceptedQuotePrice={acceptedQuotePrice}
                    onPaymentSubmitted={(method?: 'CASH' | 'QR') => {
                        setPaymentMethod(method ?? 'CASH');
                        setIsPaymentPending(true);
                    }}
                />
            )}

            {/* ─── Provider Payment Pending: waiting for customer ─── */}
            {isPaymentPending && (
                <div
                    className="fixed inset-0 z-50 flex flex-col items-center justify-center px-5"
                    style={{ background: '#f8fafc' }}
                >
                    {paymentMethod === 'QR' ? (
                        /* ── QR: system already processed payment — provider just finalises ── */
                        <>
                            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5" style={{ background: '#f0fdf4' }}>
                                <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h2 className="text-base font-bold mb-1 text-center" style={{ color: C.navy }}>{t('provider.navigation.payment.qr.title')}</h2>
                            <p className="text-xs text-center mb-6" style={{ color: C.gray }}>
                                {t('provider.navigation.payment.qr.desc')}
                            </p>
                            <div className="w-full rounded-2xl p-3 mb-5 flex items-start gap-2" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={C.green} strokeWidth={2} className="flex-shrink-0 mt-0.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-xs" style={{ color: '#166534' }}>
                                    {t('provider.navigation.payment.qr.note')}
                                </p>
                            </div>
                            <button
                                onClick={async () => {
                                    setIsConfirmingReceived(true);
                                    try {
                                        const payRes = await api.get(`/rescue-requests/${requestId}/payment`);
                                        if (payRes.data) {
                                            setJobEarnings({
                                                totalAmount: payRes.data.totalAmount,
                                                commissionRate: 0.1,
                                            });
                                        }
                                        setShowJobDone(true);
                                    } catch {
                                        setShowJobDone(true);
                                    } finally {
                                        setIsConfirmingReceived(false);
                                    }
                                }}
                                disabled={isConfirmingReceived}
                                className="w-full py-4 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2"
                                style={{
                                    background: isConfirmingReceived ? C.gray : `linear-gradient(135deg, ${C.green}, #15803d)`,
                                    boxShadow: isConfirmingReceived ? 'none' : '0 4px 16px rgba(22,163,74,0.35)',
                                }}
                            >
                                {isConfirmingReceived ? (
                                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                                        <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8H4z" />
                                    </svg>
                                ) : (
                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                )}
                                {t('provider.navigation.payment.qr.completeBtn')}
                            </button>
                        </>
                    ) : (
                        /* ── CASH: provider must physically receive money ── */
                        <>
                            <div className="relative mb-5">
                                <span className="absolute inset-0 w-20 h-20 rounded-full animate-ping" style={{ background: '#fed7aa', opacity: 0.5 }} />
                                <div className="relative w-20 h-20 rounded-full flex items-center justify-center" style={{ background: '#fff7ed' }}>
                                    <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                </div>
                            </div>
                            <h2 className="text-base font-bold mb-1 text-center" style={{ color: C.navy }}>{t('provider.navigation.payment.cash.title')}</h2>
                            <p className="text-xs text-center mb-6" style={{ color: C.gray }}>
                                {t('provider.navigation.payment.cash.desc')}
                            </p>
                            <div className="w-full rounded-2xl p-3 mb-5 flex items-start gap-2" style={{ background: '#fef3c7', border: '1px solid #fcd34d' }}>
                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#d97706" strokeWidth={2} className="flex-shrink-0 mt-0.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <p className="text-xs" style={{ color: '#92400e' }}>
                                    {t('provider.navigation.payment.cash.note')}
                                </p>
                            </div>
                            <button
                                onClick={async () => {
                                    setIsConfirmingReceived(true);
                                    try {
                                        await api.patch(`/rescue-requests/${requestId}/payment/confirm-received`);
                                        try {
                                            const payRes = await api.get(`/rescue-requests/${requestId}/payment`);
                                            if (payRes.data) setJobEarnings({ totalAmount: payRes.data.totalAmount, commissionRate: 0.1 });
                                        } catch { /* ignore */ }
                                        setShowJobDone(true);
                                    } catch (err: any) {
                                        toast.error(err.response?.data?.message || t('provider.navigation.toastArrivalDenied'));
                                    } finally {
                                        setIsConfirmingReceived(false);
                                    }
                                }}
                                disabled={isConfirmingReceived}
                                className="w-full py-4 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2"
                                style={{
                                    background: isConfirmingReceived ? C.gray : `linear-gradient(135deg, ${C.green}, #15803d)`,
                                    boxShadow: isConfirmingReceived ? 'none' : '0 4px 16px rgba(22,163,74,0.35)',
                                }}
                            >
                                {isConfirmingReceived ? (
                                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                                        <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8H4z" />
                                    </svg>
                                ) : (
                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                )}
                                {t('provider.navigation.payment.cash.receivedBtn')}
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* ─── Job Done – Provider Finish Screen ─── */}
            {showJobDone && (
                <div
                    className="fixed inset-0 z-[100] flex flex-col"
                    style={{
                        background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 60%, #0c2340 100%)',
                        fontFamily: 'Poppins, sans-serif',
                    }}
                >
                    {/* React Confetti */}
                    <ReactConfetti
                        width={typeof window !== 'undefined' ? window.innerWidth : 400}
                        height={typeof window !== 'undefined' ? window.innerHeight : 800}
                        numberOfPieces={280}
                        recycle={false}
                        gravity={0.25}
                        colors={['#f97316', '#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#ffffff']}
                        style={{ position: 'fixed', top: 0, left: 0, zIndex: 101, pointerEvents: 'none' }}
                    />
                    {/* Background dots */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        {[...Array(18)].map((_, i) => (
                            <div
                                key={i}
                                className="absolute rounded-full animate-ping"
                                style={{
                                    width: `${6 + (i % 5) * 3}px`,
                                    height: `${6 + (i % 5) * 3}px`,
                                    top: `${5 + (i * 17) % 80}%`,
                                    left: `${3 + (i * 23) % 90}%`,
                                    background: ['#f97316', '#22c55e', '#3b82f6', '#f59e0b', '#a855f7'][i % 5],
                                    opacity: 0.25,
                                    animationDuration: `${1.5 + (i % 4) * 0.5}s`,
                                    animationDelay: `${(i % 5) * 0.2}s`,
                                }}
                            />
                        ))}
                    </div>

                    {/* Main content */}
                    <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
                        {/* Trophy / check icon */}
                        <div
                            className="w-24 h-24 rounded-full flex items-center justify-center mb-5"
                            style={{ background: 'rgba(249,115,22,0.15)', border: '2px solid rgba(249,115,22,0.3)' }}
                        >
                            <span style={{ fontSize: '44px' }}>🎉</span>
                        </div>

                        <h1 className="text-2xl font-bold text-white mb-2">{t('provider.navigation.jobDone.title')}</h1>
                        <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.6)' }}>
                            {t('provider.navigation.jobDone.desc')}
                        </p>

                        {/* Earnings summary card */}
                        {jobEarnings && (
                            <div
                                className="w-full max-w-sm rounded-2xl p-5 mb-6"
                                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
                            >
                                <p className="text-xs font-semibold mb-4" style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em' }}>{t('provider.navigation.jobDone.earningsTitle')}</p>
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{t('provider.navigation.jobDone.jobValue')}</span>
                                    <span className="text-base font-bold text-white">
                                        {jobEarnings.totalAmount.toLocaleString('vi-VN')}đ
                                    </span>
                                </div>
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                                        {t('provider.navigation.jobDone.commission').replace('{rate}', String(jobEarnings.commissionRate * 100))}
                                    </span>
                                    <span className="text-sm font-semibold" style={{ color: '#f97316' }}>
                                        −{Math.round(jobEarnings.totalAmount * jobEarnings.commissionRate).toLocaleString('vi-VN')}đ
                                    </span>
                                </div>
                                <div
                                    className="flex justify-between items-center pt-3"
                                    style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}
                                >
                                    <span className="text-sm font-bold text-white">{t('provider.navigation.jobDone.netEarnings')}</span>
                                    <span className="text-xl font-bold" style={{ color: '#22c55e' }}>
                                        {Math.round(jobEarnings.totalAmount * (1 - jobEarnings.commissionRate)).toLocaleString('vi-VN')}đ
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Note about commission */}
                        <div
                            className="w-full max-w-sm rounded-xl px-4 py-3 mb-8 flex items-start gap-2"
                            style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)' }}
                        >
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#f97316" strokeWidth={2} className="flex-shrink-0 mt-0.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
                                {t('provider.navigation.jobDone.commissionNote')}
                            </p>
                        </div>
                    </div>

                    {/* Bottom CTAs */}
                    <div className="px-6 pb-10 space-y-3">
                        <button
                            onClick={() => { window.location.href = '/provider/wallet'; }}
                            className="w-full py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
                            style={{
                                background: 'linear-gradient(135deg, #f97316, #ea6c0a)',
                                boxShadow: '0 4px 20px rgba(249,115,22,0.4)',
                                color: 'white',
                            }}
                        >
                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            </svg>
                            {t('provider.navigation.jobDone.walletBtn')}
                        </button>
                        <button
                            onClick={() => onCompleted?.()}
                            className="w-full py-4 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2"
                            style={{
                                background: 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                color: 'rgba(255,255,255,0.85)',
                            }}
                        >
                            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            {t('provider.navigation.jobDone.homeBtn')}
                        </button>
                    </div>
                </div>
            )
            }
        </>
    );
}
