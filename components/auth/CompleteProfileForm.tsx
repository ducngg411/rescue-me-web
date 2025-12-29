'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { VEHICLE_COLORS, VEHICLE_TYPES } from '@/constants';

export interface CompleteProfileData {
    phoneNumber: string;
    vehicleType: 'CAR' | 'TRUCK' | 'MOTORCYCLE';
    licensePlate: string;
    vehicleColor: string;
}

interface CompleteProfileFormProps {
    userRole: 'user' | 'provider';
    onSubmit: (data: CompleteProfileData) => Promise<void>;
}

export function CompleteProfileForm({ userRole, onSubmit }: CompleteProfileFormProps) {
    const [formData, setFormData] = useState<CompleteProfileData>({
        phoneNumber: '',
        vehicleType: 'CAR',
        licensePlate: '',
        vehicleColor: '',
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [useCustomColor, setUseCustomColor] = useState(false);
    const [customColor, setCustomColor] = useState('');
    const [fieldErrors, setFieldErrors] = useState<{
        phoneNumber?: string;
        licensePlate?: string;
        vehicleColor?: string;
    }>({});

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setFieldErrors({});

        const errors: {
            phoneNumber?: string;
            licensePlate?: string;
            vehicleColor?: string;
        } = {};

        // Validate phone number (required for both roles)
        if (!formData.phoneNumber.trim()) {
            errors.phoneNumber = 'Số điện thoại là bắt buộc';
        } else if (!formData.phoneNumber.match(/^0[0-9]{9}$/)) {
            errors.phoneNumber = 'Số điện thoại phải có 10 chữ số và bắt đầu bằng 0';
        }

        // Validate license plate
        if (!formData.licensePlate.trim()) {
            errors.licensePlate = 'Biển số xe là bắt buộc';
        } else {
            const licensePlateRegex = /^[0-9]{2}[A-Z]{1,2}[-]?[0-9]{4,5}$/i;
            if (!formData.licensePlate.match(licensePlateRegex)) {
                errors.licensePlate = 'Biển số xe không hợp lệ. Ví dụ: 29A-12345';
            }
        }

        // Validate color
        const finalColor = useCustomColor ? customColor : formData.vehicleColor;
        if (!finalColor || finalColor.length < 2) {
            errors.vehicleColor = 'Vui lòng nhập màu xe';
        }

        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }

        // Submit form data
        setLoading(true);
        try {
            const normalizedData = {
                ...formData,
                licensePlate: formData.licensePlate.toUpperCase().replace(/\s/g, ''),
                vehicleColor: finalColor
            };

            await onSubmit(normalizedData);
        } catch (err: any) {
            setError(err.message || 'Something went wrong. Please try again!');
        } finally {
            setLoading(false)
        }
    };

    return (
        <div className="space-y-6">
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Phone Number */}
                <div>
                    <label className="block text-sm font-medium mb-2">
                        Số điện thoại <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="tel"
                        value={formData.phoneNumber}
                        onChange={(e) => {
                            setFormData({ ...formData, phoneNumber: e.target.value });
                            if (fieldErrors.phoneNumber) {
                                setFieldErrors({ ...fieldErrors, phoneNumber: undefined });
                            }
                        }}
                        className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${fieldErrors.phoneNumber ? 'border-red-500' : ''
                            }`}
                        placeholder="0912345678"
                        disabled={loading}
                        maxLength={10}
                    />
                    {fieldErrors.phoneNumber ? (
                        <p className="text-red-500 text-sm mt-1">{fieldErrors.phoneNumber}</p>
                    ) : (
                        <p className="text-xs text-gray-500 mt-1">10 chữ số, bắt đầu bằng 0</p>
                    )}
                </div>

                {/* Vehicle Info - For both user and provider */}
                <div className="border-t pt-4 mt-4">
                    <h3 className="text-lg font-semibold mb-2">
                        {userRole === 'user' ? 'Thông tin xe của bạn' : 'Thông tin xe cứu hộ'}
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                        {userRole === 'user'
                            ? 'Để chúng tôi xác định phương tiện của bạn khi cần cứu hộ'
                            : 'Để khách hàng dễ dàng nhận diện xe cứu hộ của bạn'
                        }
                    </p>
                </div>

                {/* Vehicle Type */}
                <div>
                    <label className="block text-sm font-medium mb-2">
                        Loại xe <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={formData.vehicleType}
                        onChange={(e) => setFormData({
                            ...formData,
                            vehicleType: e.target.value as 'CAR' | 'TRUCK' | 'MOTORCYCLE'
                        })}
                        className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        required
                        disabled={loading}
                    >
                        {Object.entries(VEHICLE_TYPES).map(([key, label]) => (
                            <option key={key} value={key}>
                                {label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* License Plate */}
                <div>
                    <label className="block text-sm font-medium mb-2">
                        Biển số xe <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={formData.licensePlate}
                        onChange={(e) => {
                            setFormData({
                                ...formData,
                                licensePlate: e.target.value.toUpperCase()
                            });
                            if (fieldErrors.licensePlate) {
                                setFieldErrors({ ...fieldErrors, licensePlate: undefined });
                            }
                        }}
                        className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary font-mono ${fieldErrors.licensePlate ? 'border-red-500' : ''
                            }`}
                        placeholder="29A-12345"
                        disabled={loading}
                        maxLength={10}
                    />
                    {fieldErrors.licensePlate ? (
                        <p className="text-red-500 text-sm mt-1">{fieldErrors.licensePlate}</p>
                    ) : (
                        <p className="text-xs text-gray-500 mt-1">Ví dụ: 29A-12345, 30H12345, 51B-98765</p>
                    )}
                </div>

                {/* Vehicle Color */}
                <div>
                    <label className="block text-sm font-medium mb-2">
                        Màu xe <span className="text-red-500">*</span>
                    </label>

                    {!useCustomColor ? (
                        <div className="space-y-2">
                            <select
                                value={formData.vehicleColor}
                                onChange={(e) => {
                                    setFormData({
                                        ...formData,
                                        vehicleColor: e.target.value
                                    });
                                    if (fieldErrors.vehicleColor) {
                                        setFieldErrors({ ...fieldErrors, vehicleColor: undefined });
                                    }
                                }}
                                className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${fieldErrors.vehicleColor ? 'border-red-500' : ''
                                    }`}
                                disabled={loading}
                            >
                                <option value="">Chọn màu xe</option>
                                {VEHICLE_COLORS.map((color) => (
                                    <option key={color} value={color}>
                                        {color}
                                    </option>
                                ))}
                            </select>
                            {fieldErrors.vehicleColor && (
                                <p className="text-red-500 text-sm">{fieldErrors.vehicleColor}</p>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    setUseCustomColor(true);
                                    setFormData({ ...formData, vehicleColor: '' });
                                    setFieldErrors({ ...fieldErrors, vehicleColor: undefined });
                                }}
                                className="text-sm text-primary hover:underline"
                                disabled={loading}
                            >
                                + Nhập màu tùy chỉnh
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <input
                                type="text"
                                value={customColor}
                                onChange={(e) => {
                                    setCustomColor(e.target.value);
                                    if (fieldErrors.vehicleColor) {
                                        setFieldErrors({ ...fieldErrors, vehicleColor: undefined });
                                    }
                                }}
                                className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${fieldErrors.vehicleColor ? 'border-red-500' : ''
                                    }`}
                                placeholder="Nhập màu xe (ví dụ: Xanh dương nhạt)"
                                disabled={loading}
                            />
                            {fieldErrors.vehicleColor && (
                                <p className="text-red-500 text-sm">{fieldErrors.vehicleColor}</p>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    setUseCustomColor(false);
                                    setCustomColor('');
                                }}
                                className="text-sm text-primary hover:underline"
                                disabled={loading}
                            >
                                ← Chọn từ danh sách
                            </button>
                        </div>
                    )}
                </div>

                <Button
                    type="submit"
                    className="w-full"
                    disabled={loading}
                    size="lg"
                >
                    {loading ? (
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Đang lưu...</span>
                        </div>
                    ) : (
                        'Hoàn tất đăng ký'
                    )}
                </Button>
            </form>
        </div>
    );
}