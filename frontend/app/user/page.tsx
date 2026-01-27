'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserGuard } from '@/lib/guards';
import dynamic from 'next/dynamic';

// Dynamic import for VietMap component (client-side only)
const VietMap = dynamic(() => import('@/components/VietMap'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
    )
});

interface LocationData {
    lat: number;
    lng: number;
    address?: string;
}

export default function UserDashboard() {
    const router = useRouter();
    const { isReady, user } = useUserGuard();
    const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
    const [isLoadingLocation, setIsLoadingLocation] = useState(true);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [recentRequests, setRecentRequests] = useState([]);

    // Default location (Hanoi, Vietnam)
    const DEFAULT_LOCATION: LocationData = {
        lat: 21.028511,
        lng: 105.804817,
        address: 'Hà Nội, Việt Nam'
    };

    // Get current location on mount
    useEffect(() => {
        if ('geolocation' in navigator) {
            console.log('🔍 [UserDashboard] Requesting current position...');
            console.log('🔍 [UserDashboard] Options:', {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0
            });

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    console.log('✅ [UserDashboard] Position received:', {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: new Date(position.timestamp).toLocaleString('vi-VN')
                    });

                    setCurrentLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    });
                    setIsLoadingLocation(false);
                    setLocationError(null);
                },
                (error) => {
                    console.error('❌ [UserDashboard] Error:', {
                        code: error.code,
                        message: error.message,
                        PERMISSION_DENIED: error.code === 1,
                        POSITION_UNAVAILABLE: error.code === 2,
                        TIMEOUT: error.code === 3
                    });

                    // Use default location when user denies permission
                    setCurrentLocation(DEFAULT_LOCATION);

                    let errorMessage = 'Không thể lấy vị trí hiện tại. Sử dụng vị trí mặc định.';
                    switch (error.code) {
                        case 1: // PERMISSION_DENIED
                            errorMessage = 'Bạn đã từ chối quyền truy cập vị trí. Sử dụng vị trí mặc định.';
                            break;
                        case 2: // POSITION_UNAVAILABLE
                            errorMessage = 'Vị trí không khả dụng. Sử dụng vị trí mặc định.';
                            break;
                        case 3: // TIMEOUT
                            errorMessage = 'Hết thời gian chờ lấy vị trí. Sử dụng vị trí mặc định.';
                            break;
                    }

                    setLocationError(errorMessage);
                    setIsLoadingLocation(false);
                },
                {
                    enableHighAccuracy: true,  // Sử dụng GPS chính xác nhất
                    timeout: 15000,            // Tăng timeout lên 15 giây
                    maximumAge: 0,             // KHÔNG dùng cache, luôn lấy vị trí mới
                }
            );
        } else {
            setCurrentLocation(DEFAULT_LOCATION);
            setLocationError('Trình duyệt không hỗ trợ định vị. Sử dụng vị trí mặc định.');
            setIsLoadingLocation(false);
        }
    }, []);

    const handleCreateRequest = () => {
        router.push('/user/create-request');
    };

    const handleViewRequests = () => {
        router.push('/user/requests');
    };

    // Show loading while guard is checking
    if (!isReady) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <h1 className="text-2xl font-bold text-gray-900">Rescue Me</h1>
                    <p className="text-sm text-gray-600 mt-1">Dịch vụ cứu hộ xe nhanh chóng</p>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                {/* Current Location Section */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Vị trí hiện tại</h2>

                    {isLoadingLocation ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <span className="ml-3 text-gray-600">Đang lấy vị trí...</span>
                        </div>
                    ) : currentLocation ? (
                        <div className="space-y-4">
                            {/* Location Error Warning */}
                            {locationError && (
                                <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <svg className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-yellow-900">{locationError}</p>
                                        <p className="text-xs text-yellow-700 mt-1">
                                            Bạn có thể cho phép truy cập vị trí trong cài đặt trình duyệt để có trải nghiệm tốt hơn.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* VietMap */}
                            <div className="w-full h-64 rounded-lg overflow-hidden">
                                <VietMap
                                    center={[currentLocation.lng, currentLocation.lat]}
                                    zoom={locationError ? 12 : 15}
                                    showMarker={true}
                                    markerPosition={[currentLocation.lng, currentLocation.lat]}
                                />
                            </div>

                            {/* Location Info */}
                            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                                <svg className="h-6 w-6 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <div>
                                    <p className="text-sm font-medium text-blue-900">
                                        {locationError ? 'Vị trí mặc định' : 'Vị trí đã xác định'}
                                    </p>
                                    <p className="text-sm text-blue-700">
                                        {currentLocation.address || `Lat: ${currentLocation.lat.toFixed(6)}, Lng: ${currentLocation.lng.toFixed(6)}`}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <p className="mt-2 text-sm text-gray-600">Không thể lấy vị trí hiện tại</p>
                            <p className="text-xs text-gray-500 mt-1">Vui lòng cho phép truy cập vị trí trong trình duyệt</p>
                        </div>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Create Rescue Request */}
                    <button
                        onClick={handleCreateRequest}
                        className="bg-gradient-to-r from-red-500 to-red-600 text-white p-6 rounded-lg shadow-lg hover:from-red-600 hover:to-red-700 transition-all transform hover:scale-105"
                    >
                        <div className="flex items-center gap-4">
                            <div className="bg-white/20 p-3 rounded-full">
                                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <div className="text-left">
                                <h3 className="text-xl font-bold">Cần cứu hộ ngay!</h3>
                                <p className="text-sm text-white/90 mt-1">Tạo yêu cầu cứu hộ khẩn cấp</p>
                            </div>
                        </div>
                    </button>

                    {/* View Requests */}
                    <button
                        onClick={handleViewRequests}
                        className="bg-white border-2 border-gray-200 p-6 rounded-lg shadow-sm hover:border-blue-500 hover:shadow-md transition-all"
                    >
                        <div className="flex items-center gap-4">
                            <div className="bg-blue-100 p-3 rounded-full">
                                <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                            </div>
                            <div className="text-left">
                                <h3 className="text-xl font-bold text-gray-900">Yêu cầu của tôi</h3>
                                <p className="text-sm text-gray-600 mt-1">Xem lịch sử và trạng thái</p>
                            </div>
                        </div>
                    </button>
                </div>

                {/* Safety Tips */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Hướng dẫn an toàn</h2>
                    <div className="space-y-3">
                        <div className="flex gap-3">
                            <div className="bg-green-100 p-2 rounded-full h-8 w-8 flex items-center justify-center flex-shrink-0">
                                <span className="text-green-600 font-bold">1</span>
                            </div>
                            <p className="text-sm text-gray-700">Bật đèn cảnh báo và đặt biển báo nếu xe dừng ven đường</p>
                        </div>
                        <div className="flex gap-3">
                            <div className="bg-green-100 p-2 rounded-full h-8 w-8 flex items-center justify-center flex-shrink-0">
                                <span className="text-green-600 font-bold">2</span>
                            </div>
                            <p className="text-sm text-gray-700">Di chuyển ra khỏi xe và đứng ở nơi an toàn</p>
                        </div>
                        <div className="flex gap-3">
                            <div className="bg-green-100 p-2 rounded-full h-8 w-8 flex items-center justify-center flex-shrink-0">
                                <span className="text-green-600 font-bold">3</span>
                            </div>
                            <p className="text-sm text-gray-700">Gọi cứu hộ và cung cấp vị trí chính xác</p>
                        </div>
                        <div className="flex gap-3">
                            <div className="bg-green-100 p-2 rounded-full h-8 w-8 flex items-center justify-center flex-shrink-0">
                                <span className="text-green-600 font-bold">4</span>
                            </div>
                            <p className="text-sm text-gray-700">Chụp ảnh tình trạng xe để gửi cho nhà cung cấp dịch vụ</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
