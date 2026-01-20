'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, FileText, CheckCircle, XCircle, AlertTriangle, Send } from 'lucide-react';
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
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                    Xem lại và Gửi hồ sơ
                </h2>
                <p className="text-sm text-gray-600">
                    Vui lòng kiểm tra lại thông tin trước khi gửi. Sau khi gửi, hồ sơ sẽ chuyển sang trạng thái PENDING và chờ admin duyệt.
                </p>
            </div>

            {/* Service Info Section */}
            <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-blue-600">
                    <User className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Thông tin dịch vụ</h3>
                </div>
                <div className="space-y-3 text-sm">
                    <div className="flex">
                        <span className="font-medium text-gray-900 w-48">Loại nhà cung cấp:</span>
                        <span className="text-gray-700">{serviceInfo.providerType === 'INDIVIDUAL' ? 'Cá nhân' : 'Doanh nghiệp'}</span>
                    </div>
                    <div className="flex">
                        <span className="font-medium text-gray-900 w-48">Họ tên:</span>
                        <span className="text-gray-700">{serviceInfo.fullName}</span>
                    </div>
                    <div className="flex">
                        <span className="font-medium text-gray-900 w-48">Số điện thoại:</span>
                        <span className="text-gray-700">{serviceInfo.phoneNumber}</span>
                    </div>
                    {serviceInfo.businessName && (
                        <div className="flex">
                            <span className="font-medium text-gray-900 w-48">Tên doanh nghiệp:</span>
                            <span className="text-gray-700">{serviceInfo.businessName}</span>
                        </div>
                    )}
                    <div className="flex">
                        <span className="font-medium text-gray-900 w-48">Dịch vụ cung cấp:</span>
                        <span className="text-gray-700">{serviceInfo.serviceTypes.map((t: string) => SERVICE_TYPE_LABELS[t]).join(', ')}</span>
                    </div>
                    <div className="flex">
                        <span className="font-medium text-gray-900 w-48">Loại phương tiện:</span>
                        <span className="text-gray-700">{serviceInfo.supportedVehicleTypes.map((t: string) => VEHICLE_TYPE_LABELS[t]).join(', ')}</span>
                    </div>
                    <div className="flex">
                        <span className="font-medium text-gray-900 w-48">Bán kính phục vụ:</span>
                        <span className="text-gray-700">{serviceInfo.serviceRadiusKm} km</span>
                    </div>
                    <div className="flex">
                        <span className="font-medium text-gray-900 w-48">Địa chỉ:</span>
                        <span className="text-gray-700">{serviceInfo.providerType === 'INDIVIDUAL' ? serviceInfo.permanentAddress.addressText : serviceInfo.businessAddress.addressText}</span>
                    </div>
                    {serviceInfo.rescueVehicles && serviceInfo.rescueVehicles.length > 0 && (
                        <div className="flex">
                            <span className="font-medium text-gray-900 w-48">Phương tiện cứu hộ:</span>
                            <div className="flex-1">
                                {serviceInfo.rescueVehicles.map((vehicle: any, index: number) => (
                                    <div key={index} className="flex items-center gap-2 mb-1">
                                        <span className="text-gray-700">
                                            {vehicle.type === 'CAR' ? '🚗 Ô tô' : '🏍️ Xe máy'}:
                                        </span>
                                        <span className="text-gray-700 font-mono">{vehicle.plateNumber}</span>
                                        {vehicle.isPrimary && (
                                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">Chính</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Required Documents Section */}
            <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-blue-600">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Giấy tờ bắt buộc</h3>
                </div>
                <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 w-48">CCCD mặt trước:</span>
                        {requiredDocs.citizenIdFront ? (
                            <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="w-4 h-4" />
                                <span>Đã upload</span>
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-red-600">
                                <XCircle className="w-4 h-4" />
                                <span>Chưa upload</span>
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 w-48">CCCD mặt sau:</span>
                        {requiredDocs.citizenIdBack ? (
                            <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="w-4 h-4" />
                                <span>Đã upload</span>
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-red-600">
                                <XCircle className="w-4 h-4" />
                                <span>Chưa upload</span>
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 w-48">Ảnh selfie cầm CCCD:</span>
                        {requiredDocs.selfie ? (
                            <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="w-4 h-4" />
                                <span>Đã upload</span>
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-red-600">
                                <XCircle className="w-4 h-4" />
                                <span>Chưa upload</span>
                            </span>
                        )}
                    </div>
                    {serviceInfo.supportedVehicleTypes.includes('CAR') && (
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 w-48">Ảnh ô tô:</span>
                            {requiredDocs.carPhoto ? (
                                <span className="flex items-center gap-1 text-green-600">
                                    <CheckCircle className="w-4 h-4" />
                                    <span>Đã upload</span>
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-red-600">
                                    <XCircle className="w-4 h-4" />
                                    <span>Chưa upload</span>
                                </span>
                            )}
                        </div>
                    )}
                    {serviceInfo.supportedVehicleTypes.includes('MOTORCYCLE') && (
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 w-48">Ảnh xe máy:</span>
                            {requiredDocs.motorbikePhoto ? (
                                <span className="flex items-center gap-1 text-green-600">
                                    <CheckCircle className="w-4 h-4" />
                                    <span>Đã upload</span>
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-red-600">
                                    <XCircle className="w-4 h-4" />
                                    <span>Chưa upload</span>
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Optional Documents Section */}
            {(optionalDocs.driverLicense || optionalDocs.businessLicense) && (
                <div className="border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-blue-600">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <h3 className="text-lg font-semibold text-gray-900">Giấy tờ bổ sung</h3>
                    </div>
                    <div className="space-y-3 text-sm">
                        {optionalDocs.driverLicense && (
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900 w-48">Bằng lái xe:</span>
                                <span className="flex items-center gap-1 text-green-600">
                                    <CheckCircle className="w-4 h-4" />
                                    <span>Đã upload</span>
                                </span>
                            </div>
                        )}
                        {optionalDocs.businessLicense && (
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900 w-48">Giấy phép kinh doanh:</span>
                                <span className="flex items-center gap-1 text-green-600">
                                    <CheckCircle className="w-4 h-4" />
                                    <span>Đã upload</span>
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Warning Box */}
            <div className="border-l-4 border-yellow-500 bg-yellow-50 rounded-r-lg p-4">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-yellow-900 mb-1">Lưu ý quan trọng</p>
                        <p className="text-sm text-yellow-800">
                            Sau khi submit, trạng thái sẽ chuyển sang PENDING. Bạn không thể chỉnh sửa thông tin cho đến khi admin xử lý.
                        </p>
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="border-l-4 border-red-500 bg-red-50 rounded-r-lg p-4">
                    <div className="flex items-start gap-3">
                        <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-800">{error}</p>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex justify-between pt-4">
                <button
                    onClick={onBack}
                    disabled={isSubmitting}
                    className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    Quay lại
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-green-600 border-2 border-green-600 rounded-lg hover:bg-green-700 hover:border-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {isSubmitting ? (
                        <>
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>Đang gửi...</span>
                        </>
                    ) : (
                        <>
                            <Send className="w-4 h-4" />
                            <span>Gửi hồ sơ</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
