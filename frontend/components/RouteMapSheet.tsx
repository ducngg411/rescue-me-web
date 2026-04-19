'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Car, Bike, Footprints, ArrowUp, ArrowLeft, ArrowRight, ArrowUpLeft, ArrowUpRight, CornerUpLeft, CornerUpRight, MapPin, RefreshCcw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';


// ─── Config ──────────────────────────────────────────────────────────────────

const VIETMAP_API_KEY = process.env.NEXT_PUBLIC_VIETMAP_API_KEY || '';

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

// ─── Types ───────────────────────────────────────────────────────────────────

interface RouteStep {
    text: string;
    distance: number; // meters
    time: number;     // ms
    sign?: number;    // VietMap turn sign code
}

interface RouteInfo {
    distance: number;          // meters
    time: number;              // ms
    coordinates: [number, number][]; // [lng, lat][]
    steps: RouteStep[];
}

export interface RouteMapSheetProps {
    isOpen: boolean;
    onClose: () => void;
    userLat: number;
    userLng: number;
    shopLat: number;
    shopLng: number;
    shopName: string;
    shopAddress?: string;
    shopPhone?: string;
}

type Vehicle = 'car' | 'motorcycle' | 'foot';

// ─── VietMap Script Loader (singleton) ───────────────────────────────────────

let vmScriptLoaded = false;
let vmLoadPromise: Promise<void> | null = null;

function loadVietMapScript(): Promise<void> {
    if (vmScriptLoaded && (window as any).vietmapgl) return Promise.resolve();
    if (vmLoadPromise) return vmLoadPromise;

    vmLoadPromise = new Promise((resolve, reject) => {
        if ((window as any).vietmapgl) { vmScriptLoaded = true; resolve(); return; }

        if (!document.getElementById('vm-route-css')) {
            const link = document.createElement('link');
            link.id = 'vm-route-css';
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/@vietmap/vietmap-gl-js@6.0.0/dist/vietmap-gl.css';
            document.head.appendChild(link);
        }

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@vietmap/vietmap-gl-js@6.0.0/dist/vietmap-gl.js';
        script.async = true;
        script.onload = () => { vmScriptLoaded = true; resolve(); };
        script.onerror = () => { vmLoadPromise = null; reject(new Error('Failed to load VietMap')); };
        document.head.appendChild(script);
    });

    return vmLoadPromise;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Map VietMap sign codes to Vietnamese turn instructions
function signToIcon(sign?: number) {
    const s = 18;
    const sw = 2.5;
    switch (sign) {
        case -3: return <CornerUpLeft size={s} strokeWidth={sw} />;
        case -2: return <ArrowLeft size={s} strokeWidth={sw} />;
        case -1: return <ArrowUpLeft size={s} strokeWidth={sw} />;
        case 0: return <ArrowUp size={s} strokeWidth={sw} />;
        case 1: return <ArrowUpRight size={s} strokeWidth={sw} />;
        case 2: return <ArrowRight size={s} strokeWidth={sw} />;
        case 3: return <CornerUpRight size={s} strokeWidth={sw} />;
        case 4: return <MapPin size={s} strokeWidth={sw} />;
        case 6: return <RefreshCcw size={s} strokeWidth={sw} />;
        default: return <ArrowUp size={s} strokeWidth={sw} />;
    }
}

// ─── Step Item ───────────────────────────────────────────────────────────────

function StepItem({
    step,
    index,
    formatDistance,
    formatTime,
}: {
    step: RouteStep;
    index: number;
    formatDistance: (meters: number) => string;
    formatTime: (ms: number) => string;
}) {
    const isLast = step.sign === 4;
    return (
        <div
            className="flex items-start gap-3 py-3"
            style={{ borderBottom: `1px solid ${C.border}` }}
        >
            {/* Icon */}
            <div
                className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-base"
                style={{
                    background: isLast ? C.greenLight : C.orangeLight,
                    color: isLast ? C.green : C.orange,
                }}
            >
                {signToIcon(step.sign)}
            </div>

            {/* Description */}
            <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-sm leading-snug" style={{ color: C.navy }}>{step.text}</p>
                {step.distance > 0 && (
                    <p className="text-xs mt-1" style={{ color: C.gray }}>
                        {formatDistance(step.distance)} · {formatTime(step.time)}
                    </p>
                )}
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RouteMapSheet({
    isOpen,
    onClose,
    userLat,
    userLng,
    shopLat,
    shopLng,
    shopName,
    shopAddress,
    shopPhone,
}: RouteMapSheetProps) {
    const { t } = useLanguage();
    const p = 'user.dashboard.nearbyShops.routeSheet';

    const formatDistance = useCallback((meters: number) => {
        if (meters < 1000) return `${Math.round(meters)} m`;
        return `${(meters / 1000).toFixed(1)} km`;
    }, []);

    const formatTime = useCallback((ms: number) => {
        const minutes = Math.round(ms / 60000);
        if (minutes < 1) return t(`${p}.timeLessThanMin`);
        if (minutes < 60) return t(`${p}.timeMinutes`, { minutes });
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return m > 0 ? t(`${p}.timeHoursMinutes`, { hours: h, minutes: m }) : t(`${p}.timeHoursOnly`, { hours: h });
    }, [t]);

    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const isMapInitialized = useRef(false);

    const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
    const [isLoadingRoute, setIsLoadingRoute] = useState(false);
    const [routeError, setRouteError] = useState<string | null>(null);
    const [mapReady, setMapReady] = useState(false);
    const [vehicle, setVehicle] = useState<Vehicle>('motorcycle');
    const [showSteps, setShowSteps] = useState(false);

    // ── Fetch route from VietMap Route API ───────────────────────────────────
    const fetchRoute = useCallback(async (v: Vehicle) => {
        setIsLoadingRoute(true);
        setRouteError(null);
        setRouteInfo(null);

        try {
            // ⚠️ Mặc dù MapGL dùng [lng, lat], nhưng Route API REST lại yêu cầu lat,lng cho query param 'point'
            const url = new URL('https://maps.vietmap.vn/api/route');
            url.searchParams.append('api-version', '1.1');
            url.searchParams.append('apikey', VIETMAP_API_KEY);
            url.searchParams.append('point', `${userLat},${userLng}`);
            url.searchParams.append('point', `${shopLat},${shopLng}`);
            url.searchParams.append('vehicle', v);
            url.searchParams.append('calc_points', 'true');
            url.searchParams.append('instructions', 'true');
            url.searchParams.append('points_encoded', 'false');

            console.log(`Route API: ${v} from [${userLat},${userLng}] → [${shopLat},${shopLng}]`);

            const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            console.log('📦 RAW ROUTE RESPONSE:', JSON.stringify(data, null, 2));

            const path = data.paths?.[0];
            if (!path) {
                console.error('Không có thông tin data.paths:', data);
                throw new Error(t(`${p}.errorNoPath`));
            }

            const coordinates: [number, number][] = path.points?.coordinates ?? [];
            const steps: RouteStep[] = (path.instructions ?? []).map((s: any) => ({
                text: s.text ?? t(`${p}.continueStraight`),
                distance: s.distance ?? 0,
                time: s.time ?? 0,
                sign: s.sign,
            }));

            console.log(`✅ Route: ${formatDistance(path.distance)}, ${formatTime(path.time)}, ${coordinates.length} points`);

            setRouteInfo({ distance: path.distance, time: path.time, coordinates, steps });
        } catch (e: any) {
            const noPath = t(`${p}.errorNoPath`);
            const msg = e?.name === 'TimeoutError'
                ? t(`${p}.errorTimeout`)
                : (e?.message === noPath ? noPath : t(`${p}.errorGeneric`));
            setRouteError(msg);
        } finally {
            setIsLoadingRoute(false);
        }
    }, [userLat, userLng, shopLat, shopLng, t, formatDistance, formatTime]);

    // ── Init / destroy map ────────────────────────────────────────────────────
    useEffect(() => {
        if (!isOpen) {
            const m = mapRef.current;
            mapRef.current = null;
            isMapInitialized.current = false;
            setMapReady(false);
            setRouteInfo(null);
            setRouteError(null);
            if (m) {
                const suppress = (e: PromiseRejectionEvent) => { if (e.reason?.name === 'AbortError') e.preventDefault(); };
                window.addEventListener('unhandledrejection', suppress);
                try { m.remove(); } catch { }
                setTimeout(() => window.removeEventListener('unhandledrejection', suppress), 200);
            }
            return;
        }

        // Fetch route immediately
        fetchRoute(vehicle);

        // Init map
        loadVietMapScript().then(() => {
            if (!mapContainerRef.current || isMapInitialized.current) return;
            isMapInitialized.current = true;

            const vgl = (window as any).vietmapgl;

            const centerLng = (userLng + shopLng) / 2;
            const centerLat = (userLat + shopLat) / 2;

            mapRef.current = new vgl.Map({
                container: mapContainerRef.current,
                style: `https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=${VIETMAP_API_KEY}`,
                center: [centerLng, centerLat],
                zoom: 13,
            });

            mapRef.current.addControl(new vgl.NavigationControl(), 'top-right');

            // User marker — blue pulsing dot
            const userEl = document.createElement('div');
            userEl.style.cssText = 'width:14px;height:14px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 0 0 4px rgba(59,130,246,0.25)';
            new vgl.Marker(userEl).setLngLat([userLng, userLat]).addTo(mapRef.current);

            // Shop marker — orange pin
            const shopEl = document.createElement('div');
            shopEl.style.cssText = 'width:18px;height:18px;background:#f97316;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 10px rgba(249,115,22,0.5)';
            new vgl.Marker(shopEl).setLngLat([shopLng, shopLat]).addTo(mapRef.current);

            mapRef.current.on('load', () => setMapReady(true));
        }).catch(console.error);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // ── Draw route polyline when map + routeInfo are both ready ──────────────
    useEffect(() => {
        if (!mapReady || !routeInfo || !mapRef.current) return;
        const map = mapRef.current;
        const coords = routeInfo.coordinates;
        if (!coords.length) return;

        // Remove old layers/sources
        if (map.getLayer('route-line-border')) map.removeLayer('route-line-border');
        if (map.getLayer('route-line')) map.removeLayer('route-line');
        if (map.getSource('route')) map.removeSource('route');

        map.addSource('route', {
            type: 'geojson',
            data: {
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: coords },
            },
        });

        // Border (white shadow effect)
        map.addLayer({
            id: 'route-line-border',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': 0.8 },
        });

        // Main route
        map.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#f97316', 'line-width': 5, 'line-opacity': 1 },
        });

        // Fit bounds with padding for the bottom info panel
        const lngs = coords.map(c => c[0]);
        const lats = coords.map(c => c[1]);
        map.fitBounds(
            [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
            { padding: { top: 60, bottom: 240, left: 40, right: 40 }, duration: 800 }
        );
    }, [mapReady, routeInfo]);

    // ── Re-fetch when vehicle changes ─────────────────────────────────────────
    const handleVehicleChange = (v: Vehicle) => {
        setVehicle(v);
        if (isOpen) fetchRoute(v);
    };

    if (!isOpen) return null;

    const VEHICLES: { key: Vehicle; label: string; icon: React.ReactNode }[] = [
        { key: 'car', label: t(`${p}.vehicleCar`), icon: <Car size={16} strokeWidth={2.5} /> },
        { key: 'motorcycle', label: t(`${p}.vehicleMotorcycle`), icon: <Bike size={16} strokeWidth={2.5} /> },
        { key: 'foot', label: t(`${p}.vehicleWalk`), icon: <Footprints size={16} strokeWidth={2.5} /> },
    ];

    return (
        <div
            className="fixed inset-0 z-[60] flex flex-col"
            style={{ fontFamily: 'Lexend, sans-serif', background: C.bg }}
        >
            {/* ── Header ───────────────────────────────────────────────────── */}
            <div
                className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
                style={{ background: 'white', borderBottom: `1px solid ${C.border}`, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}
            >
                <button
                    onClick={onClose}
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                    style={{ background: C.bg }}
                >
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={C.navy} strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>

                <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate" style={{ color: C.navy }}>{shopName}</p>
                    {shopAddress && (
                        <p className="text-xs truncate mt-0.5" style={{ color: C.gray }}>{shopAddress}</p>
                    )}
                </div>

                {/* Distance + time badge */}
                {routeInfo && !isLoadingRoute && (
                    <div
                        className="flex-shrink-0 px-2.5 py-1.5 rounded-xl text-right"
                        style={{ background: C.orangeLight }}
                    >
                        <p className="text-xs font-bold leading-none" style={{ color: C.orange }}>
                            {formatDistance(routeInfo.distance)}
                        </p>
                        <p className="text-[10px] mt-0.5" style={{ color: C.gray }}>
                            {t(`${p}.approxEta`, { time: formatTime(routeInfo.time) })}
                        </p>
                    </div>
                )}
                {isLoadingRoute && (
                    <div className="w-6 h-6 flex-shrink-0">
                        <svg className="animate-spin w-6 h-6" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke={C.orange} strokeWidth="3" />
                            <path className="opacity-75" fill={C.orange} d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                    </div>
                )}
            </div>

            {/* ── Map ──────────────────────────────────────────────────────── */}
            <div className="flex-1 relative" style={{ minHeight: 0 }}>
                <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

                {/* Route error overlay */}
                {routeError && (
                    <div
                        className="absolute top-3 left-3 right-3 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
                        style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}
                    >
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#dc2626" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                        <p className="text-xs font-medium flex-1" style={{ color: '#dc2626' }}>{routeError}</p>
                        <button
                            onClick={() => fetchRoute(vehicle)}
                            className="text-xs font-semibold underline flex-shrink-0"
                            style={{ color: '#dc2626' }}
                        >
                            {t(`${p}.retry`)}
                        </button>
                    </div>
                )}

                {/* Map legend */}
                {!isLoadingRoute && !routeError && (
                    <div
                        className="absolute top-3 left-3 flex flex-col gap-1.5 px-3 py-2 rounded-xl"
                        style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(6px)', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}
                    >
                        <div className="flex items-center gap-2">
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: C.blue, border: '2px solid white' }} />
                            <span className="text-[11px] font-medium" style={{ color: C.navy }}>{t(`${p}.yourLocation`)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: C.orange, border: '2px solid white' }} />
                            <span className="text-[11px] font-medium" style={{ color: C.navy }}>{t(`${p}.shop`)}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Bottom Panel ─────────────────────────────────────────────── */}
            <div
                className="flex-shrink-0"
                style={{ background: 'white', borderTop: `1px solid ${C.border}`, boxShadow: '0 -4px 20px rgba(0,0,0,0.08)' }}
            >
                {/* Vehicle selector */}
                <div className="flex gap-2 px-4 pt-3 pb-2">
                    {VEHICLES.map((v) => (
                        <button
                            key={v.key}
                            onClick={() => handleVehicleChange(v.key)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-[0.98]"
                            style={{
                                background: vehicle === v.key ? C.orangeLight : C.bg,
                                color: vehicle === v.key ? C.orangeDark : C.gray,
                                border: `1.5px solid ${vehicle === v.key ? C.orange : C.border}`,
                                boxShadow: vehicle === v.key ? `0 2px 10px ${C.orange}20` : 'none',
                            }}
                        >
                            {v.icon}
                            <span>{v.label}</span>
                        </button>
                    ))}
                </div>

                {/* Route summary row */}
                {routeInfo && (
                    <div className="px-4 pb-2">
                        <div
                            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl"
                            style={{ background: C.orangeLight }}
                        >
                            <div className="flex-1">
                                <p className="text-xs" style={{ color: C.gray }}>{t(`${p}.totalDistance`)}</p>
                                <p className="text-base font-bold" style={{ color: C.orange }}>
                                    {formatDistance(routeInfo.distance)}
                                </p>
                            </div>
                            <div className="w-px h-8" style={{ background: `${C.orange}30` }} />
                            <div className="flex-1">
                                <p className="text-xs" style={{ color: C.gray }}>{t(`${p}.estimatedTime`)}</p>
                                <p className="text-base font-bold" style={{ color: C.navy }}>
                                    {t(`${p}.approxEta`, { time: formatTime(routeInfo.time) })}
                                </p>
                            </div>
                            {shopPhone && (
                                <>
                                    <div className="w-px h-8" style={{ background: `${C.orange}30` }} />
                                    <a
                                        href={`tel:${shopPhone}`}
                                        className="flex flex-col items-center gap-0.5"
                                    >
                                        <div
                                            className="w-8 h-8 rounded-xl flex items-center justify-center"
                                            style={{ background: C.greenLight }}
                                        >
                                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.green} strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                            </svg>
                                        </div>
                                        <span className="text-[9px] font-medium" style={{ color: C.green }}>{t(`${p}.callBtn`)}</span>
                                    </a>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Steps toggle */}
                {routeInfo && routeInfo.steps.length > 0 && (
                    <>
                        <button
                            onClick={() => setShowSteps(p => !p)}
                            className="w-full flex items-center justify-between px-5 py-2.5"
                            style={{ borderTop: `1px solid ${C.border}` }}
                        >
                            <div className="flex items-center gap-2">
                                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.navy} strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                </svg>
                                <p className="text-xs font-semibold" style={{ color: C.navy }}>
                                    {t(`${p}.stepsToggle`, { count: routeInfo.steps.length })}
                                </p>
                            </div>
                            <svg
                                width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.gray} strokeWidth={2.5}
                                style={{ transform: showSteps ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {showSteps && (
                            <div
                                className="overflow-y-auto px-4"
                                style={{ maxHeight: '35vh', borderTop: `1px solid ${C.border}` }}
                            >
                                {routeInfo.steps.map((step, i) => (
                                    <StepItem key={i} step={step} index={i} formatDistance={formatDistance} formatTime={formatTime} />
                                ))}
                                <div className="h-4" />
                            </div>
                        )}
                    </>
                )}

                {/* Safe bottom spacing */}
                {!showSteps && <div className="h-2" />}
            </div>
        </div>
    );
}
