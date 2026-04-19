'use client';

import { useState, useEffect } from 'react';
import { searchPlaces, getPlaceDetails, PlaceSearchResult } from '@/lib/vietmap';
import { MagnifyingGlassIcon, MapPinIcon } from '@heroicons/react/24/outline';
import dynamic from 'next/dynamic';
import { useLanguage } from '@/contexts/LanguageContext';
import type { MapLocationData } from '@/components/MapLocationPicker';

// Lazy-load map component (uses browser APIs)
const MapLocationPicker = dynamic(() => import('@/components/MapLocationPicker'), { ssr: false });

interface LocationData {
    addressText: string;
    lat: number;
    lng: number;
}

interface LocationPickerProps {
    label: string;
    value: LocationData | null;
    onChange: (location: LocationData) => void;
    placeholder?: string;
    required?: boolean;
    /** Align focus/selected colors with rescue flow (orange/navy) instead of default blue/green. */
    variant?: 'default' | 'rescue';
    /**
     * Vị trí khởi đầu cho map tab (nên là GPS hiện tại hoặc địa chỉ đã có).
     * Nếu không truyền, MapLocationPicker tự fallback Hà Nội.
     */
    mapInitialCenter?: [number, number]; // [lng, lat]
    /** Chế độ mặc định khi mở: 'search' | 'map'. Default: 'search' */
    defaultMode?: 'search' | 'map';
    /** Callback khi user chuyển tab */
    onModeChange?: (mode: 'search' | 'map') => void;
}

export default function LocationPicker({
    label,
    value,
    onChange,
    placeholder,
    required = false,
    variant = 'default',
    mapInitialCenter,
    defaultMode = 'search',
    onModeChange,
}: LocationPickerProps) {
    const { t } = useLanguage();
    const [mode, setMode] = useState<'search' | 'map'>(defaultMode);
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [selectedPlace, setSelectedPlace] = useState<LocationData | null>(value);
    const [isSelecting, setIsSelecting] = useState(false);

    // Sync selectedPlace when value prop changes from parent
    useEffect(() => {
        setSelectedPlace(value);
        if (value) setQuery('');
    }, [value]);

    // ── Search mode: debounce ──────────────────────────────────────────────
    useEffect(() => {
        if (mode !== 'search') return;
        if (isSelecting) return;
        if (!query.trim()) {
            setSearchResults([]);
            setShowResults(false);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            const results = await searchPlaces(query);
            setSearchResults(results);
            setIsSearching(false);
            setShowResults(true);
        }, 500);

        return () => clearTimeout(timer);
    }, [query, isSelecting, mode]);

    const handleSelectPlace = async (result: PlaceSearchResult) => {
        setIsSelecting(true);
        if (result.refId) {
            const details = await getPlaceDetails(result.refId);
            if (details) {
                const locationData: LocationData = {
                    addressText: details.display || details.address,
                    lat: details.lat,
                    lng: details.lng,
                };
                setSelectedPlace(locationData);
                onChange(locationData);
                setQuery('');
                setShowResults(false);
                setSearchResults([]);
            }
        }
        setIsSelecting(false);
    };

    // ── Map mode: live update from map center ──────────────────────────────
    const handleMapLocationChange = (data: MapLocationData) => {
        const loc: LocationData = { addressText: data.addressText, lat: data.lat, lng: data.lng };
        setSelectedPlace(loc);
        onChange(loc);
    };

    // Map starting point: explicit prop → existing value → MapLocationPicker handles GPS internally
    const resolvedMapCenter: [number, number] | undefined =
        mapInitialCenter ?? (value ? [value.lng, value.lat] : undefined);

    // ── Style variants ─────────────────────────────────────────────────────
    const isOrange = variant === 'rescue';
    const tabActiveBg = isOrange ? '#fff7ed' : '#eff6ff';
    const tabActiveColor = isOrange ? '#f97316' : '#2563eb';
    const inputFocusClass = isOrange
        ? 'focus:ring-2 focus:ring-orange-500 focus:border-orange-400'
        : 'focus:ring-2 focus:ring-blue-500 focus:border-transparent';
    const hoverBg = isOrange ? 'hover:bg-orange-50' : 'hover:bg-gray-50';
    const selectedBg = isOrange ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200';
    const selectedIconColor = isOrange ? 'text-orange-600' : 'text-green-600';
    const selectedTitleColor = isOrange ? 'text-orange-950' : 'text-green-900';
    const selectedTextColor = isOrange ? 'text-slate-800' : 'text-green-700';
    const selectedCoordColor = isOrange ? 'text-orange-800' : 'text-green-600';

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
                {label} {required && <span className="text-red-500 ml-1">*</span>}
            </label>

            {/* ── Mode tabs ── */}
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #e5e7eb' }}>
                {(['search', 'map'] as const).map((m) => (
                    <button
                        key={m}
                        type="button"
                        onClick={() => { setMode(m); onModeChange?.(m); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium transition-colors"
                        style={{
                            background: mode === m ? tabActiveBg : 'white',
                            color: mode === m ? tabActiveColor : '#6b7280',
                            borderRight: m === 'search' ? '1px solid #e5e7eb' : 'none',
                        }}
                    >
                        {m === 'search' ? (
                            <>
                                <MagnifyingGlassIcon className="h-3.5 w-3.5" />
                                {t('common.search')}
                            </>
                        ) : (
                            <>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                </svg>
                                {t('common.locationPicker.mapTab')}
                            </>
                        )}
                    </button>
                ))}
            </div>

            {/* ── Search mode ── */}
            {mode === 'search' && (
                <div className="relative">
                    <div className="relative">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                if (selectedPlace && e.target.value.trim()) setSelectedPlace(null);
                            }}
                            onFocus={() => {
                                if (query.trim() && searchResults.length > 0) setShowResults(true);
                            }}
                            placeholder={placeholder || t('common.locationPicker.placeholder')}
                            className={`w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 ${inputFocusClass}`}
                        />
                        <MagnifyingGlassIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    </div>

                    {/* Search results dropdown */}
                    {showResults && searchResults.length > 0 && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {searchResults.map((result, index) => (
                                <button
                                    key={index}
                                    type="button"
                                    onClick={() => handleSelectPlace(result)}
                                    className={`w-full px-4 py-3 text-left border-b border-gray-100 last:border-b-0 ${hoverBg}`}
                                >
                                    <div className="font-medium text-gray-900 text-sm">{result.displayName}</div>
                                    <div className="text-xs text-gray-500">{result.address}</div>
                                </button>
                            ))}
                        </div>
                    )}

                    {isSearching && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500 text-sm">
                            {t('common.locationPicker.searching')}
                        </div>
                    )}
                </div>
            )}

            {/* ── Map mode ── */}
            {mode === 'map' && (
                <MapLocationPicker
                    initialCenter={resolvedMapCenter}
                    onLocationChange={handleMapLocationChange}
                    height="240px"
                    className="border border-gray-200"
                />
            )}

            {/* ── Selected location display (search mode only – map has its own overlay) ── */}
            {mode === 'search' && selectedPlace && (
                <div className={`mt-2 p-3 rounded-lg border ${selectedBg}`}>
                    <div className="flex items-start gap-2">
                        <MapPinIcon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${selectedIconColor}`} />
                        <div>
                            <div className={`text-sm font-medium ${selectedTitleColor}`}>
                                {t('common.locationPicker.selected')}
                            </div>
                            <div className={`text-sm ${selectedTextColor}`}>{selectedPlace.addressText}</div>
                            <div className={`text-xs mt-1 ${selectedCoordColor}`}>
                                {t('common.locationPicker.coordinates', {
                                    lat: selectedPlace.lat.toFixed(6),
                                    lng: selectedPlace.lng.toFixed(6),
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
