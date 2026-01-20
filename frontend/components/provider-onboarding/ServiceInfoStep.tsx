'use client';

import React, { useState, useEffect, useRef } from 'react';
import { User, Building2, Briefcase, Car, Bike, MapPin, Ruler } from 'lucide-react';
import { searchPlaces, getPlaceDetails, PlaceSearchResult } from '@/lib/vietmap';
import { normalizeVietnamPlate, isValidVietnamPlate, formatVietnamPlate } from '@/lib/validators';

const SERVICE_TYPES = [
    { value: 'TOWING', label: 'Kéo xe' },
    { value: 'BATTERY_JUMP', label: 'Cứu hộ bình điện' },
    { value: 'TIRE_CHANGE', label: 'Thay lốp xe' },
    { value: 'FUEL_DELIVERY', label: 'Tiếp nhiên liệu' },
    { value: 'LOCKOUT', label: 'Mở khóa xe' },
    { value: 'BREAKDOWN_REPAIR', label: 'Sửa chữa tại chỗ' },
];

const VEHICLE_TYPES = [
    { value: 'CAR', label: 'Ô tô' },
    { value: 'MOTORCYCLE', label: 'Xe máy' },
];

interface ServiceInfoStepProps {
    initialData: any;
    onComplete: (data: any) => void;
    onBack: () => void;
}

export default function ServiceInfoStep({ initialData, onComplete, onBack }: ServiceInfoStepProps) {
    const [formData, setFormData] = useState({
        providerType: initialData?.providerType || 'INDIVIDUAL',
        fullName: initialData?.fullName || '',
        phoneNumber: initialData?.phoneNumber || '',
        businessName: initialData?.businessName || '',
        serviceTypes: initialData?.serviceTypes || [],
        supportedVehicleTypes: initialData?.supportedVehicleTypes || [],
        serviceRadiusKm: initialData?.serviceRadiusKm || 15,
        permanentAddress: initialData?.permanentAddress || { addressText: '', lat: 0, lng: 0 },
        businessAddress: initialData?.businessAddress || { addressText: '', lat: 0, lng: 0 },
        rescueVehicles: initialData?.rescueVehicles || [{ type: 'CAR', plateNumber: '', isPrimary: true }],
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [addressQuery, setAddressQuery] = useState('');
    const [addressSuggestions, setAddressSuggestions] = useState<PlaceSearchResult[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [addressSelected, setAddressSelected] = useState(false);

    useEffect(() => {
        // Don't search if address was just selected from dropdown
        if (addressSelected) {
            return;
        }

        const searchTimeout = setTimeout(async () => {
            if (addressQuery.trim().length < 2) {
                setAddressSuggestions([]);
                setShowSuggestions(false);
                return;
            }

            try {
                const results = await searchPlaces(addressQuery);
                setAddressSuggestions(results);
                setShowSuggestions(results.length > 0);
            } catch (error) {
                console.error('Error searching places:', error);
                setAddressSuggestions([]);
                setShowSuggestions(false);
            }
        }, 300);

        return () => clearTimeout(searchTimeout);
    }, [addressQuery, addressSelected]);

    const handleSelectAddress = async (place: PlaceSearchResult) => {
        try {
            const details = place.refId ? await getPlaceDetails(place.refId) : null;
            const address = {
                addressText: place.displayName || details?.name || '',
                lat: details?.lat || place.lat || 0,
                lng: details?.lng || place.lng || 0,
            };

            if (formData.providerType === 'INDIVIDUAL') {
                setFormData({ ...formData, permanentAddress: address });
            } else {
                setFormData({ ...formData, businessAddress: address });
            }

            setAddressQuery(address.addressText);
            setShowSuggestions(false);
            setAddressSelected(true); // Mark as selected to prevent re-search
        } catch (error) {
            console.error('Error getting place details:', error);
        }
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.fullName.trim()) newErrors.fullName = 'Họ tên là bắt buộc';
        if (!formData.phoneNumber.trim()) newErrors.phoneNumber = 'Số điện thoại là bắt buộc';
        if (formData.serviceTypes.length === 0) newErrors.serviceTypes = 'Chọn ít nhất 1 loại dịch vụ';
        if (formData.supportedVehicleTypes.length === 0) newErrors.supportedVehicleTypes = 'Chọn ít nhất 1 loại phương tiện';
        if (!formData.serviceRadiusKm || formData.serviceRadiusKm < 5 || formData.serviceRadiusKm > 50) {
            newErrors.serviceRadiusKm = 'Bán kính từ 5-50km';
        }

        if (formData.providerType === 'BUSINESS') {
            if (!formData.businessName.trim()) newErrors.businessName = 'Tên doanh nghiệp là bắt buộc';
            if (!formData.businessAddress.addressText) newErrors.businessAddress = 'Địa chỉ doanh nghiệp là bắt buộc';
        } else {
            if (!formData.permanentAddress.addressText) newErrors.permanentAddress = 'Địa chỉ thường trú là bắt buộc';
        }

        // Validate rescue vehicles
        if (!formData.rescueVehicles || formData.rescueVehicles.length === 0) {
            newErrors.rescueVehicles = 'Phải có ít nhất một phương tiện cứu hộ';
        } else {
            formData.rescueVehicles.forEach((vehicle: any, index: number) => {
                if (!vehicle.plateNumber.trim()) {
                    newErrors[`rescueVehicle_${index}_plateNumber`] = 'Biển số xe không được để trống';
                } else if (!isValidVietnamPlate(vehicle.plateNumber)) {
                    newErrors[`rescueVehicle_${index}_plateNumber`] = 'Biển số không hợp lệ';
                }
            });
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = () => {
        if (validate()) {
            onComplete(formData);
        }
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Thông tin dịch vụ</h2>
                <p className="text-gray-600">Cung cấp thông tin về dịch vụ cứu hộ của bạn</p>
            </div>

            {/* Provider Type Section */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b-2 border-blue-600">
                    <User className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Thông tin cơ bản</h3>
                </div>

                <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-900">
                        Loại nhà cung cấp
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { value: 'INDIVIDUAL', label: 'Cá nhân' },
                            { value: 'BUSINESS', label: 'Doanh nghiệp' },
                        ].map((type) => (
                            <label
                                key={type.value}
                                className={`flex items-center justify-center p-4 border-2 rounded-lg cursor-pointer transition-all ${formData.providerType === type.value
                                    ? 'border-blue-600 bg-blue-50'
                                    : 'border-gray-300 hover:border-blue-400 bg-white'
                                    }`}
                            >
                                <input
                                    type="radio"
                                    value={type.value}
                                    checked={formData.providerType === type.value}
                                    onChange={(e) => setFormData({ ...formData, providerType: e.target.value as any })}
                                    className="hidden"
                                />
                                <span className={`font-medium ${formData.providerType === type.value ? 'text-blue-700' : 'text-gray-600'
                                    }`}>{type.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>

            {/* Full Name */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-900">
                    Họ và tên <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className={`appearance-none relative block w-full px-3 py-2 border placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm ${errors.fullName ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                    placeholder="Nhập họ và tên đầy đủ"
                />
                {errors.fullName && (
                    <p className="text-sm text-red-600">{errors.fullName}</p>
                )}
            </div>

            {/* Phone */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-900">
                    Số điện thoại <span className="text-red-500">*</span>
                </label>
                <input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    className={`appearance-none relative block w-full px-3 py-2 border placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm ${errors.phoneNumber ? 'border-red-500 bg-red-50' : 'border-gray-300'
                        }`}
                    placeholder="0123456789"
                />
                {errors.phoneNumber && (
                    <p className="text-sm text-red-600">{errors.phoneNumber}</p>
                )}
            </div>

            {/* Business Name (if BUSINESS) */}
            {formData.providerType === 'BUSINESS' && (
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-900">
                        Tên doanh nghiệp <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={formData.businessName}
                        onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                        className={`appearance-none relative block w-full px-3 py-2 border placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm ${errors.businessName ? 'border-red-500 bg-red-50' : 'border-gray-300'
                            }`}
                        placeholder="Nhập tên doanh nghiệp"
                    />
                    {errors.businessName && (
                        <p className="text-sm text-red-600">{errors.businessName}</p>
                    )}
                </div>
            )}

            {/* Service Configuration Section */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b-2 border-blue-600">
                    <Briefcase className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Cấu hình dịch vụ</h3>
                </div>

                {/* Service Types */}
                <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-900">
                        Loại dịch vụ <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        {SERVICE_TYPES.map((service) => (
                            <label
                                key={service.value}
                                className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${formData.serviceTypes.includes(service.value)
                                    ? 'border-blue-600 bg-blue-50'
                                    : 'border-gray-300 hover:border-blue-400 bg-white'
                                    }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={formData.serviceTypes.includes(service.value)}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setFormData({ ...formData, serviceTypes: [...formData.serviceTypes, service.value] });
                                        } else {
                                            setFormData({ ...formData, serviceTypes: formData.serviceTypes.filter((t: string) => t !== service.value) });
                                        }
                                    }}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <span className={`text-sm font-medium ${formData.serviceTypes.includes(service.value) ? 'text-blue-700' : 'text-gray-600'
                                    }`}>{service.label}</span>
                            </label>
                        ))}
                    </div>
                    {errors.serviceTypes && (
                        <p className="text-sm text-red-600">{errors.serviceTypes}</p>
                    )}
                </div>

                {/* Vehicle Types */}
                <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-900">
                        Loại phương tiện hỗ trợ <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        {VEHICLE_TYPES.map((vehicle) => (
                            <label
                                key={vehicle.value}
                                className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${formData.supportedVehicleTypes.includes(vehicle.value)
                                    ? 'border-blue-600 bg-blue-50'
                                    : 'border-gray-300 hover:border-blue-400 bg-white'
                                    }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={formData.supportedVehicleTypes.includes(vehicle.value)}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setFormData({ ...formData, supportedVehicleTypes: [...formData.supportedVehicleTypes, vehicle.value] });
                                        } else {
                                            setFormData({ ...formData, supportedVehicleTypes: formData.supportedVehicleTypes.filter((t: string) => t !== vehicle.value) });
                                        }
                                    }}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <span className={`font-medium ${formData.supportedVehicleTypes.includes(vehicle.value) ? 'text-blue-700' : 'text-gray-600'
                                    }`}>
                                    {vehicle.label}
                                </span>
                            </label>
                        ))}
                    </div>
                    {errors.supportedVehicleTypes && (
                        <p className="text-sm text-red-600">{errors.supportedVehicleTypes}</p>
                    )}
                </div>

                {/* Service Radius */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
                        <Ruler className="w-4 h-4 text-gray-600" />
                        Bán kính phục vụ (km) <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-4">
                        <input
                            type="range"
                            min="5"
                            max="50"
                            value={formData.serviceRadiusKm}
                            onChange={(e) => setFormData({ ...formData, serviceRadiusKm: parseInt(e.target.value) || 0 })}
                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <div className="flex items-center gap-2 min-w-[100px]">
                            <input
                                type="number"
                                min="5"
                                max="50"
                                value={formData.serviceRadiusKm}
                                onChange={(e) => setFormData({ ...formData, serviceRadiusKm: parseInt(e.target.value) || 0 })}
                                className="appearance-none relative block w-20 px-3 py-2 border border-gray-300 text-gray-900 rounded-md text-center font-semibold focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                            />
                            <span className="text-gray-600">km</span>
                        </div>
                    </div>
                    {errors.serviceRadiusKm && (
                        <p className="text-sm text-red-600">{errors.serviceRadiusKm}</p>
                    )}
                    <p className="text-xs text-gray-500">Khoảng cách tối đa bạn sẵn sàng di chuyển để cung cấp dịch vụ</p>
                </div>
            </div>

            {/* Location Section */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b-2 border-blue-600">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Vị trí hoạt động</h3>
                </div>

                {/* Base Location */}
                <div className="space-y-2 relative">
                    <label className="block text-sm font-medium text-gray-900">
                        Địa chỉ {formData.providerType === 'BUSINESS' ? 'doanh nghiệp' : 'thường trú'} <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            value={addressQuery || (formData.providerType === 'INDIVIDUAL' ? formData.permanentAddress.addressText : formData.businessAddress.addressText)}
                            onChange={(e) => {
                                setAddressQuery(e.target.value);
                                setAddressSelected(false); // Reset flag when user types manually
                            }}
                            onFocus={() => {
                                if (!addressSelected && addressQuery.trim().length >= 2) {
                                    setShowSuggestions(true);
                                }
                            }}
                            onBlur={() => {
                                // Delay hiding to allow click on suggestion
                                setTimeout(() => setShowSuggestions(false), 200);
                            }}
                            className={`appearance-none relative block w-full px-3 py-2 border placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm ${errors.permanentAddress || errors.businessAddress ? 'border-red-500 bg-red-50' : 'border-gray-300'
                                }`}
                            placeholder="Tìm kiếm địa chỉ..."
                        />
                    </div>
                    {showSuggestions && addressSuggestions.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {addressSuggestions.map((place, index) => (
                                <div
                                    key={place.refId || index}
                                    onClick={() => handleSelectAddress(place)}
                                    className="px-4 py-3 hover:bg-blue-50 cursor-pointer transition-colors border-b last:border-b-0"
                                >
                                    <span className="text-sm text-gray-900">{place.displayName}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {(errors.permanentAddress || errors.businessAddress) && (
                        <p className="text-sm text-red-600">{errors.permanentAddress || errors.businessAddress}</p>
                    )}
                </div>

                {/* Rescue Vehicles Section */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b-2 border-blue-600">
                        <Car className="w-5 h-5 text-blue-600" />
                        <h3 className="text-lg font-semibold text-gray-900">Phương tiện cứu hộ</h3>
                    </div>
                    <p className="text-sm text-gray-600">Bạn sử dụng phương tiện nào để đi cứu hộ? (Có thể thêm nhiều xe)</p>

                    <div className="space-y-3">
                        {formData.rescueVehicles.map((vehicle: any, index: number) => (
                            <div key={index} className="flex gap-2 items-start p-3 border border-gray-200 rounded-md bg-gray-50">
                                <div className="flex-1 space-y-2">
                                    <select
                                        value={vehicle.type}
                                        onChange={(e) => {
                                            const newVehicles = [...formData.rescueVehicles];
                                            newVehicles[index].type = e.target.value;
                                            setFormData({ ...formData, rescueVehicles: newVehicles });
                                        }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white"
                                    >
                                        <option value="CAR">Ô tô</option>
                                        <option value="MOTORCYCLE">Xe máy</option>
                                    </select>

                                    <input
                                        type="text"
                                        value={vehicle.plateNumber}
                                        onChange={(e) => {
                                            const value = e.target.value.toUpperCase();
                                            const newVehicles = [...formData.rescueVehicles];
                                            newVehicles[index].plateNumber = value;
                                            setFormData({ ...formData, rescueVehicles: newVehicles });

                                            // Clear error
                                            const errorKey = `rescueVehicle_${index}_plateNumber`;
                                            if (errors[errorKey]) {
                                                const { [errorKey]: _, ...rest } = errors;
                                                setErrors(rest);
                                            }
                                        }}
                                        onBlur={(e) => {
                                            // Auto-format on blur if valid
                                            const value = e.target.value;
                                            if (value && isValidVietnamPlate(value)) {
                                                const formatted = formatVietnamPlate(value);
                                                const newVehicles = [...formData.rescueVehicles];
                                                newVehicles[index].plateNumber = formatted;
                                                setFormData({ ...formData, rescueVehicles: newVehicles });
                                            }
                                        }}
                                        className={`w-full px-3 py-2 border rounded-md text-sm font-mono text-gray-900 uppercase ${errors[`rescueVehicle_${index}_plateNumber`] ? 'border-red-500 bg-red-50' :
                                            vehicle.plateNumber && isValidVietnamPlate(vehicle.plateNumber) ? 'border-green-500 bg-green-50' :
                                                'border-gray-300 bg-white'
                                            }`}
                                        placeholder="VD: 29A-12345"
                                    />

                                    {errors[`rescueVehicle_${index}_plateNumber`] && (
                                        <p className="text-xs text-red-600">{errors[`rescueVehicle_${index}_plateNumber`]}</p>
                                    )}
                                    {!errors[`rescueVehicle_${index}_plateNumber`] && vehicle.plateNumber && isValidVietnamPlate(vehicle.plateNumber) && (
                                        <p className="text-xs text-green-600">✓ Biển số hợp lệ (định dạng: 29A-12345)</p>
                                    )}
                                    {!errors[`rescueVehicle_${index}_plateNumber`] && vehicle.plateNumber && !isValidVietnamPlate(vehicle.plateNumber) && (
                                        <p className="text-xs text-gray-500">Nhập đúng định dạng: 29A-12345 hoặc 51AB-12345</p>
                                    )}
                                </div>

                                {formData.rescueVehicles.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const newVehicles = formData.rescueVehicles.filter((_: any, i: number) => i !== index);
                                            if (vehicle.isPrimary && newVehicles.length > 0) {
                                                newVehicles[0].isPrimary = true;
                                            }
                                            setFormData({ ...formData, rescueVehicles: newVehicles });
                                        }}
                                        className="mt-2 p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        ))}

                        <button
                            type="button"
                            onClick={() => {
                                setFormData({
                                    ...formData,
                                    rescueVehicles: [
                                        ...formData.rescueVehicles,
                                        { type: 'CAR', plateNumber: '', isPrimary: false }
                                    ]
                                });
                            }}
                            className="w-full py-2 px-3 border-2 border-dashed border-gray-300 rounded-md text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
                        >
                            + Thêm phương tiện
                        </button>
                    </div>
                    {errors.rescueVehicles && <p className="text-sm text-red-600">{errors.rescueVehicles}</p>}
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-6 border-t">
                <button
                    onClick={onBack}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                    Quay lại
                </button>
                <button
                    onClick={handleSubmit}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
                >
                    Tiếp tục
                </button>
            </div>
        </div>
    );
}
