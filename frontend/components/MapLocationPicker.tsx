'use client';

/**
 * MapLocationPicker
 * -----------------
 * Bản đồ VietMap với pin CSS cố định ở tâm.
 * - Marker **không** di chuyển – bản đồ di chuyển dưới marker.
 * - Mỗi lần drag kết thúc (moveend) → reverse geocode tọa độ tâm.
 * - Nút GPS để flyTo vị trí hiện tại.
 *
 * Props:
 *   initialCenter – [lng, lat] khi mở; nên truyền vị trí hiện tại của user/entity.
 *   onLocationChange – callback khi tọa độ/địa chỉ đã xác định.
 *   height – CSS height của container (default "280px").
 *   className – class thêm cho wrapper.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { reverseGeocode } from '@/lib/vietmap';

const VIETMAP_API_KEY = process.env.NEXT_PUBLIC_VIETMAP_API_KEY;
const HN_DEFAULT: [number, number] = [105.8342, 21.0278]; // [lng, lat]

// ── singleton script loader ──────────────────────────────────────────────────
let _scriptLoaded = false;
let _loadPromise: Promise<void> | null = null;

function loadVietMapOnce(): Promise<void> {
    if (_scriptLoaded && (window as any).vietmapgl) return Promise.resolve();
    if (_loadPromise) return _loadPromise;

    _loadPromise = new Promise((resolve, reject) => {
        if ((window as any).vietmapgl) {
            _scriptLoaded = true;
            resolve();
            return;
        }

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/@vietmap/vietmap-gl-js@6.0.0/dist/vietmap-gl.css';
        document.head.appendChild(link);

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@vietmap/vietmap-gl-js@6.0.0/dist/vietmap-gl.js';
        script.async = true;
        script.onload = () => { _scriptLoaded = true; resolve(); };
        script.onerror = () => { _loadPromise = null; reject(new Error('VietMap load failed')); };
        document.head.appendChild(script);
    });

    return _loadPromise;
}

// ── types ────────────────────────────────────────────────────────────────────
export interface MapLocationData {
    addressText: string;
    lat: number;
    lng: number;
}

interface MapLocationPickerProps {
    /** [lng, lat] – vị trí khởi đầu (nên là vị trí hiện tại của user) */
    initialCenter?: [number, number];
    /** Callback khi đã resolve địa chỉ */
    onLocationChange: (data: MapLocationData) => void;
    /** CSS height của map (default "280px") */
    height?: string;
    className?: string;
}

// ── component ────────────────────────────────────────────────────────────────
export default function MapLocationPicker({
    initialCenter,
    onLocationChange,
    height = '280px',
    className = '',
}: MapLocationPickerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [isScriptReady, setIsScriptReady] = useState(_scriptLoaded);
    const [isResolving, setIsResolving] = useState(false);
    const [resolvedAddress, setResolvedAddress] = useState<string>('');
    const [resolvedCoords, setResolvedCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [isGettingGps, setIsGettingGps] = useState(false);

    // Load script
    useEffect(() => {
        loadVietMapOnce()
            .then(() => setIsScriptReady(true))
            .catch(console.error);
    }, []);

    // ── reverse-geocode helper ───────────────────────────────────────────────
    const resolveCenter = useCallback(async (lng: number, lat: number) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(async () => {
            setIsResolving(true);
            try {
                const address = await reverseGeocode(lat, lng);
                setResolvedAddress(address);
                setResolvedCoords({ lat, lng });
                onLocationChange({ addressText: address, lat, lng });
            } finally {
                setIsResolving(false);
            }
        }, 600);
    }, [onLocationChange]);

    // ── init map ─────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!isScriptReady || !containerRef.current || mapRef.current) return;

        const center = initialCenter ?? HN_DEFAULT;

        const map = new (window as any).vietmapgl.Map({
            container: containerRef.current,
            style: `https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=${VIETMAP_API_KEY}`,
            center,
            zoom: 15,
            attributionControl: false,
        });
        mapRef.current = map;

        // Navigation control (zoom +/-)
        map.addControl(new (window as any).vietmapgl.NavigationControl({ showCompass: false }), 'top-right');

        // Resolve initial center immediately after map loads
        map.on('load', () => {
            const c = map.getCenter();
            resolveCenter(c.lng, c.lat);
        });

        // Resolve every time drag/zoom ends
        map.on('moveend', () => {
            const c = map.getCenter();
            resolveCenter(c.lng, c.lat);
        });

        // Cleanup
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            const suppressAbort = (e: PromiseRejectionEvent) => {
                if (e.reason?.name === 'AbortError') e.preventDefault();
            };
            window.addEventListener('unhandledrejection', suppressAbort);
            try { map.remove(); } catch { /* ignore */ }
            setTimeout(() => window.removeEventListener('unhandledrejection', suppressAbort), 500);
            mapRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isScriptReady]);

    // ── GPS button ───────────────────────────────────────────────────────────
    const handleGps = useCallback(() => {
        if (!navigator.geolocation || !mapRef.current) return;
        setIsGettingGps(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                mapRef.current.flyTo({
                    center: [pos.coords.longitude, pos.coords.latitude],
                    zoom: 16,
                    duration: 800,
                });
                setIsGettingGps(false);
            },
            () => setIsGettingGps(false),
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
        );
    }, []);

    // ── render ───────────────────────────────────────────────────────────────
    return (
        <div
            className={`relative overflow-hidden rounded-xl ${className}`}
            style={{ height, userSelect: 'none' }}
        >
            {/* ── Map tile ── */}
            {!isScriptReady ? (
                <div
                    className="w-full h-full flex items-center justify-center gap-2"
                    style={{ background: '#f1f5f9' }}
                >
                    <div
                        className="animate-spin rounded-full h-6 w-6 border-2"
                        style={{ borderColor: '#f97316', borderTopColor: 'transparent' }}
                    />
                    <span className="text-xs text-gray-500">Đang tải bản đồ…</span>
                </div>
            ) : (
                <div ref={containerRef} className="w-full h-full" />
            )}

            {/* ── Fixed center pin (pointer-events: none – không block drag) ── */}
            <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{ zIndex: 10 }}
            >
                {/* Drop shadow dưới pin */}
                <div
                    style={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: 'rgba(0,0,0,0.18)',
                        filter: 'blur(3px)',
                        transform: 'translateY(18px) scaleX(1.3)',
                        position: 'absolute',
                    }}
                />
                {/* Pin SVG */}
                <svg
                    width="36"
                    height="46"
                    viewBox="0 0 36 46"
                    fill="none"
                    style={{ transform: 'translateY(-18px)', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.30))' }}
                >
                    <path
                        d="M18 0C8.06 0 0 8.06 0 18c0 12.67 16.2 27.16 17.1 27.95a1.27 1.27 0 001.8 0C19.8 45.16 36 30.67 36 18 36 8.06 27.94 0 18 0z"
                        fill="#f97316"
                    />
                    <circle cx="18" cy="18" r="7" fill="white" />
                    <circle cx="18" cy="18" r="4" fill="#f97316" />
                </svg>
            </div>

            {/* ── GPS button ── */}
            {isScriptReady && (
                <button
                    type="button"
                    onClick={handleGps}
                    disabled={isGettingGps}
                    title="Dùng vị trí hiện tại"
                    className="absolute left-3 bottom-16 z-10 w-9 h-9 rounded-xl flex items-center justify-center shadow-md transition-all active:scale-95 disabled:opacity-60"
                    style={{ background: 'white', border: '1.5px solid #e5e7eb' }}
                >
                    {isGettingGps ? (
                        <div
                            className="animate-spin rounded-full border-2"
                            style={{ width: 16, height: 16, borderColor: '#f97316', borderTopColor: 'transparent' }}
                        />
                    ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth={2}>
                            <circle cx="12" cy="12" r="3" />
                            <path strokeLinecap="round" d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                            <path strokeLinecap="round" d="M12 2v3" />
                        </svg>
                    )}
                </button>
            )}

            {/* ── Address overlay (bottom) ── */}
            {isScriptReady && (
                <div
                    className="absolute bottom-0 left-0 right-0 z-10 px-3 py-2.5 flex items-center gap-2"
                    style={{ background: 'rgba(255,255,255,0.96)', borderTop: '1px solid #f1f5f9' }}
                >
                    <div
                        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: '#fff7ed' }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#f97316">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                        </svg>
                    </div>

                    <div className="flex-1 min-w-0">
                        {isResolving ? (
                            <div className="flex items-center gap-2">
                                <div
                                    className="animate-spin rounded-full border-2 flex-shrink-0"
                                    style={{ width: 12, height: 12, borderColor: '#f97316', borderTopColor: 'transparent' }}
                                />
                                <span className="text-xs text-gray-400">Đang xác định địa chỉ…</span>
                            </div>
                        ) : resolvedAddress ? (
                            <p className="text-xs font-medium leading-snug truncate" style={{ color: '#1a1a2e' }}>
                                {resolvedAddress}
                            </p>
                        ) : (
                            <p className="text-xs text-gray-400">Kéo bản đồ để chọn vị trí</p>
                        )}
                        {resolvedCoords && (
                            <p className="text-[10px] mt-0.5" style={{ color: '#f97316' }}>
                                {resolvedCoords.lat.toFixed(6)}, {resolvedCoords.lng.toFixed(6)}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* ── Drag hint (chỉ hiện lần đầu, fade out sau 2s) ── */}
            {isScriptReady && <DragHint />}
        </div>
    );
}

/** Gợi ý nhỏ "Kéo bản đồ để điều chỉnh" – tự ẩn sau 2.5 giây */
function DragHint() {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const t = setTimeout(() => setVisible(false), 2500);
        return () => clearTimeout(t);
    }, []);

    return (
        <div
            className="absolute top-3 left-0 right-0 flex justify-center pointer-events-none z-10"
            style={{
                opacity: visible ? 1 : 0,
                transition: 'opacity 0.6s ease',
            }}
        >
            <div
                className="px-3 py-1.5 rounded-full text-xs font-medium shadow"
                style={{ background: 'rgba(0,0,0,0.65)', color: 'white' }}
            >
                🖐 Kéo bản đồ để điều chỉnh vị trí
            </div>
        </div>
    );
}
