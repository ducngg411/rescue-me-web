'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import api from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

const VIETMAP_API_KEY = process.env.NEXT_PUBLIC_VIETMAP_API_KEY;

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
    orange: '#f97316',
    orangeDark: '#ea6c0a',
    orangeLight: '#fff7ed',
    navy: '#1a1a2e',
    gray: '#6b7280',
    grayLight: '#94a3b8',
    border: '#e2e8f0',
    bg: '#f4f6f9',
    white: '#ffffff',
};

// ─── Incident type colors (labels via i18n `provider.incidents.*`) ───────────
export const INCIDENT_TYPE_COLORS: Record<string, string> = {
    BREAKDOWN: '#ef4444',
    ACCIDENT: '#f97316',
    FLAT_TIRE: '#eab308',
    BATTERY_DEAD: '#3b82f6',
    OUT_OF_FUEL: '#a855f7',
    LOCKED_OUT: '#22c55e',
    OTHER: '#6b7280',
};

const REQUEST_STATUS_STYLES: Record<string, { color: string }> = {
    COMPLETED: { color: '#16a34a' },
    CANCELLED: { color: '#ef4444' },
};

type MapMode = 'normal' | 'heatmap';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface IncidentPoint {
    id: string;
    incidentType: string;
    status: string;
    createdAt: string;
    lat: number;
    lng: number;
    addressText?: string;
}

interface IncidentMapProps {
    apiEndpoint: string;
    title?: string;
    className?: string;
    /** Parent page shows app header; only stats + map mode row here */
    compactToolbar?: boolean;
}

// ─── Script Loader (cùng pattern với VietMap.tsx) ─────────────────────────────
let _scriptLoaded = false;
let _loadPromise: Promise<void> | null = null;

const loadVietMapScript = (): Promise<void> => {
    if (_scriptLoaded && window.vietmapgl) return Promise.resolve();
    if (_loadPromise) return _loadPromise;

    _loadPromise = new Promise((resolve, reject) => {
        if (window.vietmapgl) { _scriptLoaded = true; resolve(); return; }

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
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function IncidentMap({ apiEndpoint, title, className = '', compactToolbar = false }: IncidentMapProps) {
    const { t, locale } = useLanguage();
    const timeLocale = locale === 'vi' ? 'vi-VN' : 'en-US';
    const displayTitle = title ?? t('user.incidentMap.mapTitle');

    const incidentTypeLabel = useCallback(
        (type: string) => {
            const key = `provider.incidents.${type}`;
            const label = t(key);
            return label === key ? type : label;
        },
        [t],
    );

    const requestStatusLabel = useCallback(
        (status: string) => {
            const key = `user.incidentMap.requestStatus.${status}`;
            const label = t(key);
            return label === key ? status : label;
        },
        [t],
    );

    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]);
    const popupRef = useRef<any>(null);

    const [isScriptLoaded, setIsScriptLoaded] = useState(_scriptLoaded);
    const [isMapReady, setIsMapReady] = useState(false);
    const [points, setPoints] = useState<IncidentPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mapMode, setMapMode] = useState<MapMode>('normal');
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    // ── Fetch data ────────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get(apiEndpoint);
            setPoints(res.data || []);
        } catch {
            setError(t('user.incidentMap.errorLoadData'));
        } finally {
            setLoading(false);
        }
    }, [apiEndpoint]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Load VietMap script ────────────────────────────────────────────────────
    useEffect(() => {
        loadVietMapScript()
            .then(() => setIsScriptLoaded(true))
            .catch(() => setError(t('user.incidentMap.errorScript')));
    }, [t]);

    // ── Init map (cùng pattern với VietMap.tsx) ───────────────────────────────
    useEffect(() => {
        if (!isScriptLoaded || !mapContainer.current || isMapReady) return;
        if (!window.vietmapgl) return;

        // Cleanup nếu có instance cũ
        if (mapRef.current) {
            try { mapRef.current.remove(); } catch {}
            mapRef.current = null;
        }

        const mapInstance = new window.vietmapgl.Map({
            container: mapContainer.current,
            style: `https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=${VIETMAP_API_KEY}`,
            center: [105.8342, 21.0278], // Hà Nội
            zoom: 10,
        });

        mapInstance.addControl(new window.vietmapgl.NavigationControl(), 'top-right');

        mapInstance.on('load', () => {
            setIsMapReady(true);
        });

        mapRef.current = mapInstance;

        // Cleanup khi unmount (cùng pattern VietMap.tsx)
        return () => {
            // Clear markers
            markersRef.current.forEach(m => { try { m.remove(); } catch {} });
            markersRef.current = [];

            const inst = mapRef.current;
            mapRef.current = null;
            setIsMapReady(false);

            if (inst) {
                const suppressAbort = (e: PromiseRejectionEvent) => {
                    if (e.reason?.name === 'AbortError') e.preventDefault();
                };
                window.addEventListener('unhandledrejection', suppressAbort);
                try { inst.remove(); } catch {}
                setTimeout(() => window.removeEventListener('unhandledrejection', suppressAbort), 500);
            }
        };
    }, [isScriptLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Filtered points ───────────────────────────────────────────────────────
    const filteredPoints = selectedType
        ? points.filter(p => p.incidentType === selectedType)
        : points;

    // ── Render markers / heatmap khi map ready + data thay đổi ────────────────
    useEffect(() => {
        if (!isMapReady || !mapRef.current || !window.vietmapgl) return;
        const map = mapRef.current;
        const vgl = window.vietmapgl;

        // Clear cũ
        markersRef.current.forEach(m => { try { m.remove(); } catch {} });
        markersRef.current = [];
        if (popupRef.current) { try { popupRef.current.remove(); } catch {} popupRef.current = null; }

        // Clear heatmap layer/source
        try {
            if (map.getLayer('incident-heatmap')) map.removeLayer('incident-heatmap');
            if (map.getSource('incident-source')) map.removeSource('incident-source');
        } catch {}

        if (mapMode === 'heatmap') {
            // ── Heatmap Layer ──
            try {
                map.addSource('incident-source', {
                    type: 'geojson',
                    data: {
                        type: 'FeatureCollection',
                        features: filteredPoints.map(p => ({
                            type: 'Feature',
                            geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
                            properties: {},
                        })),
                    },
                });
                map.addLayer({
                    id: 'incident-heatmap',
                    type: 'heatmap',
                    source: 'incident-source',
                    paint: {
                        'heatmap-weight': 1,
                        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 12, 3],
                        'heatmap-color': [
                            'interpolate', ['linear'], ['heatmap-density'],
                            0, 'rgba(33,102,172,0)',
                            0.2, 'rgba(103,169,207,1)',
                            0.4, 'rgba(209,229,240,1)',
                            0.6, 'rgba(253,219,199,1)',
                            0.8, 'rgba(239,138,98,1)',
                            1, 'rgba(249,115,22,1)',
                        ],
                        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 12, 12, 40],
                        'heatmap-opacity': 0.85,
                    },
                });
            } catch (e) {
                console.warn('[IncidentMap] heatmap layer error:', e);
            }
        } else {
            // ── Markers ──
            filteredPoints.forEach(p => {
                const typeColor = INCIDENT_TYPE_COLORS[p.incidentType] || INCIDENT_TYPE_COLORS.OTHER;
                const statusStyle = REQUEST_STATUS_STYLES[p.status] || { color: '#6b7280' };
                const typeLabel = incidentTypeLabel(p.incidentType);
                const statusL = requestStatusLabel(p.status);

                const el = document.createElement('div');
                el.style.width = '22px';
                el.style.height = '22px';
                el.style.borderRadius = '50%';
                el.style.background = typeColor;
                el.style.border = '2.5px solid white';
                el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.28)';
                el.style.cursor = 'pointer';
                el.style.transition = 'transform 0.15s ease';
                el.onmouseenter = () => { el.style.transform = 'scale(1.35)'; };
                el.onmouseleave = () => { el.style.transform = 'scale(1)'; };

                const marker = new vgl.Marker({ element: el })
                    .setLngLat([p.lng, p.lat])
                    .addTo(map);

                const date = new Date(p.createdAt).toLocaleDateString(timeLocale);

                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (popupRef.current) { try { popupRef.current.remove(); } catch {} }

                    const popupStatus = t('user.incidentMap.popupStatus');
                    const popupDate = t('user.incidentMap.popupDate');

                    const popup = new vgl.Popup({
                        closeButton: true,
                        closeOnClick: false,
                        offset: 16,
                        maxWidth: '260px',
                    })
                        .setLngLat([p.lng, p.lat])
                        .setHTML(`
                            <div style="font-family:Lexend,sans-serif;padding:4px 2px;">
                                <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
                                    <span style="width:10px;height:10px;border-radius:50%;background:${typeColor};display:inline-block;flex-shrink:0;"></span>
                                    <span style="font-size:13px;font-weight:700;color:#1a1a2e;">${typeLabel}</span>
                                </div>
                                <div style="font-size:11px;color:#6b7280;margin-bottom:3px;">${popupStatus} <span style="color:${statusStyle.color};font-weight:600;">${statusL}</span></div>
                                <div style="font-size:11px;color:#6b7280;">${popupDate} <span style="color:#1a1a2e;">${date}</span></div>
                                ${p.addressText ? `<div style="font-size:11px;color:#6b7280;margin-top:4px;word-break:break-word;">📍 ${p.addressText}</div>` : ''}
                            </div>
                        `)
                        .addTo(map);

                    popupRef.current = popup;
                });

                markersRef.current.push(marker);
            });
        }
    }, [isMapReady, filteredPoints, mapMode, t, timeLocale, incidentTypeLabel, requestStatusLabel]);

    const statsPerType = Object.keys(INCIDENT_TYPE_COLORS).map(type => ({
        type,
        count: points.filter(p => p.incidentType === type).length,
    })).filter(s => s.count > 0);

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div
            className={className}
            style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'Lexend,sans-serif', background: C.bg }}
        >
            {/* ── Toolbar (full title vs compact when shell has app header) ── */}
            <div
                style={{
                    flexShrink: 0,
                    background: C.white,
                    borderBottom: `1px solid ${C.border}`,
                    padding: compactToolbar ? '8px 16px' : '12px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px',
                }}
            >
                {compactToolbar ? (
                    <p style={{ margin: 0, fontSize: '12px', color: C.gray, fontWeight: 500 }}>
                        {loading
                            ? t('user.incidentMap.loadingShort')
                            : t('user.incidentMap.statsLine', { total: String(points.length), filtered: String(filteredPoints.length) })}
                    </p>
                ) : (
                    <div>
                        <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: C.navy }}>{displayTitle}</h1>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: C.gray }}>
                            {loading
                                ? t('user.incidentMap.loadingShort')
                                : t('user.incidentMap.statsLine', { total: String(points.length), filtered: String(filteredPoints.length) })}
                        </p>
                    </div>
                )}

                {/* Mode switcher */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '4px' }}>
                    {(['normal', 'heatmap'] as MapMode[]).map(mode => (
                        <button
                            key={mode}
                            onClick={() => setMapMode(mode)}
                            style={{
                                padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                                background: mapMode === mode ? C.orange : 'transparent',
                                color: mapMode === mode ? C.white : C.gray,
                                boxShadow: mapMode === mode ? '0 2px 6px rgba(249,115,22,0.3)' : 'none',
                            }}
                        >
                            {mode === 'normal' ? t('user.incidentMap.modeNormal') : t('user.incidentMap.modeHeatmap')}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Body ── */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

                {/* ── Sidebar legend (desktop) ── */}
                <div style={{ width: '200px', flexShrink: 0, background: C.white, borderRight: `1px solid ${C.border}`, overflowY: 'auto', flexDirection: 'column' }} className="hidden md:flex">
                    <div style={{ padding: '16px 12px' }}>
                        <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.grayLight, margin: '0 0 10px' }}>{t('user.incidentMap.sectionIncidentTypes')}</p>

                        {/* All */}
                        <button
                            onClick={() => setSelectedType(null)}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '7px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer', marginBottom: '2px',
                                background: selectedType === null ? C.orangeLight : 'transparent',
                                color: selectedType === null ? C.orange : C.gray,
                                fontSize: '12px', fontWeight: 500, textAlign: 'left',
                            }}
                        >
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#94a3b8', flexShrink: 0 }} />
                            <span style={{ flex: 1 }}>{t('user.incidentMap.allTypes')}</span>
                            <span style={{ fontWeight: 700, color: C.navy }}>{points.length}</span>
                        </button>

                        {Object.entries(INCIDENT_TYPE_COLORS).map(([type, color]) => {
                            const count = points.filter(p => p.incidentType === type).length;
                            const active = selectedType === type;
                            return (
                                <button
                                    key={type}
                                    onClick={() => setSelectedType(active ? null : type)}
                                    style={{
                                        width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                                        padding: '7px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer', marginBottom: '2px',
                                        background: active ? `${color}18` : 'transparent',
                                        color: active ? color : C.gray,
                                        fontSize: '12px', fontWeight: 500, textAlign: 'left',
                                    }}
                                >
                                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{incidentTypeLabel(type)}</span>
                                    <span style={{ fontWeight: 700, color: count > 0 ? C.navy : C.grayLight }}>{count}</span>
                                </button>
                            );
                        })}

                        {/* Status */}
                        <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.grayLight, margin: '16px 0 8px', paddingTop: '12px', borderTop: `1px solid ${C.border}` }}>{t('user.incidentMap.sectionStatus')}</p>
                        {Object.entries(REQUEST_STATUS_STYLES).map(([status, info]) => (
                            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: info.color, flexShrink: 0 }} />
                                <span style={{ flex: 1, fontSize: '12px', color: C.gray }}>{requestStatusLabel(status)}</span>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: C.navy }}>{points.filter(p => p.status === status).length}</span>
                            </div>
                        ))}

                        {/* Refresh */}
                        <button
                            onClick={fetchData}
                            disabled={loading}
                            style={{
                                width: '100%', marginTop: '16px', padding: '8px', borderRadius: '8px',
                                border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                                background: C.orangeLight, color: C.orange, fontSize: '12px', fontWeight: 600,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            }}
                        >
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            {t('user.incidentMap.refresh')}
                        </button>
                    </div>
                </div>

                {/* ── Mobile Sidebar Drawer ── */}
                {isMobileSidebarOpen && (
                    <div
                        className="md:hidden"
                        style={{ position: 'absolute', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.4)' }}
                        onClick={() => setIsMobileSidebarOpen(false)}
                    />
                )}
                <div
                    className="md:hidden"
                    style={{
                        position: 'absolute', top: 0, left: 0, bottom: 0, zIndex: 50,
                        width: '220px', background: C.white, boxShadow: '4px 0 24px rgba(0,0,0,0.15)',
                        overflowY: 'auto', flexDirection: 'column', display: 'flex',
                        transform: isMobileSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
                        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: `1px solid ${C.border}` }}>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: C.navy }}>{t('user.incidentMap.mobileFilterTitle')}</p>
                        <button
                            onClick={() => setIsMobileSidebarOpen(false)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.gray, padding: '2px', lineHeight: 1 }}
                            aria-label={t('user.incidentMap.closeFilterAria')}
                        >
                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <div style={{ padding: '14px 12px', flex: 1 }}>
                        <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.grayLight, margin: '0 0 10px' }}>{t('user.incidentMap.sectionIncidentTypes')}</p>
                        <button
                            onClick={() => setSelectedType(null)}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer', marginBottom: '2px', background: selectedType === null ? C.orangeLight : 'transparent', color: selectedType === null ? C.orange : C.gray, fontSize: '12px', fontWeight: 500, textAlign: 'left' }}
                        >
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#94a3b8', flexShrink: 0 }} />
                            <span style={{ flex: 1 }}>{t('user.incidentMap.allTypes')}</span>
                            <span style={{ fontWeight: 700, color: C.navy }}>{points.length}</span>
                        </button>
                        {Object.entries(INCIDENT_TYPE_COLORS).map(([type, color]) => {
                            const count = points.filter(p => p.incidentType === type).length;
                            const active = selectedType === type;
                            return (
                                <button
                                    key={type}
                                    onClick={() => { setSelectedType(active ? null : type); }}
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer', marginBottom: '2px', background: active ? `${color}18` : 'transparent', color: active ? color : C.gray, fontSize: '12px', fontWeight: 500, textAlign: 'left' }}
                                >
                                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{incidentTypeLabel(type)}</span>
                                    <span style={{ fontWeight: 700, color: count > 0 ? C.navy : C.grayLight }}>{count}</span>
                                </button>
                            );
                        })}
                        <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.grayLight, margin: '16px 0 8px', paddingTop: '12px', borderTop: `1px solid ${C.border}` }}>{t('user.incidentMap.sectionStatus')}</p>
                        {Object.entries(REQUEST_STATUS_STYLES).map(([status, info]) => (
                            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: info.color, flexShrink: 0 }} />
                                <span style={{ flex: 1, fontSize: '12px', color: C.gray }}>{requestStatusLabel(status)}</span>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: C.navy }}>{points.filter(p => p.status === status).length}</span>
                            </div>
                        ))}
                        <button
                            onClick={() => { fetchData(); }}
                            disabled={loading}
                            style={{ width: '100%', marginTop: '16px', padding: '8px', borderRadius: '8px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: C.orangeLight, color: C.orange, fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            {t('user.incidentMap.refresh')}
                        </button>
                    </div>
                </div>

                {/* ── Map area ── */}
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

                    {/* Mobile filter chips */}
                    <div className="md:hidden flex" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, gap: '6px', padding: '8px 10px', overflowX: 'auto', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', borderBottom: `1px solid ${C.border}` }}>
                        <button onClick={() => setSelectedType(null)} style={{ flexShrink: 0, padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, border: `1px solid ${selectedType === null ? C.orange : C.border}`, background: selectedType === null ? C.orange : C.white, color: selectedType === null ? C.white : C.gray, cursor: 'pointer' }}>
                            {t('user.incidentMap.allTypes')} ({points.length})
                        </button>
                        {statsPerType.map(({ type, count }) => {
                            const color = INCIDENT_TYPE_COLORS[type] || INCIDENT_TYPE_COLORS.OTHER;
                            const active = selectedType === type;
                            return (
                                <button key={type} onClick={() => setSelectedType(active ? null : type)} style={{ flexShrink: 0, padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, border: `1px solid ${active ? color : C.border}`, background: active ? color : C.white, color: active ? C.white : C.gray, cursor: 'pointer' }}>
                                    {incidentTypeLabel(type)} ({count})
                                </button>
                            );
                        })}
                    </div>

                    {/* Loading overlay */}
                    {!isScriptLoaded && (
                        <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', background: C.bg }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: `3px solid ${C.orange}`, borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
                            <p style={{ fontSize: '13px', color: C.gray, margin: 0 }}>{t('user.incidentMap.loadingMap')}</p>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div style={{ position: 'absolute', top: '60px', left: '50%', transform: 'translateX(-50%)', zIndex: 20, padding: '8px 16px', borderRadius: '12px', background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', fontSize: '12px', fontWeight: 500 }}>
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Empty state */}
                    {!loading && !error && filteredPoints.length === 0 && isMapReady && (
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 5, padding: '20px 28px', borderRadius: '16px', background: C.white, boxShadow: '0 4px 24px rgba(0,0,0,0.1)', textAlign: 'center', pointerEvents: 'none' }}>
                            <p style={{ fontSize: '24px', margin: '0 0 6px' }}>🗺️</p>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: C.navy, margin: '0 0 4px' }}>{t('user.incidentMap.emptyTitle')}</p>
                            <p style={{ fontSize: '12px', color: C.gray, margin: 0 }}>{selectedType ? t('user.incidentMap.emptyHintFiltered') : t('user.incidentMap.emptyHintAll')}</p>
                        </div>
                    )}

                    {/* Mobile: sticky filter toggle button */}
                    <button
                        className="md:hidden"
                        onClick={() => setIsMobileSidebarOpen(true)}
                        style={{
                            position: 'absolute', bottom: '80px', left: '12px', zIndex: 30,
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '8px 14px', borderRadius: '24px',
                            background: C.orange, color: C.white,
                            border: 'none', cursor: 'pointer',
                            fontSize: '12px', fontWeight: 700,
                            boxShadow: '0 4px 16px rgba(249,115,22,0.45)',
                        }}
                        aria-label={t('user.incidentMap.openFilterAria')}
                    >
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 12h10M11 20h2" />
                        </svg>
                        {t('user.incidentMap.filterBtn')}{selectedType ? ' ●' : ''}
                    </button>

                    {/* Heatmap legend */}
                    {mapMode === 'heatmap' && isMapReady && (
                        <div style={{ position: 'absolute', bottom: '16px', right: '16px', zIndex: 10, padding: '8px 12px', borderRadius: '12px', background: C.white, border: `1px solid ${C.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                            <p style={{ fontSize: '10px', fontWeight: 600, color: C.gray, margin: '0 0 6px' }}>{t('user.incidentMap.heatmapDensity')}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '9px', color: C.gray }}>{t('user.incidentMap.heatmapLow')}</span>
                                <div style={{ width: '72px', height: '8px', borderRadius: '4px', background: 'linear-gradient(to right,rgba(103,169,207,1),rgba(253,219,199,1),rgba(249,115,22,1))' }} />
                                <span style={{ fontSize: '9px', color: C.gray }}>{t('user.incidentMap.heatmapHigh')}</span>
                            </div>
                        </div>
                    )}

                    {/* ══ MAP CONTAINER — must have explicit width+height ══ */}
                    <div
                        ref={mapContainer}
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
                    />
                </div>
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
