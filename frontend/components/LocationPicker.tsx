'use client';

import { useState, useEffect } from 'react';
import { searchPlaces, getPlaceDetails, PlaceSearchResult, PlaceDetails } from '@/lib/vietmap';
import { MagnifyingGlassIcon, MapPinIcon } from '@heroicons/react/24/outline';

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
}

export default function LocationPicker({
    label,
    value,
    onChange,
    placeholder = 'Nhập địa chỉ...',
    required = false,
}: LocationPickerProps) {
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [selectedPlace, setSelectedPlace] = useState<LocationData | null>(value);

    // Debounce search
    useEffect(() => {
        if (!query.trim()) {
            setSearchResults([]);
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
    }, [query]);

    const handleSelectPlace = async (result: PlaceSearchResult) => {
        if (result.refId) {
            // Fetch full details including coordinates
            const details = await getPlaceDetails(result.refId);
            if (details) {
                const locationData: LocationData = {
                    addressText: details.display || details.address,
                    lat: details.lat,
                    lng: details.lng,
                };
                setSelectedPlace(locationData);
                onChange(locationData);
                setQuery(locationData.addressText);
                setShowResults(false);
            }
        }
    };

    const handleGetCurrentLocation = () => {
        if ('geolocation' in navigator) {
            console.log('🔍 [LocationPicker] Requesting current position...');

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    console.log('✅ [LocationPicker] Position received:', {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: new Date(position.timestamp).toLocaleString('vi-VN')
                    });

                    const { latitude, longitude } = position.coords;

                    // Use reverse geocoding or just use coordinates
                    const locationData: LocationData = {
                        addressText: `Vị trí hiện tại (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`,
                        lat: latitude,
                        lng: longitude,
                    };

                    setSelectedPlace(locationData);
                    onChange(locationData);
                    // KHÔNG set query để tránh trigger search
                    setQuery('');
                    setShowResults(false);
                },
                (error) => {
                    console.error('❌ [LocationPicker] Error:', {
                        code: error.code,
                        message: error.message,
                        PERMISSION_DENIED: error.code === 1,
                        POSITION_UNAVAILABLE: error.code === 2,
                        TIMEOUT: error.code === 3
                    });
                    alert('Không thể lấy vị trí hiện tại. Vui lòng cho phép truy cập vị trí.');
                },
                {
                    enableHighAccuracy: true,  // Sử dụng GPS chính xác nhất
                    timeout: 15000,            // Timeout sau 15 giây
                    maximumAge: 0,             // KHÔNG dùng cache, luôn lấy vị trí mới
                }
            );
        } else {
            alert('Trình duyệt của bạn không hỗ trợ định vị.');
        }
    };

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
            </label>

            <div className="relative">
                <div className="relative">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={() => setShowResults(true)}
                        placeholder={placeholder}
                        className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                    />
                    <MagnifyingGlassIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                </div>

                {/* Current Location Button */}
                <button
                    type="button"
                    onClick={handleGetCurrentLocation}
                    className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                    <MapPinIcon className="h-5 w-5" />
                    Sử dụng vị trí hiện tại
                </button>

                {/* Search Results Dropdown */}
                {showResults && searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {searchResults.map((result, index) => (
                            <button
                                key={index}
                                type="button"
                                onClick={() => handleSelectPlace(result)}
                                className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                            >
                                <div className="font-medium text-gray-900">{result.displayName}</div>
                                <div className="text-sm text-gray-500">{result.address}</div>
                            </button>
                        ))}
                    </div>
                )}

                {isSearching && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500">
                        Đang tìm kiếm...
                    </div>
                )}
            </div>

            {/* Selected Location Display */}
            {selectedPlace && (
                <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start gap-2">
                        <MapPinIcon className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                            <div className="text-sm font-medium text-green-900">Địa điểm đã chọn</div>
                            <div className="text-sm text-green-700">{selectedPlace.addressText}</div>
                            <div className="text-xs text-green-600 mt-1">
                                Tọa độ: {selectedPlace.lat.toFixed(6)}, {selectedPlace.lng.toFixed(6)}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
