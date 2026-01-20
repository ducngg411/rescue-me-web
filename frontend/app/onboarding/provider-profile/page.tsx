'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { updateProviderProfile, UpdateProviderProfileData, RescueVehicle } from '@/lib/auth';
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

const PROVIDER_TYPES = [
    { value: 'INDIVIDUAL', label: 'Cá nhân' },
    { value: 'BUSINESS', label: 'Doanh nghiệp' },
];

export default function ProviderProfilePage() {
    const router = useRouter();
    const { user, loading, refreshUser } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const addressInputRef = useRef<HTMLInputElement>(null);

    // VietMap Autocomplete states
    const [addressQuery, setAddressQuery] = useState('');
    const [addressSuggestions, setAddressSuggestions] = useState<PlaceSearchResult[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isAddressSelected, setIsAddressSelected] = useState(false);
    const suggestionsRef = useRef<HTMLDivElement>(null);

    const [formData, setFormData] = useState({
        providerType: 'INDIVIDUAL' as 'INDIVIDUAL' | 'BUSINESS',
        fullName: '',
        phoneNumber: '',
        businessName: '',
        serviceTypes: [] as string[],
        supportedVehicleTypes: [] as string[],
        serviceRadiusKm: 15,
        permanentAddress: {
            addressText: '',
            lat: 0,
            lng: 0,
        },
        businessAddress: {
            addressText: '',
            lat: 0,
            lng: 0,
        },
        rescueVehicles: [{ type: 'CAR' as 'CAR' | 'MOTORCYCLE', plateNumber: '', isPrimary: true }] as RescueVehicle[],
    });

    useEffect(() => {
        if (!loading && !user) {
            router.push('/auth/login');
            return;
        }

        if (user && user.profileCompleted) {
            router.push('/');
            return;
        }

        if (user && user.role !== 'PROVIDER') {
            router.push('/onboarding/user-profile');
            return;
        }
    }, [user, loading, router]);

    // VietMap Autocomplete
    useEffect(() => {
        if (isAddressSelected) return;

        const searchTimeout = setTimeout(async () => {
            if (addressQuery.trim().length < 2) {
                setAddressSuggestions([]);
                return;
            }

            setIsSearching(true);
            try {
                const results = await searchPlaces(addressQuery);
                setAddressSuggestions(results);
                setShowSuggestions(true);
            } catch (error) {
                console.error('Error searching places:', error);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(searchTimeout);
    }, [addressQuery, isAddressSelected]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                suggestionsRef.current &&
                !suggestionsRef.current.contains(event.target as Node) &&
                addressInputRef.current &&
                !addressInputRef.current.contains(event.target as Node)
            ) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectAddress = async (suggestion: PlaceSearchResult) => {
        setIsAddressSelected(true);
        setAddressQuery(suggestion.displayName);
        setShowSuggestions(false);
        setAddressSuggestions([]);

        if (suggestion.refId) {
            try {
                const details = await getPlaceDetails(suggestion.refId);
                if (details) {
                    const addressData = {
                        addressText: details.display,
                        lat: details.lat,
                        lng: details.lng,
                    };

                    if (formData.providerType === 'INDIVIDUAL') {
                        setFormData(prev => ({ ...prev, permanentAddress: addressData }));
                    } else {
                        setFormData(prev => ({ ...prev, businessAddress: addressData }));
                    }
                }
            } catch (error) {
                console.error('Error getting place details:', error);
            }
        }
    };

    const toggleServiceType = (type: string) => {
        setFormData(prev => ({
            ...prev,
            serviceTypes: prev.serviceTypes.includes(type)
                ? prev.serviceTypes.filter(t => t !== type)
                : [...prev.serviceTypes, type]
        }));
    };

    const toggleVehicleType = (type: string) => {
        setFormData(prev => ({
            ...prev,
            supportedVehicleTypes: prev.supportedVehicleTypes.includes(type)
                ? prev.supportedVehicleTypes.filter(t => t !== type)
                : [...prev.supportedVehicleTypes, type]
        }));
    };

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.fullName.trim()) newErrors.fullName = 'Họ tên không được để trống';
        if (!formData.phoneNumber.trim()) {
            newErrors.phoneNumber = 'Số điện thoại không được để trống';
        } else if (!/^0[39][0-9]{8}$/.test(formData.phoneNumber)) {
            newErrors.phoneNumber = 'Số điện thoại không hợp lệ';
        }

        if (formData.providerType === 'BUSINESS') {
            if (!formData.businessName.trim()) newErrors.businessName = 'Tên doanh nghiệp không được để trống';
            if (!formData.businessAddress.addressText) newErrors.businessAddress = 'Địa chỉ doanh nghiệp không được để trống';
        } else {
            if (!formData.permanentAddress.addressText) newErrors.permanentAddress = 'Địa chỉ thường trú không được để trống';
        }

        if (formData.serviceTypes.length === 0) newErrors.serviceTypes = 'Phải chọn ít nhất một loại dịch vụ';
        if (formData.supportedVehicleTypes.length === 0) newErrors.supportedVehicleTypes = 'Phải chọn ít nhất một loại phương tiện';

        // Validate rescue vehicles
        if (formData.rescueVehicles.length === 0) {
            newErrors.rescueVehicles = 'Phải có ít nhất một phương tiện cứu hộ';
        } else {
            formData.rescueVehicles.forEach((vehicle, index) => {
                if (!vehicle.plateNumber.trim()) {
                    newErrors[`rescueVehicle_${index}_plateNumber`] = 'Biển số xe không được để trống';
                } else if (!isValidVietnamPlate(vehicle.plateNumber)) {
                    newErrors[`rescueVehicle_${index}_plateNumber`] = 'Biển số xe không hợp lệ';
                }
            });
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        setIsSubmitting(true);
        setErrors({});

        try {
            // Normalize rescue vehicle plate numbers
            const normalizedVehicles = formData.rescueVehicles.map(vehicle => ({
                ...vehicle,
                plateNumber: normalizeVietnamPlate(vehicle.plateNumber)
            }));

            const submissionData: UpdateProviderProfileData = {
                providerType: formData.providerType,
                fullName: formData.fullName,
                phoneNumber: formData.phoneNumber,
                serviceTypes: formData.serviceTypes,
                supportedVehicleTypes: formData.supportedVehicleTypes,
                serviceRadiusKm: formData.serviceRadiusKm,
                rescueVehicles: normalizedVehicles,
            };

            if (formData.providerType === 'BUSINESS') {
                submissionData.businessName = formData.businessName;
                submissionData.businessAddress = formData.businessAddress;
            } else {
                submissionData.permanentAddress = formData.permanentAddress;
            }

            await updateProviderProfile(submissionData);
            await refreshUser();
            router.push('/');
        } catch (err: any) {
            console.error('Provider profile error:', err);
            setErrors({ general: err.response?.data?.message || 'Có lỗi xảy ra' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const currentAddress = formData.providerType === 'INDIVIDUAL'
        ? formData.permanentAddress
        : formData.businessAddress;

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
            <div className="max-w-2xl w-full">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-full mb-3">
                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-semibold text-gray-900">Hồ sơ nhà cung cấp</h1>
                    <p className="mt-1 text-sm text-gray-500">Cung cấp thông tin dịch vụ cứu hộ</p>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    {errors.general && (
                        <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 rounded">
                            <p className="text-sm text-red-700">{errors.general}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Loại nhà cung cấp <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                {PROVIDER_TYPES.map(type => (
                                    <button
                                        key={type.value}
                                        type="button"
                                        onClick={() => {
                                            setFormData(prev => ({ ...prev, providerType: type.value as 'INDIVIDUAL' | 'BUSINESS' }));
                                            setAddressQuery('');
                                            setIsAddressSelected(false);
                                        }}
                                        className={`p-3 border rounded-md transition-all ${formData.providerType === type.value
                                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                                            : 'border-gray-300 hover:border-gray-400'
                                            }`}
                                    >
                                        <p className="text-sm font-medium">{type.label}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Họ và tên <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.fullName}
                                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                className={`w-full px-3 py-2 border rounded-md text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.fullName ? 'border-red-500' : 'border-gray-300'}`}
                                placeholder="Nguyễn Văn A"
                            />
                            {errors.fullName && <p className="mt-1 text-xs text-red-600">{errors.fullName}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Số điện thoại <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="tel"
                                value={formData.phoneNumber}
                                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                                className={`w-full px-3 py-2 border rounded-md text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.phoneNumber ? 'border-red-500' : 'border-gray-300'}`}
                                placeholder="0912345678"
                            />
                            {errors.phoneNumber && <p className="mt-1 text-xs text-red-600">{errors.phoneNumber}</p>}
                        </div>

                        {formData.providerType === 'BUSINESS' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Tên doanh nghiệp <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.businessName}
                                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                                    className={`w-full px-3 py-2 border rounded-md text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.businessName ? 'border-red-500' : 'border-gray-300'}`}
                                    placeholder="Cứu hộ ABC"
                                />
                                {errors.businessName && <p className="mt-1 text-xs text-red-600">{errors.businessName}</p>}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Loại dịch vụ <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {SERVICE_TYPES.map(service => (
                                    <button
                                        key={service.value}
                                        type="button"
                                        onClick={() => toggleServiceType(service.value)}
                                        className={`px-3 py-2 border rounded-md text-sm transition-all ${formData.serviceTypes.includes(service.value)
                                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                                            : 'border-gray-300 hover:border-gray-400'
                                            }`}
                                    >
                                        {service.label}
                                    </button>
                                ))}
                            </div>
                            {errors.serviceTypes && <p className="mt-1 text-xs text-red-600">{errors.serviceTypes}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Bạn nhận cứu hộ cho loại phương tiện nào? <span className="text-red-500">*</span>
                            </label>
                            <p className="text-xs text-gray-500 mb-2">Chọn loại xe mà khách hàng cần cứu hộ (có thể chọn nhiều)</p>
                            <div className="grid grid-cols-2 gap-3">
                                {VEHICLE_TYPES.map(vehicle => (
                                    <button
                                        key={vehicle.value}
                                        type="button"
                                        onClick={() => toggleVehicleType(vehicle.value)}
                                        className={`p-3 border rounded-md transition-all ${formData.supportedVehicleTypes.includes(vehicle.value)
                                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                                            : 'border-gray-300 hover:border-gray-400'
                                            }`}
                                    >
                                        <p className="text-sm font-medium">{vehicle.label}</p>
                                    </button>
                                ))}
                            </div>
                            {errors.supportedVehicleTypes && <p className="mt-1 text-xs text-red-600">{errors.supportedVehicleTypes}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Bạn sử dụng phương tiện nào để đi cứu hộ? <span className="text-red-500">*</span>
                            </label>
                            <p className="text-xs text-gray-500 mb-3">Thông tin phương tiện của bạn (có thể thêm nhiều xe)</p>

                            <div className="space-y-3">
                                {formData.rescueVehicles.map((vehicle, index) => (
                                    <div key={index} className="flex gap-2 items-start p-3 border border-gray-200 rounded-md bg-gray-50">
                                        <div className="flex-1 space-y-2">
                                            <select
                                                value={vehicle.type}
                                                onChange={(e) => {
                                                    const newVehicles = [...formData.rescueVehicles];
                                                    newVehicles[index].type = e.target.value as 'CAR' | 'MOTORCYCLE';
                                                    setFormData({ ...formData, rescueVehicles: newVehicles });
                                                }}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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

                                                    // Clear error on change
                                                    const errorKey = `rescueVehicle_${index}_plateNumber`;
                                                    if (errors[errorKey]) {
                                                        const { [errorKey]: _, ...rest } = errors;
                                                        setErrors(rest);
                                                    }
                                                }}
                                                onBlur={() => {
                                                    // Auto-format on blur if valid
                                                    const value = vehicle.plateNumber;
                                                    if (value && isValidVietnamPlate(value)) {
                                                        const formatted = formatVietnamPlate(value);
                                                        const newVehicles = [...formData.rescueVehicles];
                                                        newVehicles[index].plateNumber = formatted;
                                                        setFormData({ ...formData, rescueVehicles: newVehicles });
                                                    } else if (value && !isValidVietnamPlate(value)) {
                                                        setErrors(prev => ({
                                                            ...prev,
                                                            [`rescueVehicle_${index}_plateNumber`]: 'Biển số xe không hợp lệ (VD: 29A-12345, 51AB-12345)'
                                                        }));
                                                    }
                                                }}
                                                className={`w-full px-3 py-2 border rounded-md text-sm font-mono text-gray-900 placeholder:text-gray-400 bg-white uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[`rescueVehicle_${index}_plateNumber`] ? 'border-red-500 bg-red-50' :
                                                        vehicle.plateNumber && isValidVietnamPlate(vehicle.plateNumber) ? 'border-green-500 bg-green-50' :
                                                            'border-gray-300'
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
                                                    const newVehicles = formData.rescueVehicles.filter((_, i) => i !== index);
                                                    // Set first vehicle as primary if we removed the primary one
                                                    if (vehicle.isPrimary && newVehicles.length > 0) {
                                                        newVehicles[0].isPrimary = true;
                                                    }
                                                    setFormData({ ...formData, rescueVehicles: newVehicles });
                                                }}
                                                className="mt-2 p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                                title="Xóa phương tiện"
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
                            {errors.rescueVehicles && <p className="mt-1 text-xs text-red-600">{errors.rescueVehicles}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Bán kính dịch vụ: {formData.serviceRadiusKm} km
                            </label>
                            <input
                                type="range"
                                min="5"
                                max="50"
                                step="5"
                                value={formData.serviceRadiusKm}
                                onChange={(e) => setFormData({ ...formData, serviceRadiusKm: parseInt(e.target.value) })}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>5 km</span>
                                <span>50 km</span>
                            </div>
                        </div>

                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                {formData.providerType === 'INDIVIDUAL' ? 'Địa chỉ thường trú' : 'Địa chỉ doanh nghiệp'} <span className="text-red-500">*</span>
                            </label>
                            <input
                                ref={addressInputRef}
                                type="text"
                                value={addressQuery}
                                onChange={(e) => {
                                    const newValue = e.target.value;
                                    setAddressQuery(newValue);
                                    if (isAddressSelected) {
                                        setIsAddressSelected(false);
                                        if (formData.providerType === 'INDIVIDUAL') {
                                            setFormData(prev => ({ ...prev, permanentAddress: { addressText: '', lat: 0, lng: 0 } }));
                                        } else {
                                            setFormData(prev => ({ ...prev, businessAddress: { addressText: '', lat: 0, lng: 0 } }));
                                        }
                                    }
                                    if (newValue.trim().length >= 2) setShowSuggestions(true);
                                }}
                                onFocus={() => {
                                    if (addressSuggestions.length > 0 && !isAddressSelected) setShowSuggestions(true);
                                }}
                                className={`w-full px-3 py-2 border rounded-md text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${(errors.businessAddress || errors.permanentAddress) ? 'border-red-500' : 'border-gray-300'}`}
                                placeholder="Nhập địa chỉ..."
                                autoComplete="off"
                            />

                            {showSuggestions && (addressSuggestions.length > 0 || isSearching) && (
                                <div ref={suggestionsRef} className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                    {isSearching ? (
                                        <div className="px-4 py-3 text-sm text-gray-500 flex items-center">
                                            <svg className="animate-spin h-4 w-4 mr-2 text-blue-600" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            Đang tìm kiếm...
                                        </div>
                                    ) : (
                                        addressSuggestions.map((suggestion, index) => (
                                            <button
                                                key={index}
                                                type="button"
                                                onClick={() => handleSelectAddress(suggestion)}
                                                className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                                            >
                                                <div className="flex items-start">
                                                    <svg className="w-4 h-4 mt-0.5 mr-2 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    </svg>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-gray-900 truncate">{suggestion.displayName}</p>
                                                        {suggestion.address && suggestion.address !== suggestion.displayName && (
                                                            <p className="text-xs text-gray-500 truncate mt-0.5">{suggestion.address}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}

                            {errors.businessAddress && <p className="mt-1 text-xs text-red-600">{errors.businessAddress}</p>}
                            {errors.permanentAddress && <p className="mt-1 text-xs text-red-600">{errors.permanentAddress}</p>}
                            {currentAddress.addressText && (
                                <p className="mt-1 text-xs text-gray-500">📍 {currentAddress.addressText}</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`w-full mt-6 py-2.5 rounded-md text-white text-sm font-medium transition-all ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                            {isSubmitting ? (
                                <span className="flex items-center justify-center">
                                    <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Đang lưu...
                                </span>
                            ) : (
                                'Lưu bản nháp'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
