'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserGuard } from '@/lib/guards';
import LocationPicker from '@/components/LocationPicker';
import ImageUpload from '@/components/ImageUpload';
import VideoUpload from '@/components/VideoUpload';
import { UploadPurpose } from '@/lib/upload';
import api from '@/lib/api';
import { reverseGeocode } from '@/lib/vietmap';
import toast from 'react-hot-toast';

interface LocationData {
    addressText: string;
    lat: number;
    lng: number;
}

interface Vehicle {
    type: 'CAR' | 'MOTORCYCLE';
    licensePlate: string;
    color?: string;
}

interface UserProfile {
    fullName?: string;
    phoneNumber?: string;
    vehicleType?: 'CAR' | 'MOTORCYCLE';
    licensePlate?: string;
    vehicleColor?: string;
}

const INCIDENT_TYPES = [
    { value: 'BREAKDOWN', label: 'Hỏng xe' },
    { value: 'ACCIDENT', label: 'Tai nạn' },
    { value: 'FLAT_TIRE', label: 'Lốp xe hỏng' },
    { value: 'BATTERY_DEAD', label: 'Hết bình điện' },
    { value: 'OUT_OF_FUEL', label: 'Hết nhiên liệu' },
    { value: 'LOCKED_OUT', label: 'Khóa xe' },
    { value: 'OTHER', label: 'Khác' },
];

const VEHICLE_TYPE_LABELS: Record<string, string> = {
    CAR: 'Ô tô',
    MOTORCYCLE: 'Xe máy',
};

export default function CreateRescueRequestPage() {
    const router = useRouter();
    const { isReady, user } = useUserGuard();
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);
    const [isLoadingLocation, setIsLoadingLocation] = useState(false);
    const [locationTimestamp, setLocationTimestamp] = useState<Date | null>(null);
    const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [showAddVehicle, setShowAddVehicle] = useState(false);
    const [newVehicle, setNewVehicle] = useState({ type: 'CAR' as 'CAR' | 'MOTORCYCLE', licensePlate: '', color: '' });

    const [formData, setFormData] = useState({
        incidentType: '',
        vehicleIndex: 0, // Index in vehicles array
        incidentLocation: null as LocationData | null,
        contactPhone: '',
        description: '',
        images: [] as Array<{ objectKey: string; publicUrl: string }>, // Changed structure
        videoUrls: [] as string[],
        videoUploadIds: [] as string[], // Track upload IDs
    });

    // Fetch user profile and setup vehicles
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                console.log('🔍 Fetching user profile...');
                console.log('🔑 Token:', localStorage.getItem('accessToken')?.substring(0, 20) + '...');
                const response = await api.get('/me/profile');
                console.log('✅ Profile fetched:', response.data);
                const profile = response.data;
                setUserProfile(profile);

                // Setup vehicles from profile
                const userVehicles: Vehicle[] = [];
                if (profile.vehicleType && profile.licensePlate) {
                    userVehicles.push({
                        type: profile.vehicleType,
                        licensePlate: profile.licensePlate,
                        color: profile.vehicleColor,
                    });
                }
                setVehicles(userVehicles);

                // Auto-fill contact phone
                if (profile.phoneNumber) {
                    setFormData(prev => ({ ...prev, contactPhone: profile.phoneNumber }));
                }
            } catch (error) {
                console.error('Error fetching profile:', error);
            } finally {
                setIsLoadingProfile(false);
            }
        };

        if (isReady) {
            fetchProfile();
        }
    }, [isReady]);

    // Function to fetch current location
    const fetchLocation = async () => {
        if (!('geolocation' in navigator)) {
            toast.error('Trình duyệt không hỗ trợ định vị');
            return;
        }

        setIsLoadingLocation(true);

        console.log('🔍 [GEOLOCATION] Requesting new position...');
        console.log('🔍 [GEOLOCATION] Options:', {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        });

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                console.log('✅ [GEOLOCATION] Position received:', {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    altitude: position.coords.altitude,
                    altitudeAccuracy: position.coords.altitudeAccuracy,
                    heading: position.coords.heading,
                    speed: position.coords.speed,
                    timestamp: new Date(position.timestamp).toLocaleString('vi-VN')
                });

                const { latitude, longitude, accuracy } = position.coords;
                const address = await reverseGeocode(latitude, longitude);
                const location = {
                    addressText: address,
                    lat: latitude,
                    lng: longitude,
                };

                console.log('📍 [GEOLOCATION] Final location:', {
                    ...location,
                    accuracy: `${Math.round(accuracy)}m`,
                    source: accuracy < 50 ? 'GPS' : accuracy < 500 ? 'WiFi' : 'IP/Cell'
                });

                setCurrentLocation(location);
                setLocationTimestamp(new Date());
                // Auto-set as incident location
                setFormData(prev => ({ ...prev, incidentLocation: location }));
                setIsLoadingLocation(false);
            },
            (error) => {
                console.error('❌ [GEOLOCATION] Error:', {
                    code: error.code,
                    message: error.message,
                    PERMISSION_DENIED: error.code === 1,
                    POSITION_UNAVAILABLE: error.code === 2,
                    TIMEOUT: error.code === 3
                });
                setIsLoadingLocation(false);
                toast.error(`Không thể lấy vị trí: ${error.message}`);
            },
            {
                enableHighAccuracy: true, // Sử dụng GPS chính xác nhất
                timeout: 15000, // Timeout sau 15s
                maximumAge: 0, // KHÔNG dùng cache, luôn lấy vị trí mới
            }
        );
    };

    // Get current location on mount
    useEffect(() => {
        fetchLocation();
    }, []);

    const handleAddVehicle = () => {
        if (!newVehicle.licensePlate.trim()) {
            toast.error('Vui lòng nhập biển số xe');
            return;
        }

        const vehicle: Vehicle = {
            type: newVehicle.type,
            licensePlate: newVehicle.licensePlate.trim(),
            color: newVehicle.color.trim() || undefined,
        };

        setVehicles(prev => [...prev, vehicle]);
        setFormData(prev => ({ ...prev, vehicleIndex: vehicles.length })); // Select newly added vehicle
        setNewVehicle({ type: 'CAR', licensePlate: '', color: '' });
        setShowAddVehicle(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.incidentType || vehicles.length === 0 || !formData.incidentLocation || !formData.contactPhone) {
            toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
            return;
        }

        const selectedVehicle = vehicles[formData.vehicleIndex];

        setIsLoading(true);
        try {
            const payload = {
                incidentType: formData.incidentType,
                vehicleType: selectedVehicle.type,
                pickupLocation: formData.incidentLocation,
                contactPhone: formData.contactPhone,
                description: formData.description,
                mediaObjectKeys: formData.images.map(img => img.objectKey), // Extract objectKeys
                videoUploadIds: formData.videoUploadIds, // New: send upload IDs instead of URLs
                videoUrls: formData.videoUrls, // Keep for backward compatibility
            };

            console.log('📤 [CreateRequest] Submitting payload:', payload);
            console.log('📸 [CreateRequest] Image count:', formData.images.length);
            console.log('🎥 [CreateRequest] Video upload IDs:', formData.videoUploadIds.length);

            const response = await api.post('/rescue-requests', payload);
            console.log('✅ [CreateRequest] Response:', response.data);
            toast.success('Tạo yêu cầu cứu hộ thành công!');
            router.push(`/user/requests/${response.data.id}`);
        } catch (error: any) {
            console.error('❌ [CreateRequest] Error:', error);
            const errorMessage = error.response?.data?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.';
            toast.error(`Lỗi: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleImageUploadSuccess = (objectKey: string, publicUrl: string) => {
        console.log('📸 [ImageUpload] Success:', { objectKey, publicUrl });
        setFormData(prev => ({
            ...prev,
            images: [...prev.images, { objectKey, publicUrl }],
        }));
    };

    const handleImageRemove = (objectKey: string) => {
        console.log('🗑️ [ImageUpload] Removing:', objectKey);
        setFormData(prev => ({
            ...prev,
            images: prev.images.filter(img => img.objectKey !== objectKey),
        }));
    };

    // Show loading while guard is checking
    if (!isReady || isLoadingProfile) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-4xl mx-auto px-4 py-6">
                    <h1 className="text-3xl font-semibold text-gray-900">Tạo yêu cầu cứu hộ</h1>

                    <div className="mt-3 flex items-start justify-between gap-4">
                        <div className="flex-1">
                            {isLoadingLocation ? (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <svg className="animate-spin h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Đang lấy vị trí...</span>
                                </div>
                            ) : currentLocation ? (
                                <div>
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <span>{currentLocation.addressText}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                        <span>Lat: {currentLocation.lat.toFixed(6)}, Lng: {currentLocation.lng.toFixed(6)}</span>
                                        {locationTimestamp && (
                                            <span>• Cập nhật: {locationTimestamp.toLocaleTimeString('vi-VN')}</span>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-gray-500">Chưa lấy được vị trí</div>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={fetchLocation}
                            disabled={isLoadingLocation}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Làm mới
                        </button>
                    </div>
                </div>
            </div>

            {/* Form */}
            <div className="max-w-4xl mx-auto px-4 py-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Incident Type */}
                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                        <div className="border-b-2 border-blue-600 pb-2 mb-4">
                            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Loại sự cố
                            </h2>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {INCIDENT_TYPES.map((type) => (
                                <button
                                    key={type.value}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, incidentType: type.value })}
                                    className={`px-4 py-3 rounded-lg border-2 transition-all hover:shadow-md ${formData.incidentType === type.value
                                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md'
                                        : 'border-gray-200 hover:border-blue-300 text-gray-900'
                                        }`}
                                >
                                    <div className="text-sm font-medium">{type.label}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Vehicle Type */}
                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                        <div className="border-b-2 border-blue-600 pb-2 mb-4">
                            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Phương tiện gặp nạn
                            </h2>
                        </div>

                        {vehicles.length === 0 ? (
                            <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                <p className="mt-2 text-sm text-gray-600">Bạn chưa thêm phương tiện, hãy thêm ngay để tạo yêu cầu.</p>
                                <button
                                    type="button"
                                    onClick={() => setShowAddVehicle(true)}
                                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    + Thêm xe
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="font-medium text-gray-900">Chọn xe:</label>
                                    <button
                                        type="button"
                                        onClick={() => setShowAddVehicle(true)}
                                        className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                                    >
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                        Thêm xe mới
                                    </button>
                                </div>
                                <div className="grid gap-2">
                                    {vehicles.map((vehicle, index) => (
                                        <button
                                            key={index}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, vehicleIndex: index })}
                                            className={`px-4 py-3 rounded-lg border-2 transition-all text-left ${formData.vehicleIndex === index
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 hover:border-blue-300'
                                                }`}
                                        >
                                            <div className="font-medium text-gray-900">
                                                {VEHICLE_TYPE_LABELS[vehicle.type]} - {vehicle.licensePlate}
                                            </div>
                                            {vehicle.color && (
                                                <div className="text-sm text-gray-600">Màu: {vehicle.color}</div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Add Vehicle Form */}
                        {showAddVehicle && (
                            <div className="mt-4 p-4 border-l-4 border-blue-600 bg-blue-50 rounded-lg">
                                <h3 className="font-medium text-gray-900 mb-3">Thêm xe mới</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Loại xe:</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setNewVehicle({ ...newVehicle, type: 'CAR' })}
                                                className={`px-3 py-2 rounded-lg border-2 transition-all font-medium text-gray-900 ${newVehicle.type === 'CAR'
                                                    ? 'border-blue-600 bg-white'
                                                    : 'border-gray-300 bg-white'
                                                    }`}
                                            >
                                                Ô tô
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setNewVehicle({ ...newVehicle, type: 'MOTORCYCLE' })}
                                                className={`px-3 py-2 rounded-lg border-2 transition-all font-medium text-gray-900 ${newVehicle.type === 'MOTORCYCLE'
                                                    ? 'border-blue-600 bg-white'
                                                    : 'border-gray-300 bg-white'
                                                    }`}
                                            >
                                                Xe máy
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Biển số xe: *</label>
                                        <input
                                            type="text"
                                            value={newVehicle.licensePlate}
                                            onChange={(e) => setNewVehicle({ ...newVehicle, licensePlate: e.target.value.toUpperCase() })}
                                            placeholder="VD: 29A-12345"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Màu xe:</label>
                                        <input
                                            type="text"
                                            value={newVehicle.color}
                                            onChange={(e) => setNewVehicle({ ...newVehicle, color: e.target.value })}
                                            placeholder="VD: Đen, Trắng, Đỏ"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={handleAddVehicle}
                                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                        >
                                            Thêm
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowAddVehicle(false)}
                                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                        >
                                            Hủy
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Incident Location */}
                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                        <div className="border-b-2 border-blue-600 pb-2 mb-4">
                            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                Vị trí gặp nạn
                            </h2>
                        </div>
                        <LocationPicker
                            label=""
                            value={formData.incidentLocation}
                            onChange={(location) => setFormData({ ...formData, incidentLocation: location })}
                            placeholder="Nhập địa điểm gặp nạn..."
                            required
                        />
                    </div>

                    {/* Contact Phone */}
                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                        <div className="border-b-2 border-blue-600 pb-2 mb-4">
                            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                Thông tin liên hệ
                            </h2>
                        </div>
                        <label className="block font-medium text-gray-900 mb-2">
                            Số điện thoại <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="tel"
                            value={formData.contactPhone}
                            onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                            placeholder="Nhập số điện thoại liên hệ"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                            required
                        />
                        <p className="mt-2 text-sm text-gray-600">
                            Provider sẽ liên hệ qua số này khi nhận yêu cầu
                        </p>
                    </div>

                    {/* Description */}
                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                        <div className="border-b-2 border-blue-600 pb-2 mb-4">
                            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                                </svg>
                                Mô tả chi tiết
                            </h2>
                        </div>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Mô tả tình trạng xe, vị trí cụ thể, thông tin bổ sung..."
                            rows={4}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                        />
                    </div>

                    {/* Photo Upload */}
                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                        <div className="border-b-2 border-blue-600 pb-2 mb-4">
                            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Hình ảnh hiện trường
                            </h2>
                        </div>
                        <ImageUpload
                            purpose={UploadPurpose.REQUEST_PHOTO}
                            maxImages={5}
                            uploadedImages={formData.images}
                            onSuccess={handleImageUploadSuccess}
                            onRemove={handleImageRemove}
                            label=""
                        />
                    </div>

                    {/* Video Upload */}
                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                        <div className="border-b-2 border-blue-600 pb-2 mb-4">
                            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Video (Tùy chọn)
                            </h2>
                        </div>
                        <VideoUpload
                            label="Upload video tình trạng xe"
                            maxVideos={2}
                            cloudinaryCloudName={process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || ''}
                            cloudinaryUploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || ''}
                            uploadedVideos={formData.videoUrls.map((url, idx) => ({
                                url,
                                uploadId: formData.videoUploadIds[idx]
                            }))}
                            onSuccess={(videoUrl, uploadId) => {
                                setFormData(prev => ({
                                    ...prev,
                                    videoUrls: [...prev.videoUrls, videoUrl],
                                    videoUploadIds: [...prev.videoUploadIds, uploadId]
                                }));
                            }}
                            onRemove={(videoUrl, uploadId) => {
                                setFormData(prev => {
                                    const urlIndex = prev.videoUrls.indexOf(videoUrl);
                                    return {
                                        ...prev,
                                        videoUrls: prev.videoUrls.filter((_, i) => i !== urlIndex),
                                        videoUploadIds: prev.videoUploadIds.filter((_, i) => i !== urlIndex)
                                    };
                                });
                            }}
                        />
                    </div>

                    {/* Submit Button */}
                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || vehicles.length === 0}
                            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all font-medium shadow-md hover:shadow-lg"
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Đang gửi...
                                </span>
                            ) : (
                                'Tạo yêu cầu cứu hộ'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
