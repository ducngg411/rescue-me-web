'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserGuard } from '@/lib/guards';
import LocationPicker from '@/components/LocationPicker';
import FileUpload from '@/components/FileUpload';
import { UploadPurpose } from '@/lib/upload';
import api from '@/lib/api';

interface LocationData {
    addressText: string;
    lat: number;
    lng: number;
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

const VEHICLE_TYPES = [
    { value: 'CAR', label: 'Ô tô' },
    { value: 'MOTORCYCLE', label: 'Xe máy' },
];

export default function CreateRescueRequestPage() {
    const router = useRouter();
    const { isReady, user } = useUserGuard();
    const [isLoading, setIsLoading] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);

    const [formData, setFormData] = useState({
        incidentType: '',
        vehicleType: '',
        pickupLocation: null as LocationData | null,
        dropoffLocation: null as LocationData | null,
        description: '',
        mediaObjectKeys: [] as string[],
    });

    // Get current location on mount
    useEffect(() => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    setCurrentLocation({
                        addressText: `Vị trí hiện tại`,
                        lat: latitude,
                        lng: longitude,
                    });
                },
                (error) => {
                    console.error('Error getting location:', error);
                }
            );
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.incidentType || !formData.vehicleType || !formData.pickupLocation) {
            alert('Vui lòng điền đầy đủ thông tin bắt buộc');
            return;
        }

        setIsLoading(true);
        try {
            const response = await api.post('/rescue-requests', formData);
            alert('Tạo yêu cầu cứu hộ thành công!');
            router.push(`/user/requests/${response.data.id}`);
        } catch (error: any) {
            console.error('Error creating rescue request:', error);
            const errorMessage = error.response?.data?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.';
            alert(`Lỗi: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUploadSuccess = (result: any) => {
        if (result.objectKey) {
            setFormData(prev => ({
                ...prev,
                mediaObjectKeys: [...prev.mediaObjectKeys, result.objectKey],
            }));
        }
    };

    const removeMedia = (objectKey: string) => {
        setFormData(prev => ({
            ...prev,
            mediaObjectKeys: prev.mediaObjectKeys.filter(key => key !== objectKey),
        }));
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
            {/* Header with Current Location */}
            <div className="bg-white border-b shadow-sm">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <h1 className="text-2xl font-bold text-gray-900">Tạo yêu cầu cứu hộ</h1>

                    {currentLocation && (
                        <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                            <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>
                                Vị trí hiện tại: {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Form */}
            <div className="max-w-4xl mx-auto px-4 py-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Incident Type */}
                    <div className="bg-white p-6 rounded-lg shadow-sm">
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            Loại sự cố <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {INCIDENT_TYPES.map((type) => (
                                <button
                                    key={type.value}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, incidentType: type.value })}
                                    className={`px-4 py-3 rounded-lg border-2 transition-all ${formData.incidentType === type.value
                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    {type.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Vehicle Type */}
                    <div className="bg-white p-6 rounded-lg shadow-sm">
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            Loại phương tiện <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {VEHICLE_TYPES.map((type) => (
                                <button
                                    key={type.value}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, vehicleType: type.value })}
                                    className={`px-4 py-3 rounded-lg border-2 transition-all ${formData.vehicleType === type.value
                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    {type.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Pickup Location */}
                    <div className="bg-white p-6 rounded-lg shadow-sm">
                        <LocationPicker
                            label="Điểm đón"
                            value={formData.pickupLocation}
                            onChange={(location) => setFormData({ ...formData, pickupLocation: location })}
                            placeholder="Nhập địa điểm đón..."
                            required
                        />
                    </div>

                    {/* Dropoff Location */}
                    <div className="bg-white p-6 rounded-lg shadow-sm">
                        <LocationPicker
                            label="Điểm đến (tùy chọn)"
                            value={formData.dropoffLocation}
                            onChange={(location) => setFormData({ ...formData, dropoffLocation: location })}
                            placeholder="Nhập điểm đến (nếu cần kéo xe)..."
                        />
                    </div>

                    {/* Description */}
                    <div className="bg-white p-6 rounded-lg shadow-sm">
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            Mô tả chi tiết
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Mô tả tình trạng xe, vị trí cụ thể, thông tin bổ sung..."
                            rows={4}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Photo Upload */}
                    <div className="bg-white p-6 rounded-lg shadow-sm">
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            Hình ảnh (tùy chọn, tối đa 5 ảnh)
                        </label>

                        {formData.mediaObjectKeys.length < 5 && (
                            <FileUpload
                                purpose={UploadPurpose.REQUEST_PHOTO}
                                onSuccess={handleFileUploadSuccess}
                                label="Chọn ảnh"
                            />
                        )}

                        {formData.mediaObjectKeys.length > 0 && (
                            <div className="mt-4 grid grid-cols-3 gap-3">
                                {formData.mediaObjectKeys.map((key, index) => (
                                    <div key={index} className="relative group">
                                        <img
                                            src={`${process.env.NEXT_PUBLIC_S3_PUBLIC_URL}/${key}`}
                                            alt={`Photo ${index + 1}`}
                                            className="w-full h-24 object-cover rounded-lg"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeMedia(key)}
                                            className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Submit Button */}
                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                        >
                            {isLoading ? 'Đang gửi...' : 'Tạo yêu cầu cứu hộ'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
