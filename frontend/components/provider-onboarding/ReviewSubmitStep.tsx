'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';

interface ReviewSubmitStepProps {
    serviceInfo: any;
    requiredDocs: any;
    optionalDocs: any;
    onBack: () => void;
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
    TOWING: 'Kéo xe',
    BATTERY_JUMP: 'Cứu hộ bình điện',
    TIRE_CHANGE: 'Thay lốp xe',
    FUEL_DELIVERY: 'Tiếp nhiên liệu',
    LOCKOUT: 'Mở khóa xe',
    BREAKDOWN_REPAIR: 'Sửa chữa tại chỗ',
};

const VEHICLE_TYPE_LABELS: Record<string, string> = {
    CAR: 'Ô tô',
    MOTORCYCLE: 'Xe máy',
};

export default function ReviewSubmitStep({ serviceInfo, requiredDocs, optionalDocs, onBack }: ReviewSubmitStepProps) {
    const router = useRouter();
    const { refreshUser } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError('');

        try {
            // Submit verification with upload IDs
            const uploadIds = [
                requiredDocs.citizenIdFront?.id,
                requiredDocs.citizenIdBack?.id,
                requiredDocs.selfie?.id,
                requiredDocs.carPhoto?.id,
                requiredDocs.motorbikePhoto?.id,
                optionalDocs?.driverLicense?.id,
                optionalDocs?.businessLicense?.id,
            ].filter(Boolean);

            await api.post('/me/provider/submit-verification', {
                uploadIds,
            });

            // Refresh user data to get updated verificationStatus
            await refreshUser();

            // Success - redirect to dashboard
            router.push('/provider/dashboard?verification=submitted');
        } catch (err: any) {
            console.error('Submit error:', err);
            setError(err.response?.data?.message || 'Có lỗi xảy ra khi submit hồ sơ');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div>
            <h2 className="text-2xl font-bold mb-6">Xem lại và Gửi hồ sơ</h2>
            <p className="text-gray-600 mb-6">
                Vui lòng kiểm tra lại thông tin trước khi gửi. Sau khi gửi, hồ sơ sẽ chuyển sang trạng thái PENDING và chờ admin duyệt.
            </p>

            {/* Service Info Section */}
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <h3 className="font-bold text-lg mb-4">Thông tin dịch vụ</h3>
                <div className="space-y-2 text-sm">
                    <div className="flex">
                        <span className="font-medium w-48">Loại nhà cung cấp:</span>
                        <span>{serviceInfo.providerType === 'INDIVIDUAL' ? 'Cá nhân' : 'Doanh nghiệp'}</span>
                    </div>
                    <div className="flex">
                        <span className="font-medium w-48">Họ tên:</span>
                        <span>{serviceInfo.fullName}</span>
                    </div>
                    <div className="flex">
                        <span className="font-medium w-48">Số điện thoại:</span>
                        <span>{serviceInfo.phoneNumber}</span>
                    </div>
                    {serviceInfo.businessName && (
                        <div className="flex">
                            <span className="font-medium w-48">Tên doanh nghiệp:</span>
                            <span>{serviceInfo.businessName}</span>
                        </div>
                    )}
                    <div className="flex">
                        <span className="font-medium w-48">Dịch vụ cung cấp:</span>
                        <span>{serviceInfo.serviceTypes.map((t: string) => SERVICE_TYPE_LABELS[t]).join(', ')}</span>
                    </div>
                    <div className="flex">
                        <span className="font-medium w-48">Loại phương tiện:</span>
                        <span>{serviceInfo.supportedVehicleTypes.map((t: string) => VEHICLE_TYPE_LABELS[t]).join(', ')}</span>
                    </div>
                    <div className="flex">
                        <span className="font-medium w-48">Bán kính phục vụ:</span>
                        <span>{serviceInfo.serviceRadiusKm} km</span>
                    </div>
                    <div className="flex">
                        <span className="font-medium w-48">Địa chỉ:</span>
                        <span>{serviceInfo.providerType === 'INDIVIDUAL' ? serviceInfo.permanentAddress.addressText : serviceInfo.businessAddress.addressText}</span>
                    </div>
                    {serviceInfo.carPlateNumber && (
                        <div className="flex">
                            <span className="font-medium w-48">Biển số ô tô:</span>
                            <span>{serviceInfo.carPlateNumber}</span>
                        </div>
                    )}
                    {serviceInfo.motorcyclePlateNumber && (
                        <div className="flex">
                            <span className="font-medium w-48">Biển số xe máy:</span>
                            <span>{serviceInfo.motorcyclePlateNumber}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Required Documents Section */}
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <h3 className="font-bold text-lg mb-4">Giấy tờ bắt buộc</h3>
                <div className="space-y-2 text-sm">
                    <div className="flex items-center">
                        <span className="font-medium w-48">CCCD mặt trước:</span>
                        <span className={requiredDocs.citizenIdFront ? 'text-green-600' : 'text-red-600'}>
                            {requiredDocs.citizenIdFront ? '✓ Đã upload' : '✗ Chưa upload'}
                        </span>
                    </div>
                    <div className="flex items-center">
                        <span className="font-medium w-48">CCCD mặt sau:</span>
                        <span className={requiredDocs.citizenIdBack ? 'text-green-600' : 'text-red-600'}>
                            {requiredDocs.citizenIdBack ? '✓ Đã upload' : '✗ Chưa upload'}
                        </span>
                    </div>
                    <div className="flex items-center">
                        <span className="font-medium w-48">Ảnh selfie cầm CCCD:</span>
                        <span className={requiredDocs.selfie ? 'text-green-600' : 'text-red-600'}>
                            {requiredDocs.selfie ? '✓ Đã upload' : '✗ Chưa upload'}
                        </span>
                    </div>
                    {serviceInfo.supportedVehicleTypes.includes('CAR') && (
                        <div className="flex items-center">
                            <span className="font-medium w-48">Ảnh ô tô:</span>
                            <span className={requiredDocs.carPhoto ? 'text-green-600' : 'text-red-600'}>
                                {requiredDocs.carPhoto ? '✓ Đã upload' : '✗ Chưa upload'}
                            </span>
                        </div>
                    )}
                    {serviceInfo.supportedVehicleTypes.includes('MOTORCYCLE') && (
                        <div className="flex items-center">
                            <span className="font-medium w-48">Ảnh xe máy:</span>
                            <span className={requiredDocs.motorbikePhoto ? 'text-green-600' : 'text-red-600'}>
                                {requiredDocs.motorbikePhoto ? '✓ Đã upload' : '✗ Chưa upload'}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Optional Documents Section */}
            {(optionalDocs.driverLicense || optionalDocs.businessLicense) && (
                <div className="bg-gray-50 rounded-lg p-6 mb-6">
                    <h3 className="font-bold text-lg mb-4">Giấy tờ bổ sung</h3>
                    <div className="space-y-2 text-sm">
                        {optionalDocs.driverLicense && (
                            <div className="flex items-center">
                                <span className="font-medium w-48">Bằng lái xe:</span>
                                <span className="text-green-600">✓ Đã upload</span>
                            </div>
                        )}
                        {optionalDocs.businessLicense && (
                            <div className="flex items-center">
                                <span className="font-medium w-48">Giấy phép kinh doanh:</span>
                                <span className="text-green-600">✓ Đã upload</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Warning Box */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-yellow-800">
                    ⚠️ <strong>Lưu ý:</strong> Sau khi submit, trạng thái sẽ chuyển sang PENDING. Bạn không thể chỉnh sửa thông tin cho đến khi admin xử lý.
                </p>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <p className="text-sm text-red-800">{error}</p>
                </div>
            )}

            {/* Actions */}
            <div className="flex justify-between mt-8">
                <button
                    onClick={onBack}
                    disabled={isSubmitting}
                    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                    Quay lại
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                    {isSubmitting ? 'Đang gửi...' : 'Gửi hồ sơ'}
                </button>
            </div>
        </div>
    );
}
