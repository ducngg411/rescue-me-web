'use client';

import { useState, useEffect, useCallback } from 'react';
import RouteMapSheet from './RouteMapSheet';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface NearbyShop {
    id: string;
    name: string;
    address: string;
    phone?: string;
    lat: number;
    lng: number;
    distanceKm: number;
    source: 'PLATFORM' | 'VIETMAP';
    isVerified: boolean;
    averageRating?: number;
    reviewCount?: number;
}

interface NearbyShopsSheetProps {
    isOpen: boolean;
    onClose: () => void;
    userLat?: number;
    userLng?: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const C = {
    orange: '#f97316',
    orangeLight: '#fff7ed',
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#f1f5f9',
    bg: '#f8fafc',
    green: '#16a34a',
    greenLight: '#dcfce7',
    blue: '#2563eb',
    blueLight: '#dbeafe',
    purple: '#7c3aed',
    purpleLight: '#ede9fe',
};

const RADIUS_OPTIONS = [
    { label: '1 km', value: 1 },
    { label: '2 km', value: 2 },
    { label: '5 km', value: 5 },
    { label: '10 km', value: 10 },
];

type FilterType = 'ALL' | 'PLATFORM' | 'VIETMAP';

// ─── Helper ─────────────────────────────────────────────────────────────────

// (external navigate removed — now handled by RouteMapSheet)

// ─── Sub-components ──────────────────────────────────────────────────────────

function ShopCard({ shop, onNavigate }: { shop: NearbyShop; onNavigate: (shop: NearbyShop) => void }) {
    const isPlatform = shop.source === 'PLATFORM';

    return (
        <div
            className="bg-white rounded-2xl p-4 transition-all"
            style={{
                boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
                border: isPlatform ? `1.5px solid ${C.orange}30` : `1px solid ${C.border}`,
            }}
        >
            {/* Header row */}
            <div className="flex items-start gap-3">
                {/* Icon */}
                <div
                    className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center"
                    style={{ background: isPlatform ? C.orangeLight : C.blueLight }}
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={isPlatform ? C.orange : C.blue} strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 4H4a1 1 0 00-1 1v14a1 1 0 001 1h16a1 1 0 001-1v-7" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 11l2 2L20 4" />
                        <circle cx="17" cy="8" r="4" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 8h3M17 6.5v3" />
                    </svg>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm leading-tight truncate" style={{ color: C.navy }}>
                            {shop.name}
                        </h3>
                        {isPlatform && (
                            <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                                style={{ background: C.greenLight, color: C.green }}
                            >
                                ✓ Đã xác minh
                            </span>
                        )}
                    </div>

                    <p className="text-xs mt-0.5 line-clamp-2 leading-relaxed" style={{ color: C.gray }}>
                        {shop.address || 'Địa chỉ không có sẵn'}
                    </p>

                    {/* Rating */}
                    {isPlatform && shop.averageRating != null && (
                        <div className="flex items-center gap-1 mt-1">
                            <svg width="11" height="11" viewBox="0 0 20 20" fill="#f59e0b">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            <span className="text-[11px] font-semibold" style={{ color: '#374151' }}>
                                {Number(shop.averageRating).toFixed(1)}
                            </span>
                            {shop.reviewCount != null && shop.reviewCount > 0 && (
                                <span className="text-[10px]" style={{ color: C.gray }}>
                                    ({shop.reviewCount})
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Distance badge */}
                <div className="flex-shrink-0 text-right">
                    <span
                        className="text-xs font-bold px-2 py-1 rounded-lg"
                        style={{ background: C.orangeLight, color: C.orange }}
                    >
                        {shop.distanceKm < 1
                            ? `${Math.round(shop.distanceKm * 1000)}m`
                            : `${shop.distanceKm.toFixed(1)}km`}
                    </span>
                </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
                {shop.phone && (
                    <a
                        href={`tel:${shop.phone}`}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-medium text-xs transition-all active:scale-95"
                        style={{ background: C.greenLight, color: C.green }}
                    >
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        Gọi điện
                    </a>
                )}
                <button
                    onClick={() => onNavigate(shop)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-medium text-xs transition-all active:scale-95"
                    style={{ background: C.blueLight, color: C.blue }}
                >
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    Chỉ đường
                </button>
            </div>
        </div>
    );
}

function SkeletonCard() {
    return (
        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
            <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl animate-pulse flex-shrink-0" style={{ background: C.border }} />
                <div className="flex-1 space-y-2">
                    <div className="h-4 rounded-lg animate-pulse w-2/3" style={{ background: C.border }} />
                    <div className="h-3 rounded animate-pulse w-full" style={{ background: C.border }} />
                    <div className="h-3 rounded animate-pulse w-3/4" style={{ background: C.border }} />
                </div>
                <div className="w-12 h-6 rounded-lg animate-pulse flex-shrink-0" style={{ background: C.border }} />
            </div>
            <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
                <div className="flex-1 h-8 rounded-xl animate-pulse" style={{ background: C.border }} />
                <div className="flex-1 h-8 rounded-xl animate-pulse" style={{ background: C.border }} />
            </div>
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function NearbyShopsSheet({
    isOpen,
    onClose,
    userLat: propLat,
    userLng: propLng,
}: NearbyShopsSheetProps) {
    const [shops, setShops] = useState<NearbyShop[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [radius, setRadius] = useState(2);
    const [filter, setFilter] = useState<FilterType>('ALL');
    const [hasLoaded, setHasLoaded] = useState(false);
    const [selectedShop, setSelectedShop] = useState<NearbyShop | null>(null);

    // GPS state — managed internally so we always get fresh device location
    const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [isGettingGPS, setIsGettingGPS] = useState(false);
    const [gpsError, setGpsError] = useState<string | null>(null);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

    const fetchShops = useCallback(async (lat: number, lng: number, r: number) => {
        setIsLoading(true);
        setError(null);
        console.log(`🔍 Fetching nearby shops: lat=${lat}, lng=${lng}, radius=${r}km`);
        try {
            const res = await fetch(`${API_URL}/nearby-shops?lat=${lat}&lng=${lng}&radius=${r}`);
            if (!res.ok) throw new Error('Không thể tải danh sách cửa hàng');
            const data = await res.json();
            setShops(data.shops || []);
            setHasLoaded(true);
        } catch (e: any) {
            setError(e.message || 'Có lỗi xảy ra');
        } finally {
            setIsLoading(false);
        }
    }, [API_URL]);

    // Get device GPS when sheet opens — always fresh, don't use stale props
    const getGPSAndFetch = useCallback((r: number) => {
        if (!('geolocation' in navigator)) {
            // GPS not available → fallback to props
            if (propLat && propLng) {
                setGpsCoords({ lat: propLat, lng: propLng });
                fetchShops(propLat, propLng, r);
            } else {
                setGpsError('Thiết bị không hỗ trợ GPS');
            }
            return;
        }

        setIsGettingGPS(true);
        setGpsError(null);

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                console.log(`📍 GPS obtained: lat=${lat}, lng=${lng}`);
                setGpsCoords({ lat, lng });
                setIsGettingGPS(false);
                fetchShops(lat, lng, r);
            },
            (err) => {
                console.warn('GPS error:', err.message);
                setIsGettingGPS(false);
                // Fallback to props if available
                if (propLat && propLng) {
                    console.log(`📍 Falling back to prop coords: lat=${propLat}, lng=${propLng}`);
                    setGpsCoords({ lat: propLat, lng: propLng });
                    fetchShops(propLat, propLng, r);
                } else {
                    setGpsError('Không lấy được vị trí GPS. Vui lòng bật GPS và thử lại.');
                }
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
        );
    }, [propLat, propLng, fetchShops]);

    // When sheet opens → get GPS fresh
    useEffect(() => {
        if (isOpen) {
            setShops([]);
            setHasLoaded(false);
            setError(null);
            setGpsError(null);
            getGPSAndFetch(radius);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // When radius changes (and we already have coords) → re-fetch
    useEffect(() => {
        if (isOpen && gpsCoords && hasLoaded) {
            fetchShops(gpsCoords.lat, gpsCoords.lng, radius);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [radius]);

    // Filtered list
    const filteredShops = shops.filter((s) => {
        if (filter === 'ALL') return true;
        return s.source === filter;
    });

    const platformCount = shops.filter((s) => s.source === 'PLATFORM').length;
    const vietmapCount = shops.filter((s) => s.source === 'VIETMAP').length;

    const isAnyLoading = isGettingGPS || isLoading;
    const subtitleText = isGettingGPS
        ? '📍 Đang lấy vị trí GPS...'
        : isLoading
        ? 'Đang tìm kiếm cửa hàng...'
        : hasLoaded
        ? `${shops.length} cửa hàng trong ${radius} km`
        : 'Đang khởi động...';

    if (!isOpen) return null;


    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 transition-opacity"
                style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
                onClick={onClose}
            />

            {/* Sheet */}
            <div
                className="fixed bottom-0 left-0 right-0 z-50 flex flex-col"
                style={{
                    background: C.bg,
                    borderRadius: '24px 24px 0 0',
                    maxHeight: '90vh',
                    boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
                    fontFamily: 'Lexend, sans-serif',
                }}
            >
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                    <div className="w-10 h-1 rounded-full" style={{ background: '#cbd5e1' }} />
                </div>

                {/* Header */}
                <div
                    className="flex items-center justify-between px-5 py-3 flex-shrink-0"
                    style={{ borderBottom: `1px solid ${C.border}` }}
                >
                    <div className="flex items-center gap-2.5">
                        <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center"
                            style={{ background: `linear-gradient(135deg, ${C.orange}, #ea6c0a)` }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="font-bold text-base leading-tight" style={{ color: C.navy }}>
                                Cửa hàng sửa xe gần đây
                            </h2>
                            <p className="text-xs" style={{ color: C.gray }}>
                                {subtitleText}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-slate-100"
                        style={{ color: C.gray }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Controls */}
                <div className="px-5 py-3 space-y-3 flex-shrink-0" style={{ borderBottom: `1px solid ${C.border}` }}>
                    {/* Radius selector */}
                    <div>
                        <p className="text-xs font-medium mb-2" style={{ color: C.gray }}>Bán kính tìm kiếm</p>
                        <div className="flex gap-2">
                            {RADIUS_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => setRadius(opt.value)}
                                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
                                    style={{
                                        background: radius === opt.value ? C.orange : C.border,
                                        color: radius === opt.value ? 'white' : C.gray,
                                    }}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Filter pills */}
                    <div className="flex gap-2">
                        {([
                            { key: 'ALL', label: `Tất cả (${shops.length})` },
                            { key: 'PLATFORM', label: `✓ Đã đăng ký (${platformCount})` },
                            { key: 'VIETMAP', label: `Bản đồ (${vietmapCount})` },
                        ] as Array<{ key: FilterType; label: string }>).map((f) => (
                            <button
                                key={f.key}
                                onClick={() => setFilter(f.key)}
                                className="px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap"
                                style={{
                                    background: filter === f.key ? C.navy : C.border,
                                    color: filter === f.key ? 'white' : C.gray,
                                }}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                    {/* GPS error */}
                    {gpsError && !isAnyLoading && (
                        <div className="flex flex-col items-center justify-center py-10 gap-3">
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: '#fef3c7' }}>
                                <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#d97706" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                                </svg>
                            </div>
                            <p className="font-semibold text-sm text-center px-4" style={{ color: C.navy }}>{gpsError}</p>
                            <button
                                onClick={() => getGPSAndFetch(radius)}
                                className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                                style={{ background: C.orange }}
                            >
                                Thử lại
                            </button>
                        </div>
                    )}

                    {isAnyLoading ? (
                        <>
                            <SkeletonCard />
                            <SkeletonCard />
                            <SkeletonCard />
                        </>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <div
                                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                                style={{ background: '#fee2e2', color: '#dc2626' }}
                            >
                                <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                </svg>
                            </div>
                            <p className="font-semibold text-sm" style={{ color: C.navy }}>{error}</p>
                            <button
                                onClick={() => gpsCoords && fetchShops(gpsCoords.lat, gpsCoords.lng, radius)}
                                className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                                style={{ background: C.orange }}
                            >
                                Thử lại
                            </button>
                        </div>
                    ) : filteredShops.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <div
                                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                                style={{ background: C.orangeLight }}
                            >
                                <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
                                </svg>
                            </div>
                            <p className="font-semibold text-sm" style={{ color: C.navy }}>Không tìm thấy cửa hàng nào</p>
                            <p className="text-xs text-center px-8" style={{ color: C.gray }}>
                                Thử tăng bán kính tìm kiếm để có thêm kết quả
                            </p>
                            <button
                                onClick={() => setRadius(r => Math.min(r * 2, 10))}
                                className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                                style={{ background: C.orange }}
                            >
                                Mở rộng bán kính
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Info banner */}
                            {platformCount > 0 && filter !== 'VIETMAP' && (
                                <div
                                    className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
                                    style={{ background: C.greenLight, border: `1px solid ${C.green}30` }}
                                >
                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={C.green} strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p className="text-xs font-medium" style={{ color: C.green }}>
                                        {platformCount} cửa hàng đã được xác minh trên RescueMe
                                    </p>
                                </div>
                            )}

                            {filteredShops.map((shop) => (
                                <ShopCard
                                    key={shop.id}
                                    shop={shop}
                                    onNavigate={setSelectedShop}
                                />
                            ))}

                            {/* Source note */}
                            <div className="flex items-center gap-2 py-2 px-2">
                                <div className="flex-1 h-px" style={{ background: C.border }} />
                                <p className="text-[10px] text-center px-2 whitespace-nowrap" style={{ color: C.gray }}>
                                    Dữ liệu từ RescueMe & VietMap
                                </p>
                                <div className="flex-1 h-px" style={{ background: C.border }} />
                            </div>

                            <div className="h-6" />
                        </>
                    )}
                </div>
            </div>

            {/* Route Map Sheet — opens full-screen when "Chỉ đường" is tapped */}
            {selectedShop && gpsCoords && (
                <RouteMapSheet
                    isOpen={true}
                    onClose={() => setSelectedShop(null)}
                    userLat={gpsCoords.lat}
                    userLng={gpsCoords.lng}
                    shopLat={selectedShop.lat}
                    shopLng={selectedShop.lng}
                    shopName={selectedShop.name}
                    shopAddress={selectedShop.address}
                    shopPhone={selectedShop.phone}
                />
            )}
        </>
    );
}
