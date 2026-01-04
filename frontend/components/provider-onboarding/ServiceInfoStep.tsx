'use client';

import React, { useState, useEffect, useRef } from 'react';
import { searchPlaces, getPlaceDetails, PlaceSearchResult } from '@/lib/vietmap';
import { normalizeVietnamPlate, isValidVietnamPlate } from '@/lib/validators';

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
        carPlateNumber: initialData?.carPlateNumber || '',
        motorcyclePlateNumber: initialData?.motorcyclePlateNumber || '',
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [addressQuery, setAddressQuery] = useState('');
    const [addressSuggestions, setAddressSuggestions] = useState<PlaceSearchResult[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        const searchTimeout = setTimeout(async () => {
            if (addressQuery.trim().length < 2) {
                setAddressSuggestions([]);
                return;
            }

            try {
                const results = await searchPlaces(addressQuery);
                setAddressSuggestions(results);
                setShowSuggestions(true);
            } catch (error) {
                console.error('Error searching places:', error);
            }
        }, 300);

        return () => clearTimeout(searchTimeout);
    }, [addressQuery]);

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

        if (formData.supportedVehicleTypes.includes('CAR')) {
            if (!formData.carPlateNumber.trim()) {
                newErrors.carPlateNumber = 'Biển số ô tô là bắt buộc';
            } else if (!isValidVietnamPlate(formData.carPlateNumber)) {
                newErrors.carPlateNumber = 'Biển số không hợp lệ';
            }
        }

        if (formData.supportedVehicleTypes.includes('MOTORCYCLE')) {
            if (!formData.motorcyclePlateNumber.trim()) {
                newErrors.motorcyclePlateNumber = 'Biển số xe máy là bắt buộc';
            } else if (!isValidVietnamPlate(formData.motorcyclePlateNumber)) {
                newErrors.motorcyclePlateNumber = 'Biển số không hợp lệ';
            }
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
        <div>
            <h2 className="text-2xl font-bold mb-6">Thông tin dịch vụ</h2>

            {/* Provider Type */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Loại nhà cung cấp (Tùy chọn)
                </label>
                <div className="flex gap-4">
                    {[
                        { value: 'INDIVIDUAL', label: 'Cá nhân' },
                        { value: 'BUSINESS', label: 'Doanh nghiệp' },
                    ].map((type) => (
                        <label key={type.value} className="flex items-center cursor-pointer">
                            <input
                                type="radio"
                                value={type.value}
                                checked={formData.providerType === type.value}
                                onChange={(e) => setFormData({ ...formData, providerType: e.target.value as any })}
                                className="mr-2"
                            />
                            <span>{type.label}</span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Full Name */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Họ và tên <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg ${errors.fullName ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.fullName && <p className="mt-1 text-sm text-red-500">{errors.fullName}</p>}
            </div>

            {/* Phone */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Số điện thoại <span className="text-red-500">*</span>
                </label>
                <input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg ${errors.phoneNumber ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.phoneNumber && <p className="mt-1 text-sm text-red-500">{errors.phoneNumber}</p>}
            </div>

            {/* Business Name (if BUSINESS) */}
            {formData.providerType === 'BUSINESS' && (
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tên doanh nghiệp <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={formData.businessName}
                        onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                        className={`w-full px-4 py-2 border rounded-lg ${errors.businessName ? 'border-red-500' : 'border-gray-300'}`}
                    />
                    {errors.businessName && <p className="mt-1 text-sm text-red-500">{errors.businessName}</p>}
                </div>
            )}

            {/* Service Types */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Loại dịch vụ <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                    {SERVICE_TYPES.map((service) => (
                        <label key={service.value} className="flex items-center cursor-pointer p-2 border rounded hover:bg-gray-50">
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
                                className="mr-2"
                            />
                            <span>{service.label}</span>
                        </label>
                    ))}
                </div>
                {errors.serviceTypes && <p className="mt-1 text-sm text-red-500">{errors.serviceTypes}</p>}
            </div>

            {/* Vehicle Types */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Loại phương tiện hỗ trợ <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                    {VEHICLE_TYPES.map((vehicle) => (
                        <label key={vehicle.value} className="flex items-center cursor-pointer p-2 border rounded hover:bg-gray-50">
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
                                className="mr-2"
                            />
                            <span>{vehicle.label}</span>
                        </label>
                    ))}
                </div>
                {errors.supportedVehicleTypes && <p className="mt-1 text-sm text-red-500">{errors.supportedVehicleTypes}</p>}
            </div>

            {/* Service Radius */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bán kính phục vụ (km) <span className="text-red-500">*</span>
                </label>
                <input
                    type="number"
                    min="5"
                    max="50"
                    value={formData.serviceRadiusKm}
                    onChange={(e) => setFormData({ ...formData, serviceRadiusKm: parseInt(e.target.value) || 0 })}
                    className={`w-full px-4 py-2 border rounded-lg ${errors.serviceRadiusKm ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.serviceRadiusKm && <p className="mt-1 text-sm text-red-500">{errors.serviceRadiusKm}</p>}
            </div>

            {/* Base Location */}
            <div className="mb-6 relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Địa chỉ {formData.providerType === 'BUSINESS' ? 'doanh nghiệp' : 'thường trú'} <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    value={addressQuery || (formData.providerType === 'INDIVIDUAL' ? formData.permanentAddress.addressText : formData.businessAddress.addressText)}
                    onChange={(e) => setAddressQuery(e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg ${errors.permanentAddress || errors.businessAddress ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="Tìm kiếm địa chỉ..."
                />
                {showSuggestions && addressSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {addressSuggestions.map((place) => (
                            <div
                                key={place.refId}
                                onClick={() => handleSelectAddress(place)}
                                className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                            >
                                {place.displayName}
                            </div>
                        ))}
                    </div>
                )}
                {(errors.permanentAddress || errors.businessAddress) && (
                    <p className="mt-1 text-sm text-red-500">{errors.permanentAddress || errors.businessAddress}</p>
                )}
            </div>

            {/* Plate Numbers */}
            {formData.supportedVehicleTypes.includes('CAR') && (
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Biển số ô tô <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={formData.carPlateNumber}
                        onChange={(e) => setFormData({ ...formData, carPlateNumber: normalizeVietnamPlate(e.target.value) })}
                        className={`w-full px-4 py-2 border rounded-lg ${errors.carPlateNumber ? 'border-red-500' : 'border-gray-300'}`}
                        placeholder="VD: 29A-12345"
                    />
                    {errors.carPlateNumber && <p className="mt-1 text-sm text-red-500">{errors.carPlateNumber}</p>}
                </div>
            )}

            {formData.supportedVehicleTypes.includes('MOTORCYCLE') && (
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Biển số xe máy <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={formData.motorcyclePlateNumber}
                        onChange={(e) => setFormData({ ...formData, motorcyclePlateNumber: normalizeVietnamPlate(e.target.value) })}
                        className={`w-full px-4 py-2 border rounded-lg ${errors.motorcyclePlateNumber ? 'border-red-500' : 'border-gray-300'}`}
                        placeholder="VD: 29B1-12345"
                    />
                    {errors.motorcyclePlateNumber && <p className="mt-1 text-sm text-red-500">{errors.motorcyclePlateNumber}</p>}
                </div>
            )}

            {/* Actions */}
            <div className="flex justify-between mt-8">
                <button
                    onClick={onBack}
                    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                    Quay lại
                </button>
                <button
                    onClick={handleSubmit}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    Tiếp tục
                </button>
            </div>
        </div>
    );
}
