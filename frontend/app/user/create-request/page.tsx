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

const C = {
    orange: '#f97316',
    orangeDark: '#ea6c0a',
    orangeLight: '#fff7ed',
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#f1f5f9',
    bg: '#f8fafc',
    white: '#ffffff',
};

const INCIDENT_TYPES = [
    {
        value: 'BREAKDOWN',
        label: 'Hỏng xe',
        icon: (
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        ),
    },
    {
        value: 'ACCIDENT',
        label: 'Tai nạn',
        icon: (
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
        ),
    },
    {
        value: 'FLAT_TIRE',
        label: 'Lốp hỏng',
        icon: (
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" />
            </svg>
        ),
    },
    {
        value: 'BATTERY_DEAD',
        label: 'Hết bình',
        icon: (
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <rect x="2" y="7" width="18" height="10" rx="2" /><path d="M22 11v2" strokeLinecap="round" />
            </svg>
        ),
    },
    {
        value: 'OUT_OF_FUEL',
        label: 'Hết xăng',
        icon: (
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
        ),
    },
    {
        value: 'LOCKED_OUT',
        label: 'Khóa xe',
        icon: (
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
        ),
    },
    {
        value: 'OTHER',
        label: 'Khác',
        icon: (
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
    },
];

const VEHICLE_TYPE_LABELS: Record<string, string> = { CAR: 'Ô tô', MOTORCYCLE: 'Xe máy' };

function SectionHeader({ step, title, icon }: { step: number; title: string; icon: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3 mb-4">
            <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ background: C.orange }}
            >
                {step}
            </div>
            <div className="flex items-center gap-2">
                <span style={{ color: C.orange }}>{icon}</span>
                <h2 className="font-semibold text-sm" style={{ color: C.navy }}>{title}</h2>
            </div>
        </div>
    );
}

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
        vehicleIndex: 0,
        incidentLocation: null as LocationData | null,
        contactPhone: '',
        description: '',
        images: [] as Array<{ objectKey: string; publicUrl: string }>,
        videoUrls: [] as string[],
        videoUploadIds: [] as string[],
    });

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await api.get('/me/profile');
                const profile = response.data;
                setUserProfile(profile);
                const userVehicles: Vehicle[] = [];
                if (profile.vehicleType && profile.licensePlate) {
                    userVehicles.push({ type: profile.vehicleType, licensePlate: profile.licensePlate, color: profile.vehicleColor });
                }
                setVehicles(userVehicles);
                if (profile.phoneNumber) {
                    setFormData(prev => ({ ...prev, contactPhone: profile.phoneNumber }));
                }
            } catch (error) {
                console.error('Error fetching profile:', error);
            } finally {
                setIsLoadingProfile(false);
            }
        };
        if (isReady) fetchProfile();
    }, [isReady]);

    const fetchLocation = async () => {
        if (!('geolocation' in navigator)) { toast.error('Trình duyệt không hỗ trợ định vị'); return; }
        setIsLoadingLocation(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                const address = await reverseGeocode(latitude, longitude);
                const location = { addressText: address, lat: latitude, lng: longitude };
                setCurrentLocation(location);
                setLocationTimestamp(new Date());
                setIsLoadingLocation(false);
            },
            (error) => {
                setIsLoadingLocation(false);
                toast.error(`Không thể lấy vị trí: ${error.message}`);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    };

    useEffect(() => { fetchLocation(); }, []);

    const handleAddVehicle = () => {
        if (!newVehicle.licensePlate.trim()) { toast.error('Vui lòng nhập biển số xe'); return; }
        const vehicle: Vehicle = { type: newVehicle.type, licensePlate: newVehicle.licensePlate.trim(), color: newVehicle.color.trim() || undefined };
        setVehicles(prev => [...prev, vehicle]);
        setFormData(prev => ({ ...prev, vehicleIndex: vehicles.length }));
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
                mediaObjectKeys: formData.images.map(img => img.objectKey),
                videoUploadIds: formData.videoUploadIds,
                videoUrls: formData.videoUrls,
            };
            const response = await api.post('/rescue-requests', payload);
            toast.success('Tạo yêu cầu cứu hộ thành công!');
            router.push(`/user/requests/${response.data.id}`);
        } catch (error: any) {
            toast.error(`Lỗi: ${error.response?.data?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.'}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleImageUploadSuccess = (objectKey: string, publicUrl: string) => {
        setFormData(prev => ({ ...prev, images: [...prev.images, { objectKey, publicUrl }] }));
    };
    const handleImageRemove = (objectKey: string) => {
        setFormData(prev => ({ ...prev, images: prev.images.filter(img => img.objectKey !== objectKey) }));
    };

    if (!isReady || isLoadingProfile) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: C.orange }}></div>
            </div>
        );
    }

    const inputStyle = {
        width: '100%',
        padding: '10px 14px',
        borderRadius: '10px',
        border: `1.5px solid #e5e7eb`,
        color: C.navy,
        fontSize: '14px',
        outline: 'none',
        background: C.white,
    };

    return (
        <div className="min-h-screen" style={{ background: C.bg, fontFamily: 'Poppins, sans-serif', paddingBottom: '88px' }}>

            {/* ── Sticky Top Bar ── */}
            <header
                className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3"
                style={{ background: C.white, borderBottom: `1px solid ${C.border}` }}
            >
                <button
                    onClick={() => router.back()}
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                    style={{ background: C.bg, color: C.navy }}
                >
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div>
                    <h1 className="font-bold text-base leading-tight" style={{ color: C.navy }}>Tạo yêu cầu cứu hộ</h1>
                    <p className="text-xs" style={{ color: C.gray }}>Điền thông tin để gọi cứu hộ ngay</p>
                </div>
            </header>

            <form onSubmit={handleSubmit}>
                <div className="px-4 py-5 space-y-4 max-w-2xl mx-auto">

                    {/* ── 1. Incident Type ── */}
                    <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                        <SectionHeader
                            step={1}
                            title="Loại sự cố"
                            icon={<svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                        />
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                            {INCIDENT_TYPES.map((type) => {
                                const active = formData.incidentType === type.value;
                                return (
                                    <button
                                        key={type.value}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, incidentType: type.value })}
                                        className="flex flex-col items-center gap-2 py-3 px-1 rounded-xl transition-all active:scale-95"
                                        style={{
                                            border: `1.5px solid ${active ? C.orange : '#e5e7eb'}`,
                                            background: active ? C.orangeLight : C.white,
                                            color: active ? C.orange : C.gray,
                                        }}
                                    >
                                        <span style={{ color: active ? C.orange : '#94a3b8' }}>{type.icon}</span>
                                        <span className="text-[11px] font-medium leading-tight text-center" style={{ color: active ? C.orange : C.navy }}>{type.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── 2. Vehicle ── */}
                    <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                        <SectionHeader
                            step={2}
                            title="Phương tiện gặp nạn"
                            icon={<svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13l1.5-4.5A2 2 0 016.4 7h11.2a2 2 0 011.9 1.5L21 13m-18 0v5a1 1 0 001 1h1a1 1 0 001-1v-1h12v1a1 1 0 001 1h1a1 1 0 001-1v-5m-18 0h18M6 13h.01M18 13h.01" /></svg>}
                        />
                        {vehicles.length === 0 ? (
                            <div className="text-center py-6 rounded-xl" style={{ border: `1.5px dashed #e5e7eb` }}>
                                <div className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ background: C.orangeLight }}>
                                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                                </div>
                                <p className="text-xs mb-3" style={{ color: C.gray }}>Chưa có xe, hãy thêm để tạo yêu cầu</p>
                                <button
                                    type="button"
                                    onClick={() => setShowAddVehicle(true)}
                                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                                    style={{ background: C.orange }}
                                >
                                    + Thêm xe
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {vehicles.map((vehicle, index) => {
                                    const active = formData.vehicleIndex === index;
                                    return (
                                        <button
                                            key={index}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, vehicleIndex: index })}
                                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left"
                                            style={{
                                                border: `1.5px solid ${active ? C.orange : '#e5e7eb'}`,
                                                background: active ? C.orangeLight : C.white,
                                            }}
                                        >
                                            <div
                                                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                                                style={{ background: active ? C.orange : '#f1f5f9', color: active ? 'white' : C.gray }}
                                            >
                                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13l1.5-4.5A2 2 0 016.4 7h11.2a2 2 0 011.9 1.5L21 13m-18 0v5a1 1 0 001 1h1a1 1 0 001-1v-1h12v1a1 1 0 001 1h1a1 1 0 001-1v-5m-18 0h18M6 13h.01M18 13h.01" /></svg>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold" style={{ color: active ? C.orange : C.navy }}>
                                                    {VEHICLE_TYPE_LABELS[vehicle.type]} — {vehicle.licensePlate}
                                                </p>
                                                {vehicle.color && <p className="text-xs" style={{ color: C.gray }}>Màu: {vehicle.color}</p>}
                                            </div>
                                            {active && (
                                                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.orange }}>
                                                    <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                                <button
                                    type="button"
                                    onClick={() => setShowAddVehicle(true)}
                                    className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                                    style={{ color: C.orange, background: C.orangeLight, border: `1.5px dashed ${C.orange}50` }}
                                >
                                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                                    Thêm xe mới
                                </button>
                            </div>
                        )}

                        {/* Add Vehicle Form */}
                        {showAddVehicle && (
                            <div className="mt-3 p-4 rounded-xl space-y-3" style={{ background: C.bg, border: `1.5px solid ${C.border}` }}>
                                <p className="text-sm font-semibold" style={{ color: C.navy }}>Thêm xe mới</p>
                                {/* Vehicle type toggle */}
                                <div className="flex gap-2">
                                    {['CAR', 'MOTORCYCLE'].map(t => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => setNewVehicle({ ...newVehicle, type: t as 'CAR' | 'MOTORCYCLE' })}
                                            className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
                                            style={{
                                                background: newVehicle.type === t ? C.orange : C.white,
                                                color: newVehicle.type === t ? 'white' : C.gray,
                                                border: `1.5px solid ${newVehicle.type === t ? C.orange : '#e5e7eb'}`,
                                            }}
                                        >
                                            {t === 'CAR' ? 'Ô tô' : 'Xe máy'}
                                        </button>
                                    ))}
                                </div>
                                <input
                                    type="text"
                                    value={newVehicle.licensePlate}
                                    onChange={e => setNewVehicle({ ...newVehicle, licensePlate: e.target.value.toUpperCase() })}
                                    placeholder="Biển số xe (VD: 29A-12345)"
                                    style={inputStyle}
                                    onFocus={e => (e.target.style.border = `1.5px solid ${C.orange}`)}
                                    onBlur={e => (e.target.style.border = '1.5px solid #e5e7eb')}
                                />
                                <input
                                    type="text"
                                    value={newVehicle.color}
                                    onChange={e => setNewVehicle({ ...newVehicle, color: e.target.value })}
                                    placeholder="Màu xe (VD: Đen, Đỏ...)"
                                    style={inputStyle}
                                    onFocus={e => (e.target.style.border = `1.5px solid ${C.orange}`)}
                                    onBlur={e => (e.target.style.border = '1.5px solid #e5e7eb')}
                                />
                                <div className="flex gap-2">
                                    <button type="button" onClick={handleAddVehicle} className="flex-1 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: C.orange }}>Thêm</button>
                                    <button type="button" onClick={() => setShowAddVehicle(false)} className="flex-1 py-2 rounded-xl text-sm font-medium" style={{ background: C.white, color: C.gray, border: `1px solid #e5e7eb` }}>Hủy</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── 3. Incident Location ── */}
                    <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                        <SectionHeader
                            step={3}
                            title="Vị trí gặp nạn"
                            icon={<svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                        />
                        <LocationPicker
                            label="Chọn vị trí hiện tại của bạn"
                            value={formData.incidentLocation}
                            onChange={(location) => setFormData({ ...formData, incidentLocation: location })}
                            placeholder="Tìm kiếm địa điểm gặp nạn..."
                            required
                        />
                        {/* Current Location Card */}
                        <div className="mt-3 rounded-xl overflow-hidden" style={{ border: `1.5px solid ${isLoadingLocation ? C.border : currentLocation ? C.orange + '40' : C.border}`, background: currentLocation ? C.orangeLight : C.bg }}>
                            {isLoadingLocation ? (
                                <div className="flex items-center gap-3 px-4 py-3">
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 flex-shrink-0" style={{ borderColor: C.orange, borderTopColor: 'transparent' }}></div>
                                    <span className="text-sm" style={{ color: C.gray }}>Đang lấy vị trí của bạn...</span>
                                </div>
                            ) : currentLocation ? (
                                <div className="px-4 py-3">
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: C.orange }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" /></svg>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold mb-0.5" style={{ color: C.orange }}>Vị trí hiện tại của bạn</p>
                                            <p className="text-sm leading-snug" style={{ color: C.navy }}>{currentLocation.addressText}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={fetchLocation}
                                            title="Làm mới vị trí"
                                            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-opacity hover:opacity-70"
                                            style={{ background: C.orange + '20', color: C.orange }}
                                        >
                                            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, incidentLocation: currentLocation }))}
                                        className="mt-2.5 w-full py-2 rounded-lg text-sm font-semibold transition-all active:scale-[0.98]"
                                        style={{ background: C.orange, color: 'white' }}
                                    >
                                        Dùng vị trí này
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={fetchLocation}
                                    className="w-full flex items-center gap-3 px-4 py-3 transition-opacity hover:opacity-70"
                                >
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.border }}>
                                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.gray} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    </div>
                                    <span className="text-sm" style={{ color: C.gray }}>Nhấn để lấy vị trí hiện tại</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ── 4. Contact Phone ── */}
                    <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                        <SectionHeader
                            step={4}
                            title="Thông tin liên hệ"
                            icon={<svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>}
                        />
                        <label className="block text-xs font-medium mb-1.5" style={{ color: C.gray }}>
                            Số điện thoại <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                            type="tel"
                            value={formData.contactPhone}
                            onChange={e => setFormData({ ...formData, contactPhone: e.target.value })}
                            placeholder="Nhập số điện thoại liên hệ"
                            style={inputStyle}
                            onFocus={e => (e.target.style.border = `1.5px solid ${C.orange}`)}
                            onBlur={e => (e.target.style.border = '1.5px solid #e5e7eb')}
                            required
                        />
                        <p className="mt-1.5 text-xs" style={{ color: C.gray }}>Provider sẽ liên hệ qua số này khi nhận yêu cầu</p>
                    </div>

                    {/* ── 5. Description ── */}
                    <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                        <SectionHeader
                            step={5}
                            title="Mô tả chi tiết"
                            icon={<svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" /></svg>}
                        />
                        <textarea
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Mô tả tình trạng xe, vị trí cụ thể, thông tin bổ sung..."
                            rows={3}
                            style={{ ...inputStyle, resize: 'none' }}
                            onFocus={e => (e.target.style.border = `1.5px solid ${C.orange}`)}
                            onBlur={e => (e.target.style.border = '1.5px solid #e5e7eb')}
                        />
                    </div>

                    {/* ── 6. Media ── */}
                    <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                        <SectionHeader
                            step={6}
                            title="Hình ảnh & Video"
                            icon={<svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                        />
                        <div className="space-y-4">
                            <div>
                                <p className="text-xs font-medium mb-2" style={{ color: C.gray }}>Ảnh hiện trường (tối đa 5 ảnh)</p>
                                <ImageUpload
                                    purpose={UploadPurpose.REQUEST_PHOTO}
                                    maxImages={5}
                                    uploadedImages={formData.images}
                                    onSuccess={handleImageUploadSuccess}
                                    onRemove={handleImageRemove}
                                    label=""
                                />
                            </div>
                            <div>
                                <p className="text-xs font-medium mb-2" style={{ color: C.gray }}>Video tình trạng xe (tùy chọn, tối đa 2 video)</p>
                                <VideoUpload
                                    label=""
                                    maxVideos={2}
                                    cloudinaryCloudName={process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || ''}
                                    cloudinaryUploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || ''}
                                    uploadedVideos={formData.videoUrls.map((url, idx) => ({ url, uploadId: formData.videoUploadIds[idx] }))}
                                    onSuccess={(videoUrl, uploadId) => {
                                        setFormData(prev => ({ ...prev, videoUrls: [...prev.videoUrls, videoUrl], videoUploadIds: [...prev.videoUploadIds, uploadId] }));
                                    }}
                                    onRemove={(videoUrl) => {
                                        setFormData(prev => {
                                            const urlIndex = prev.videoUrls.indexOf(videoUrl);
                                            return { ...prev, videoUrls: prev.videoUrls.filter((_, i) => i !== urlIndex), videoUploadIds: prev.videoUploadIds.filter((_, i) => i !== urlIndex) };
                                        });
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                </div>

                {/* ── Sticky Submit Bar ── */}
                <div
                    className="fixed bottom-0 left-0 right-0 z-20 px-4 py-3"
                    style={{ background: C.white, borderTop: `1px solid ${C.border}`, boxShadow: '0 -4px 20px rgba(0,0,0,0.06)' }}
                >
                    <div className="max-w-2xl mx-auto flex gap-3">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="w-14 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                            style={{ background: C.bg, color: C.gray, border: `1px solid ${C.border}` }}
                        >
                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || vehicles.length === 0}
                            className="flex-1 h-12 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98]"
                            style={{
                                background: isLoading || vehicles.length === 0 ? '#fdba74' : `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)`,
                                boxShadow: vehicles.length > 0 ? `0 4px 16px ${C.orange}40` : 'none',
                                cursor: isLoading || vehicles.length === 0 ? 'not-allowed' : 'pointer',
                            }}
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                    </svg>
                                    Đang gửi...
                                </span>
                            ) : (
                                <span className="flex items-center justify-center gap-2">
                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    Tạo yêu cầu cứu hộ
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
