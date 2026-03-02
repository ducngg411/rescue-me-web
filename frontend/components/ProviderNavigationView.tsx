'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const VIETMAP_API_KEY = process.env.NEXT_PUBLIC_VIETMAP_API_KEY;

const C = {
    orange: '#f97316',
    orangeDark: '#ea6c0a',
    orangeLight: '#fff7ed',
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#f1f5f9',
    bg: '#f8fafc',
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
}

export default function ProviderNavigationView({
    pickupLocation,
    user,
    eta,
    requestId,
}: ProviderNavigationViewProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<any>(null);
    const [isMapReady, setIsMapReady] = useState(false);
    const [providerLocation, setProviderLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
    const [isLoadingRoute, setIsLoadingRoute] = useState(false);
    const routeDrawn = useRef(false);

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

                    // FitBounds to show entire route
                    const lngs = coords.map(c => c[0]);
                    const lats = coords.map(c => c[1]);
                    map.current.fitBounds(
                        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
                        { padding: { top: 80, bottom: 200, left: 40, right: 40 }, duration: 1200 }
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
            .setPopup(new vgl.Popup({ offset: 25 }).setText('Vị trí của bạn'))
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
            .setPopup(new vgl.Popup({ offset: 36 }).setText(user?.name ? `Khách: ${user.name}` : 'Vị trí khách hàng'))
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

    const displayName = user?.name || 'Khách hàng';
    const displayPhone = user?.phoneNumber;
    const displayDistance = routeInfo ? `${routeInfo.distance} km` : '~';
    const displayEta = routeInfo ? `${routeInfo.duration} phút` : (eta ? `${eta} phút` : '~');

    return (
        <div className="flex flex-col" style={{ height: '100vh', fontFamily: 'Poppins, sans-serif' }}>
            {/* ── Info Panel (fixed top overlay on map) ── */}
            <div
                className="absolute top-0 left-0 right-0 z-10 px-4 pt-3 pb-4"
                style={{ background: 'white', borderBottom: `1px solid ${C.border}`, boxShadow: '0 2px 16px rgba(0,0,0,0.10)' }}
            >
                {/* Title row */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#22c55e' }} />
                        <span className="text-sm font-bold" style={{ color: C.navy }}>Đang điều hướng đến khách hàng</span>
                    </div>
                    {locationError && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#fefce8', color: '#ca8a04' }}>
                            GPS mặc định
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
                            Gọi ngay
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
                            <p className="text-sm" style={{ color: C.gray }}>Đang tải bản đồ...</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
