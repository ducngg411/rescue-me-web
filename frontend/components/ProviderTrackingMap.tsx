'use client';

import { useEffect, useRef, useState, useCallback, lazy, Suspense } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useChat } from '@/lib/hooks/useChat';

const ChatModal = lazy(() => import('@/components/ChatModal'));

const VIETMAP_API_KEY = process.env.NEXT_PUBLIC_VIETMAP_API_KEY || '';

// ── Color palette ────────────────────────────────────────────────────────────
const C = {
    orange: '#f97316',
    orangeDark: '#ea6c0a',
    orangeLight: '#fff7ed',
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#f1f5f9',
    bg: '#f8fafc',
    blue: '#3b82f6',
    green: '#16a34a',
    greenLight: '#f0fdf4',
};

// ── VietMap singleton loader (same pattern as RouteMapSheet) ─────────────────
let vmLoaded = false;
let vmPromise: Promise<void> | null = null;

function loadVietMapScript(): Promise<void> {
    if (vmLoaded && (window as any).vietmapgl) return Promise.resolve();
    if (vmPromise) return vmPromise;
    vmPromise = new Promise((resolve, reject) => {
        if ((window as any).vietmapgl) { vmLoaded = true; resolve(); return; }
        if (!document.getElementById('ptm-vm-css')) {
            const link = document.createElement('link');
            link.id = 'ptm-vm-css';
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/@vietmap/vietmap-gl-js@6.0.0/dist/vietmap-gl.css';
            document.head.appendChild(link);
        }
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@vietmap/vietmap-gl-js@6.0.0/dist/vietmap-gl.js';
        script.async = true;
        script.onload = () => { vmLoaded = true; resolve(); };
        script.onerror = () => { vmPromise = null; reject(new Error('VietMap load failed')); };
        document.head.appendChild(script);
    });
    return vmPromise;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function haversineM(a: [number, number], b: [number, number]): number {
    const R = 6371000;
    const dLat = (b[1] - a[1]) * Math.PI / 180;
    const dLon = (b[0] - a[0]) * Math.PI / 180;
    const lat1 = a[1] * Math.PI / 180;
    const lat2 = b[1] * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function fmtDist(m: number): string {
    if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
    return `${Math.round(m / 50) * 50} m`;
}

function decodePolyline(encoded: string): [number, number][] {
    const coords: [number, number][] = [];
    let index = 0, lat = 0, lng = 0;
    while (index < encoded.length) {
        let b, shift = 0, result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lat += (result & 1) ? ~(result >> 1) : (result >> 1);
        shift = 0; result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lng += (result & 1) ? ~(result >> 1) : (result >> 1);
        coords.push([lng / 1e5, lat / 1e5]);
    }
    return coords;
}

// ── Props ────────────────────────────────────────────────────────────────────
interface ProviderTrackingMapProps {
    requestId: string;
    customerLat: number;
    customerLng: number;
    customerAddress?: string;
    providerName?: string | null;
    providerAvatar?: string | null;
    providerPhone?: string | null;
    matchedEta?: number | null;
    chatCustomerId?: string;
    chatCustomerName?: string;
    onClose: () => void;
}

export default function ProviderTrackingMap({
    requestId,
    customerLat,
    customerLng,
    customerAddress,
    providerName,
    providerAvatar,
    providerPhone,
    matchedEta,
    chatCustomerId,
    chatCustomerName,
    onClose,
}: ProviderTrackingMapProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const isMapInitialized = useRef(false);
    const providerMarkerRef = useRef<any>(null);
    const routeDrawnRef = useRef(false);
    const lastRoutePos = useRef<[number, number] | null>(null);
    const isDrawingRoute = useRef(false);

    const [mapReady, setMapReady] = useState(false);
    const [providerPos, setProviderPos] = useState<{ lat: number; lng: number; bearing: number } | null>(null);
    const [routeInfo, setRouteInfo] = useState<{ distM: number; durationMin: number } | null>(null);
    const [isLoadingRoute, setIsLoadingRoute] = useState(false);
    const [isProviderOffline, setIsProviderOffline] = useState(false);
    const [liveEta, setLiveEta] = useState<number | null>(
        matchedEta != null ? Math.max(1, matchedEta) : null
    );
    const [isChatOpen, setIsChatOpen] = useState(false);

    const { user: currentUser } = useAuth();
    const { t } = useLanguage();
    const currentUserId = chatCustomerId ?? currentUser?.id ?? '';
    const currentUserName =
        chatCustomerName ??
        currentUser?.name ??
        currentUser?.email?.split('@')[0] ??
        t('user.tracking.assignedProvider.customerFallback');

    const chatEnabled = !!(requestId && currentUserId);
    const { unreadCount } = useChat({
        requestId: requestId ?? '__none__',
        currentUserId,
        currentUserRole: 'CUSTOMER',
        currentUserName,
        enabled: chatEnabled,
    });

    // ── 1. Firestore subscribe (with retry on error) ────────────────────────
    useEffect(() => {
        let mounted = true;
        let unsub: (() => void) | null = null;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;

        const subscribe = () => {
            if (!mounted) return;
            unsub?.();
            unsub = onSnapshot(
                doc(db, 'locations', requestId),
                (snap) => {
                    if (!mounted) return;
                    if (!snap.exists()) { setIsProviderOffline(true); return; }
                    const d = snap.data();
                    setIsProviderOffline(false);
                    setProviderPos({ lat: d.lat, lng: d.lng, bearing: d.bearing ?? 0 });
                },
                (err) => {
                    console.error('[TrackingMap] onSnapshot error:', err);
                    if (mounted) {
                        setIsProviderOffline(true);
                        retryTimer = setTimeout(() => { if (mounted) subscribe(); }, 3000);
                    }
                }
            );
        };

        // 80ms delay prevents React StrictMode double-mount triggering Firebase ca9 bug
        const initTimer = setTimeout(subscribe, 80);

        return () => {
            mounted = false;
            clearTimeout(initTimer);
            if (retryTimer) clearTimeout(retryTimer);
            unsub?.();
        };
    }, [requestId]);

    // ── 2. Init map (same pattern as RouteMapSheet) ───────────────────────────
    useEffect(() => {
        loadVietMapScript().then(() => {
            if (!mapContainerRef.current || isMapInitialized.current) return;
            isMapInitialized.current = true;

            const vgl = (window as any).vietmapgl;

            mapRef.current = new vgl.Map({
                container: mapContainerRef.current,
                style: `https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=${VIETMAP_API_KEY}`,
                center: [customerLng, customerLat],
                zoom: 14,
                attributionControl: false,
            });

            // Customer marker — blue pulsing dot
            const custEl = document.createElement('div');
            custEl.style.cssText = `
                width:20px;height:20px;
                background:${C.blue};border-radius:50%;
                border:3px solid white;
                box-shadow:0 0 0 6px rgba(59,130,246,0.2);
            `;
            new vgl.Marker(custEl).setLngLat([customerLng, customerLat]).addTo(mapRef.current);

            // Provider marker — custom SVG pin
            const provEl = document.createElement('div');
            provEl.innerHTML = `
                <div style="position:relative;width:40px;height:48px;transform:translateY(-12px);">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 30" style="width:100%;height:100%;filter:drop-shadow(0 4px 8px rgba(249,115,22,0.4));">
                        <path d="M12 0C7.6 0 4 3.6 4 8c0 6 8 16 8 16s8-10 8-16c0-4.4-3.6-8-8-8z" fill="#f97316"/>
                        <circle cx="12" cy="8" r="4.5" fill="white"/>
                        <path d="M12 5.5v5m-2.5-2.5h5" stroke="#f97316" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                </div>
            `;
            providerMarkerRef.current = new vgl.Marker(provEl)
                .setLngLat([customerLng, customerLat])
                .addTo(mapRef.current);

            mapRef.current.on('load', () => setMapReady(true));
        }).catch(console.error);

        return () => {
            const m = mapRef.current;
            mapRef.current = null;
            isMapInitialized.current = false;
            providerMarkerRef.current = null;
            routeDrawnRef.current = false;
            lastRoutePos.current = null;
            if (m) {
                const suppress = (e: PromiseRejectionEvent) => {
                    if (e.reason?.name === 'AbortError') e.preventDefault();
                };
                window.addEventListener('unhandledrejection', suppress);
                try { m.remove(); } catch { }
                setTimeout(() => window.removeEventListener('unhandledrejection', suppress), 500);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── 3. Draw route ─────────────────────────────────────────────────────────
    const drawRoute = useCallback(async (pLat: number, pLng: number) => {
        const map = mapRef.current;
        if (!map || !mapReady || isDrawingRoute.current) return;
        isDrawingRoute.current = true;
        setIsLoadingRoute(true);
        try {
            const url = new URL('https://maps.vietmap.vn/api/route');
            url.searchParams.append('api-version', '1.1');
            url.searchParams.append('apikey', VIETMAP_API_KEY);
            url.searchParams.append('point', `${pLat},${pLng}`);
            url.searchParams.append('point', `${customerLat},${customerLng}`);
            url.searchParams.append('vehicle', 'motorcycle');

            const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
            const data = await res.json();
            const path = data.paths?.[0];
            if (!path) return;

            const coords = decodePolyline(path.points);
            const distM = path.distance as number;
            const durationMin = Math.max(1, Math.ceil((path.time as number) / 60000));
            setRouteInfo({ distM, durationMin });
            setLiveEta(durationMin);
            lastRoutePos.current = [pLng, pLat];

            // Remove old layers/source
            try { if (map.getLayer('ptm-casing')) map.removeLayer('ptm-casing'); } catch { }
            try { if (map.getLayer('ptm-route')) map.removeLayer('ptm-route'); } catch { }
            try { if (map.getSource('ptm-route')) map.removeSource('ptm-route'); } catch { }

            map.addSource('ptm-route', {
                type: 'geojson',
                data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } },
            });
            map.addLayer({
                id: 'ptm-casing',
                type: 'line',
                source: 'ptm-route',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': 0.85 },
            });
            map.addLayer({
                id: 'ptm-route',
                type: 'line',
                source: 'ptm-route',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': C.orange, 'line-width': 5, 'line-opacity': 1 },
            });

            // Fit to show full route
            const lngs = coords.map(c => c[0]);
            const lats = coords.map(c => c[1]);
            map.fitBounds(
                [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
                { padding: { top: 80, bottom: 220, left: 50, right: 50 }, duration: 1000 }
            );
            routeDrawnRef.current = true;
        } catch { /* silent */ }
        finally { setIsLoadingRoute(false); isDrawingRoute.current = false; }
    }, [mapReady, customerLat, customerLng]);

    // ── 4. Update marker + re-route when position changes ────────────────────
    useEffect(() => {
        if (!providerPos || !mapReady) return;
        const { lat, lng } = providerPos;

        if (providerMarkerRef.current) {
            providerMarkerRef.current.setLngLat([lng, lat]);
        }

        const prev = lastRoutePos.current;
        const needsRoute = !routeDrawnRef.current || (prev && haversineM([lng, lat], prev) > 60);
        if (needsRoute) drawRoute(lat, lng);
    }, [providerPos, mapReady, drawRoute]);

    // ── Pulse CSS ─────────────────────────────────────────────────────────────
    useEffect(() => {
        if (document.getElementById('ptm-styles')) return;
        const s = document.createElement('style');
        s.id = 'ptm-styles';
        s.textContent = `
            @keyframes ptmPing { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:0;transform:scale(1.6)} }
        `;
        document.head.appendChild(s);
    }, []);

    const displayName = providerName || 'Cứu hộ viên';
    const initials = displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

    return (
        <div
            className="fixed inset-0 z-50 flex flex-col"
            style={{ fontFamily: 'Lexend, sans-serif' }}
        >
            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div
                className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
                style={{
                    background: 'white',
                    borderBottom: `1px solid ${C.border}`,
                    boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
                    paddingTop: 'max(12px, env(safe-area-inset-top))',
                }}
            >
                <button
                    onClick={onClose}
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
                    style={{ background: C.bg }}
                    aria-label="Đóng bản đồ"
                >
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={C.navy} strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>

                <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm leading-tight" style={{ color: C.navy }}>
                        Theo dõi Cứu hộ viên
                    </p>
                    {customerAddress && (
                        <p className="text-xs truncate mt-0.5" style={{ color: C.gray }}>
                            📍 {customerAddress}
                        </p>
                    )}
                </div>

                {/* Status + ETA badges */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    {!isProviderOffline && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                            style={{ background: `${C.orange}15`, border: `1px solid ${C.orange}30` }}>
                            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.orange }} />
                            <span className="text-[11px] font-semibold" style={{ color: C.orange }}>Trực tiếp</span>
                        </div>
                    )}
                    {liveEta !== null && (
                        <div className="px-2.5 py-1 rounded-full"
                            style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                            <span className="text-[11px] font-bold" style={{ color: C.navy }}>~{liveEta} phút</span>
                        </div>
                    )}
                    {isLoadingRoute && (
                        <svg className="animate-spin w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke={C.orange} strokeWidth="3" />
                            <path className="opacity-75" fill={C.orange} d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                    )}
                </div>
            </div>

            {/* ── Map (flex-1 so it fills remaining space — same as RouteMapSheet) ── */}
            <div className="flex-1 relative" style={{ minHeight: 0 }}>
                <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

                {/* Offline banner */}
                {isProviderOffline && (
                    <div className="absolute top-3 left-3 right-3 flex items-center gap-2 px-3 py-2 rounded-xl"
                        style={{ background: 'rgba(255,255,255,0.95)', border: `1px solid ${C.border}`, boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#94a3b8' }} />
                        <span className="text-xs" style={{ color: C.gray }}>Chờ vị trí GPS từ cứu hộ viên...</span>
                    </div>
                )}

                {/* Distance chip (top-right) */}
                {routeInfo && (
                    <div className="absolute top-3 right-3 px-3 py-1.5 rounded-xl"
                        style={{ background: 'rgba(255,255,255,0.95)', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', border: `1px solid ${C.border}` }}>
                        <p className="text-sm font-bold" style={{ color: C.orange }}>{fmtDist(routeInfo.distM)}</p>
                        <p className="text-[10px] text-center mt-0.5" style={{ color: C.gray }}>còn lại</p>
                    </div>
                )}

                {/* Legend */}
                <div className="absolute bottom-4 right-3 flex flex-col gap-1.5 px-2.5 py-2 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.95)', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ background: C.orange, border: '2px solid white', boxShadow: `0 0 4px ${C.orange}80` }} />
                        <span className="text-[10px] font-medium" style={{ color: C.navy }}>Cứu hộ viên</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ background: C.blue, border: '2px solid white', boxShadow: `0 0 4px ${C.blue}80` }} />
                        <span className="text-[10px] font-medium" style={{ color: C.navy }}>Vị trí của bạn</span>
                    </div>
                </div>
            </div>

            {/* ── Bottom Provider Card ────────────────────────────────────────── */}
            <div
                className="flex-shrink-0"
                style={{
                    background: 'white',
                    borderTop: `1px solid ${C.border}`,
                    boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
                    paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
                }}
            >
                <div className="flex items-center gap-3 px-4 pt-3 pb-2">
                    {/* Avatar */}
                    <div
                        className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                        style={{
                            background: providerAvatar
                                ? `url(${providerAvatar}) center/cover`
                                : `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`,
                            boxShadow: `0 2px 8px ${C.orange}40`,
                        }}
                    >
                        {!providerAvatar && initials}
                    </div>

                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm" style={{ color: C.navy }}>{displayName}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.orange }} />
                            <span className="text-xs" style={{ color: C.orange }}>Đang trên đường đến chỗ bạn</span>
                            {liveEta !== null && (
                                <span className="text-xs" style={{ color: C.gray }}>· ~{liveEta} phút nữa</span>
                            )}
                        </div>
                    </div>

                    {/* Call and Chat buttons */}
                    <div className="flex items-center gap-2">
                        {chatEnabled && (
                            <button
                                onClick={() => setIsChatOpen(true)}
                                className="relative h-11 px-4 rounded-xl flex items-center justify-center gap-2 flex-shrink-0 active:scale-95 transition-transform"
                                style={{
                                    background: C.orangeLight,
                                    color: C.orangeDark,
                                    border: `1.5px solid ${C.orange}30`,
                                }}
                            >
                                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                <span className="text-sm font-bold truncate max-w-[60px]">Chat</span>
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1 shadow-sm border-2 border-white">
                                        {unreadCount}
                                    </span>
                                )}
                            </button>
                        )}
                        {providerPhone && (
                            <a
                                href={`tel:${providerPhone}`}
                                className="h-11 px-4 rounded-xl flex items-center justify-center gap-2 flex-shrink-0 active:scale-95 transition-transform"
                                style={{
                                    background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`,
                                    boxShadow: `0 3px 10px ${C.orange}40`,
                                    color: 'white',
                                }}
                            >
                                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                <span className="text-sm font-bold">Gọi</span>
                            </a>
                        )}
                    </div>
                </div>
            </div>

            {/* Chat Modal Layer */}
            {isChatOpen && (
                <Suspense fallback={null}>
                    <ChatModal
                        requestId={requestId}
                        currentUserId={currentUserId}
                        currentUserRole="CUSTOMER"
                        currentUserName={currentUserName}
                        otherPartyName={displayName}
                        otherPartyAvatar={providerAvatar}
                        onClose={() => setIsChatOpen(false)}
                    />
                </Suspense>
            )}
        </div>
    );
}
