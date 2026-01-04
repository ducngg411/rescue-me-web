'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { User, Phone, Mail, MapPin, Car, Bike, Palette, Loader2, CheckCircle, Save } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { updateUserProfile, UpdateUserProfileData } from '@/lib/auth';
import { searchPlaces, getPlaceDetails, PlaceSearchResult } from '@/lib/vietmap';
import { normalizeVietnamPlate, isValidVietnamPlate } from '@/lib/validators';

const VEHICLE_COLORS = [
    'Trắng', 'Đen', 'Xám', 'Bạc', 'Đỏ', 'Xanh dương', 'Xanh lá', 'Vàng', 'Cam', 'Nâu'
];

export default function UserProfilePage() {
    const router = useRouter();
    const { user, loading, refreshUser } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showCustomColor, setShowCustomColor] = useState(false);
    const addressInputRef = useRef<HTMLInputElement>(null);

    // VietMap Autocomplete states
    const [addressQuery, setAddressQuery] = useState('');
    const [addressSuggestions, setAddressSuggestions] = useState<PlaceSearchResult[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isAddressSelected, setIsAddressSelected] = useState(false); // Flag to prevent re-search after selection
    const suggestionsRef = useRef<HTMLDivElement>(null);

    const [formData, setFormData] = useState<UpdateUserProfileData>({
        fullName: '',
        phoneNumber: '',
        contactEmail: '',
        defaultAddress: undefined,
        vehicleType: 'CAR',
        licensePlate: '',
        vehicleColor: VEHICLE_COLORS[0],
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

        if (user && user.role !== 'USER') {
            router.push('/provider/onboarding');
            return;
        }
    }, [user, loading, router]);

    // VietMap Autocomplete: Search places when user types
    useEffect(() => {
        // Skip search if user has already selected an address
        if (isAddressSelected) {
            return;
        }

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
        }, 300); // Debounce 300ms

        return () => clearTimeout(searchTimeout);
    }, [addressQuery, isAddressSelected]);

    // Close suggestions when clicking outside
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

    // Handle address selection from suggestions
    const handleSelectAddress = async (suggestion: PlaceSearchResult) => {
        setIsAddressSelected(true); // Mark as selected to prevent re-search
        setAddressQuery(suggestion.displayName);
        setShowSuggestions(false);
        setAddressSuggestions([]); // Clear suggestions to prevent re-opening

        // Fetch exact coordinates using Place API
        if (suggestion.refId) {
            try {
                const details = await getPlaceDetails(suggestion.refId);
                if (details) {
                    setFormData(prev => ({
                        ...prev,
                        defaultAddress: {
                            addressText: details.display,
                            lat: details.lat,
                            lng: details.lng,
                        }
                    }));
                }
            } catch (error) {
                console.error('Error getting place details:', error);
            }
        }
    };

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.fullName.trim()) {
            newErrors.fullName = 'Họ tên không được để trống';
        }

        if (!formData.phoneNumber.trim()) {
            newErrors.phoneNumber = 'Số điện thoại không được để trống';
        } else if (!/^0[39][0-9]{8}$/.test(formData.phoneNumber)) {
            newErrors.phoneNumber = 'Số điện thoại không hợp lệ (phải là số VN: 0[39]xxxxxxxx)';
        }

        if (formData.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) {
            newErrors.contactEmail = 'Email không hợp lệ';
        }

        if (!formData.licensePlate.trim()) {
            newErrors.licensePlate = 'Biển số xe không được để trống';
        } else if (!isValidVietnamPlate(formData.licensePlate)) {
            newErrors.licensePlate = 'Biển số xe không hợp lệ (VD: 51A-12345, 51AB-12345)';
        }

        if (!formData.vehicleColor.trim()) {
            newErrors.vehicleColor = 'Màu xe không được để trống';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);
        setErrors({});

        try {
            // Normalize license plate before sending to backend
            const submissionData = {
                ...formData,
                licensePlate: normalizeVietnamPlate(formData.licensePlate),
            };

            await updateUserProfile(submissionData);
            await refreshUser();
            router.push('/');
        } catch (err: any) {
            console.error('Profile update error:', err);

            // Map backend validation errors
            if (err.response?.data?.message) {
                const backendErrors = err.response.data.message;
                if (Array.isArray(backendErrors)) {
                    const errorMap: Record<string, string> = {};
                    backendErrors.forEach((msg: string) => {
                        if (msg.includes('Họ tên')) errorMap.fullName = msg;
                        else if (msg.includes('điện thoại')) errorMap.phoneNumber = msg;
                        else if (msg.includes('Email')) errorMap.contactEmail = msg;
                        else if (msg.includes('Biển số')) errorMap.licensePlate = msg;
                        else if (msg.includes('Màu xe')) errorMap.vehicleColor = msg;
                        else if (msg.includes('phương tiện')) errorMap.vehicleType = msg;
                    });
                    setErrors(errorMap);
                } else {
                    setErrors({ general: backendErrors });
                }
            } else {
                setErrors({ general: 'Có lỗi xảy ra. Vui lòng thử lại.' });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
                    <p className="mt-4 text-sm text-gray-600">Đang tải...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-50 rounded-full mb-3">
                        <User className="w-7 h-7 text-blue-600" />
                    </div>
                    <h1 className="text-2xl font-semibold text-gray-900">Hoàn thiện hồ sơ</h1>
                    <p className="mt-1 text-sm text-gray-600">Cung cấp thông tin phương tiện của bạn</p>
                </div>

                {/* Form Card */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    {errors.general && (
                        <div className="mb-4 border-l-4 border-red-500 bg-red-50 rounded-r-lg p-3">
                            <p className="text-sm text-red-800">{errors.general}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Full Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-900 mb-1.5">
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

                        {/* Phone Number */}
                        <div>
                            <label className="block text-sm font-medium text-gray-900 mb-1.5">
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

                        {/* Contact Email */}
                        <div>
                            <label className="block text-sm font-medium text-gray-900 mb-1.5">
                                Email liên hệ
                            </label>
                            <input
                                type="email"
                                value={formData.contactEmail}
                                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                                className={`w-full px-3 py-2 border rounded-md text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.contactEmail ? 'border-red-500' : 'border-gray-300'}`}
                                placeholder="email@example.com"
                            />
                            {errors.contactEmail && <p className="mt-1 text-xs text-red-600">{errors.contactEmail}</p>}
                        </div>

                        {/* Default Address with VietMap Autocomplete */}
                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-900 mb-1.5">
                                Địa chỉ thường dùng
                            </label>
                            <input
                                ref={addressInputRef}
                                type="text"
                                value={addressQuery}
                                onChange={(e) => {
                                    const newValue = e.target.value;
                                    setAddressQuery(newValue);

                                    // Reset selection flag when user starts typing again
                                    if (isAddressSelected) {
                                        setIsAddressSelected(false);
                                        setFormData(prev => ({ ...prev, defaultAddress: undefined }));
                                    }

                                    if (newValue.trim().length >= 2) {
                                        setShowSuggestions(true);
                                    }
                                }}
                                onFocus={() => {
                                    // Only show suggestions if there are results and user hasn't selected yet
                                    if (addressSuggestions.length > 0 && !isAddressSelected) {
                                        setShowSuggestions(true);
                                    }
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Nhập địa chỉ..."
                                autoComplete="off"
                            />

                            {/* Autocomplete Suggestions Dropdown */}
                            {showSuggestions && (addressSuggestions.length > 0 || isSearching) && (
                                <div
                                    ref={suggestionsRef}
                                    className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto"
                                >
                                    {isSearching ? (
                                        <div className="px-4 py-3 text-sm text-gray-600 flex items-center">
                                            <Loader2 className="w-4 h-4 mr-2 text-blue-600 animate-spin" />
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
                                                    <MapPin className="w-4 h-4 mt-0.5 mr-2 text-gray-400 flex-shrink-0" />
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

                            {/* Display selected address with coordinates */}
                            {formData.defaultAddress && (
                                <div className="mt-2 flex items-start gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                                    <p className="text-xs text-gray-600">
                                        {formData.defaultAddress.addressText}
                                        {formData.defaultAddress.lat && formData.defaultAddress.lng && (
                                            <span className="ml-2 text-gray-400">
                                                ({formData.defaultAddress.lat.toFixed(6)}, {formData.defaultAddress.lng.toFixed(6)})
                                            </span>
                                        )}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Vehicle Type */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Loại phương tiện <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, vehicleType: 'CAR' })}
                                    className={`p-3 border rounded-lg transition-all ${formData.vehicleType === 'CAR'
                                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                                        : 'border-gray-300 hover:border-gray-400'
                                        }`}
                                >
                                    <Car className="w-6 h-6 mx-auto mb-1" />
                                    <p className="text-sm font-medium">Ô tô</p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, vehicleType: 'MOTORCYCLE' })}
                                    className={`p-3 border rounded-lg transition-all ${formData.vehicleType === 'MOTORCYCLE'
                                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                                        : 'border-gray-300 hover:border-gray-400'
                                        }`}
                                >
                                    <Bike className="w-6 h-6 mx-auto mb-1" />
                                    <p className="text-sm font-medium">Xe máy</p>
                                </button>
                            </div>
                        </div>

                        {/* License Plate & Color */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-900 mb-1.5">
                                    Biển số xe <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.licensePlate}
                                    onChange={(e) => {
                                        // Allow user to type freely with dashes, only uppercase
                                        const value = e.target.value.toUpperCase();
                                        setFormData({ ...formData, licensePlate: value });

                                        // Clear error when user is typing
                                        if (errors.licensePlate) {
                                            setErrors(prev => {
                                                const { licensePlate, ...rest } = prev;
                                                return rest;
                                            });
                                        }
                                    }}
                                    onBlur={() => {
                                        // Validate on blur using normalized version (without dashes)
                                        if (formData.licensePlate && !isValidVietnamPlate(formData.licensePlate)) {
                                            setErrors(prev => ({
                                                ...prev,
                                                licensePlate: 'Biển số xe không hợp lệ (VD: 51A-12345, 51AB-12345)'
                                            }));
                                        }
                                    }}
                                    className={`w-full px-3 py-2 border rounded-md text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.licensePlate ? 'border-red-500' : 'border-gray-300'}`}
                                    placeholder="51A-12345"
                                />
                                {errors.licensePlate && <p className="mt-1 text-xs text-red-600">{errors.licensePlate}</p>}
                                {!errors.licensePlate && formData.licensePlate && isValidVietnamPlate(formData.licensePlate) && (
                                    <div className="mt-1 flex items-center gap-1 text-xs text-green-600">
                                        <CheckCircle className="w-3 h-3" />
                                        <span>Biển số hợp lệ</span>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-900 mb-1.5">
                                    Màu xe <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={showCustomColor ? 'custom' : formData.vehicleColor}
                                    onChange={(e) => {
                                        if (e.target.value === 'custom') {
                                            setShowCustomColor(true);
                                            setFormData({ ...formData, vehicleColor: '' });
                                        } else {
                                            setShowCustomColor(false);
                                            setFormData({ ...formData, vehicleColor: e.target.value });
                                        }
                                    }}
                                    className={`w-full px-3 py-2 border rounded-md text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.vehicleColor ? 'border-red-500' : 'border-gray-300'}`}
                                >
                                    {VEHICLE_COLORS.map(color => (
                                        <option key={color} value={color}>{color}</option>
                                    ))}
                                    <option value="custom">Khác...</option>
                                </select>
                                {errors.vehicleColor && <p className="mt-1 text-xs text-red-600">{errors.vehicleColor}</p>}
                            </div>
                        </div>

                        {/* Custom Color Input */}
                        {showCustomColor && (
                            <input
                                type="text"
                                value={formData.vehicleColor}
                                onChange={(e) => setFormData({ ...formData, vehicleColor: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Nhập màu xe..."
                            />
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`w-full mt-6 py-2.5 rounded-md text-white text-sm font-medium transition-all ${isSubmitting
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                                }`}
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
                                'Hoàn thành'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
