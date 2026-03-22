'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useGuest } from '@/contexts/GuestContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    sendPhoneOtp,
    verifyOtpAndCreateSession,
    clearRecaptchaVerifier,
} from '@/lib/guest-auth';
import { uploadGuestImage } from '@/lib/guest-upload';
import VideoUpload from '@/components/VideoUpload';
import LocationPicker from '@/components/LocationPicker';
import { reverseGeocode } from '@/lib/vietmap';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { ConfirmationResult } from 'firebase/auth';

// ── Constants ──────────────────────────────────────────────────────────────────

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
        value: 'BREAKDOWN', label: 'Hỏng xe',
        icon: <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    },
    {
        value: 'ACCIDENT', label: 'Tai nạn',
        icon: <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
    },
    {
        value: 'FLAT_TIRE', label: 'Lốp hỏng',
        icon: <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /></svg>,
    },
    {
        value: 'BATTERY_DEAD', label: 'Hết bình',
        icon: <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="2" y="7" width="18" height="10" rx="2" /><path d="M22 11v2" strokeLinecap="round" /></svg>,
    },
    {
        value: 'OUT_OF_FUEL', label: 'Hết xăng',
        icon: <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    },
    {
        value: 'LOCKED_OUT', label: 'Khóa xe',
        icon: <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
    },
    {
        value: 'OTHER', label: 'Khác',
        icon: <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
];

interface LocationData { addressText: string; lat: number; lng: number }
interface Vehicle { type: 'CAR' | 'MOTORCYCLE'; licensePlate: string; color?: string }
type Step = 'phone' | 'otp' | 'form';

function SectionHeader({ step, title, icon }: { step: number; title: string; icon: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3 mb-4">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: C.orange }}>{step}</div>
            <div className="flex items-center gap-2">
                <span style={{ color: C.orange }}>{icon}</span>
                <h2 className="font-semibold text-sm" style={{ color: C.navy }}>{title}</h2>
            </div>
        </div>
    );
}

// ── Image upload for guest (same visual style as VideoUpload) ─────────────────
function GuestImageUploader({
    images,
    onAdd,
    onRemove,
}: {
    images: Array<{ objectKey: string; publicUrl: string }>;
    onAdd: (objectKey: string, publicUrl: string) => void;
    onRemove: (objectKey: string) => void;
}) {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPendingFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        if (inputRef.current) inputRef.current.value = '';
    };

    const handleUpload = async () => {
        if (!pendingFile) return;
        setUploading(true);
        setProgress(0);
        const result = await uploadGuestImage(pendingFile, setProgress);
        setUploading(false);
        if (result.success && result.objectKey && result.publicUrl) {
            onAdd(result.objectKey, result.publicUrl);
            setPendingFile(null);
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
        } else {
            toast.error(result.error || 'Upload thất bại');
        }
    };

    const handleCancel = () => {
        setPendingFile(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        if (inputRef.current) inputRef.current.value = '';
    };

    const canAddMore = images.length < 5;

    return (
        <div className="space-y-3">
            {/* Drop zone — shown when no images yet */}
            {images.length === 0 && !uploading && !pendingFile && (
                <div
                    onClick={() => inputRef.current?.click()}
                    className="relative rounded-xl p-5 text-center cursor-pointer transition-all"
                    style={{ border: `2px dashed ${C.border}`, background: C.bg }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.orange; (e.currentTarget as HTMLDivElement).style.background = C.orangeLight; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.border; (e.currentTarget as HTMLDivElement).style.background = C.bg; }}
                >
                    <div className="flex flex-col items-center gap-2.5">
                        <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: C.orangeLight }}>
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-sm font-semibold" style={{ color: C.navy }}>Nhấn để thêm ảnh</p>
                            <p className="text-xs mt-0.5" style={{ color: C.gray }}>Hỗ trợ: JPG, PNG, WEBP (tối đa 5MB/ảnh)</p>
                        </div>
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium" style={{ background: C.orangeLight, color: C.orange }}>
                            {images.length}/5 ảnh
                        </span>
                    </div>
                </div>
            )}

            {/* File Selected Preview & Action */}
            {pendingFile && previewUrl && (
                <div className="rounded-xl overflow-hidden border" style={{ borderColor: C.border }}>
                    <div className="w-full bg-black aspect-video flex items-center justify-center relative">
                        <img src={previewUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
                    </div>
                    <div className="flex items-center justify-between px-3 py-2.5" style={{ background: '#fff' }}>
                        <div className="text-xs min-w-0">
                            <p className="font-semibold truncate" style={{ color: C.navy }}>{pendingFile.name}</p>
                            <p style={{ color: C.gray }}>{(pendingFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                            <button
                                type="button"
                                onClick={handleCancel}
                                disabled={uploading}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50"
                                style={{ borderColor: C.border, color: C.gray }}
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={handleUpload}
                                disabled={uploading}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 transition-all disabled:opacity-50"
                                style={{ background: uploading ? C.orangeDark : C.orange }}
                            >
                                {uploading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-2" style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                                        Đang tải...
                                    </>
                                ) : (
                                    <>
                                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                        </svg>
                                        Tải lên
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Progress bar while uploading */}
            {uploading && (
                <div className="rounded-xl p-3 border" style={{ borderColor: `${C.orange}40`, background: C.orangeLight }}>
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium" style={{ color: C.navy }}>Đang tải lên...</span>
                        <span className="text-xs font-bold" style={{ color: C.orange }}>{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full rounded-full h-1.5" style={{ background: '#fed7aa' }}>
                        <div className="h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: C.orange }} />
                    </div>
                    <p className="text-[10px] mt-2 text-center" style={{ color: C.orangeDark }}>Vui lòng không đóng trang này...</p>
                </div>
            )}

            {/* Thumbnail grid + add-more button */}
            {images.length > 0 && (
                <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: C.gray }}>Ảnh đã tải lên ({images.length}/5)</p>
                    <div className="grid grid-cols-4 gap-2">
                        {images.map((img) => (
                            <div key={img.objectKey} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 group">
                                <img 
                                    src={img.publicUrl} 
                                    alt="" 
                                    className="w-full h-full object-cover cursor-pointer" 
                                    onClick={() => setSelectedImage(img.publicUrl)}
                                />
                                <button
                                    type="button"
                                    onClick={() => onRemove(img.objectKey)}
                                    className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                                    style={{ background: '#ef4444' }}
                                >
                                    <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        ))}
                        {canAddMore && !uploading && !pendingFile && (
                            <button
                                type="button"
                                onClick={() => inputRef.current?.click()}
                                className="aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors"
                                style={{ borderColor: '#e5e7eb', background: C.bg }}
                                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.orange; (e.currentTarget as HTMLButtonElement).style.background = C.orangeLight; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLButtonElement).style.background = C.bg; }}
                            >
                                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={C.gray} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                                <span className="text-[9px]" style={{ color: C.gray }}>Thêm</span>
                            </button>
                        )}
                        {uploading && (
                            <div className="aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1" style={{ borderColor: C.orange, background: C.orangeLight }}>
                                <div className="animate-spin rounded-full h-5 w-5 border-2" style={{ borderColor: C.orange, borderTopColor: 'transparent' }} />
                                <span className="text-[9px]" style={{ color: C.orange }}>{Math.round(progress)}%</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileSelect}
            />

            {/* Image Preview Modal */}
            {selectedImage && (
                <div 
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                    onClick={() => setSelectedImage(null)}
                >
                    <button 
                        type="button"
                        className="absolute top-4 right-4 text-white hover:text-gray-300 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                        onClick={() => setSelectedImage(null)}
                    >
                        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <img 
                        src={selectedImage} 
                        alt="Preview" 
                        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GuestNewRequestPage() {
    const { t } = useLanguage();
    const router = useRouter();
    const { guestToken, guestSession, setGuestAuth } = useGuest();

    const [step, setStep] = useState<Step>('phone');
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
    const [loadingOtp, setLoadingOtp] = useState(false);
    const [loadingVerify, setLoadingVerify] = useState(false);
    const [loadingSubmit, setLoadingSubmit] = useState(false);
    const [countdown, setCountdown] = useState(0);

    // Location
    const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
    const [loadingLocation, setLoadingLocation] = useState(false);
    const [locationTimestamp, setLocationTimestamp] = useState<Date | null>(null);

    // Vehicle
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [vehicleIndex, setVehicleIndex] = useState(0);
    const [showAddVehicle, setShowAddVehicle] = useState(false);
    const [newVehicle, setNewVehicle] = useState<{ type: 'CAR' | 'MOTORCYCLE'; licensePlate: string; color: string }>({
        type: 'MOTORCYCLE', licensePlate: '', color: '',
    });
    const [touchedPlate, setTouchedPlate] = useState(false);
    const [touchedColor, setTouchedColor] = useState(false);

    // Form
    const [incidentType, setIncidentType] = useState('');
    const [incidentLocation, setIncidentLocation] = useState<LocationData | null>(null);
    const [contactPhone, setContactPhone] = useState('');
    const [description, setDescription] = useState('');
    const [images, setImages] = useState<Array<{ objectKey: string; publicUrl: string }>>([]);
    const [videoUrls, setVideoUrls] = useState<string[]>([]);
    const [videoUploadIds, setVideoUploadIds] = useState<string[]>([]);

    const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e5e7eb', color: C.navy, fontSize: '14px', outline: 'none', background: C.white } as const;

    // Skip OTP if already a guest session
    useEffect(() => {
        if (guestToken && guestSession) {
            setStep('form');
            setPhone(guestSession.phone);
            setContactPhone(guestSession.phone);
        }
    }, [guestToken, guestSession]);

    // Countdown timer
    useEffect(() => {
        if (countdown <= 0) return;
        const t = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [countdown]);

    // Auto-fetch GPS on mount
    useEffect(() => { fetchLocation(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Cleanup recaptcha on unmount
    useEffect(() => () => clearRecaptchaVerifier(), []);

    const fetchLocation = async () => {
        if (!('geolocation' in navigator)) { toast.error(t('user.create.toasts.browserNoLocation')); return; }
        setLoadingLocation(true);
        navigator.geolocation.getCurrentPosition(
            async ({ coords }) => {
                const address = await reverseGeocode(coords.latitude, coords.longitude);
                const loc = { addressText: address, lat: coords.latitude, lng: coords.longitude };
                setCurrentLocation(loc);
                setLocationTimestamp(new Date());
                setLoadingLocation(false);
            },
            (err) => {
                setLoadingLocation(false);
                toast.error(t('user.create.toasts.locationError').replace('{error}', err.message));
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
        );
    };

    // ── OTP handlers ─────────────────────────────────────────────────────────

    const handleSendOtp = async () => {
        const cleaned = phone.replace(/\s+/g, '');
        if (cleaned.length < 9) { toast.error(t('guest.otp.invalidPhone')); return; }
        setLoadingOtp(true);
        try {
            const result = await sendPhoneOtp(phone, 'recaptcha-container');
            setConfirmationResult(result);
            setStep('otp');
            setCountdown(60);
            toast.success(t('guest.otp.otpSent').replace('{{phone}}', phone));
        } catch (err: any) {
            toast.error(err?.message || 'Không thể gửi OTP. Vui lòng thử lại.');
        } finally {
            setLoadingOtp(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!confirmationResult || otp.length < 6) { toast.error(t('guest.otp.invalidOtp')); return; }
        setLoadingVerify(true);
        try {
            const response = await verifyOtpAndCreateSession(confirmationResult, otp);
            setGuestAuth(response);
            setStep('form');
            setPhone(response.phone);
            setContactPhone(response.phone);
            toast.success('Xác minh thành công!');
        } catch (err: any) {
            toast.error(err?.message?.includes('expired') ? t('guest.otp.otpExpired') : t('guest.otp.invalidOtp'));
        } finally {
            setLoadingVerify(false);
        }
    };

    const handleResendOtp = async () => {
        if (countdown > 0) return;
        setConfirmationResult(null);
        clearRecaptchaVerifier();
        setOtp('');
        await handleSendOtp();
    };

    // ── Vehicle handlers ──────────────────────────────────────────────────────

    const isPlateInvalid = newVehicle.licensePlate.trim() !== '' && !/^[0-9]{2}[A-Z]{1,2}[0-9]?[- ]?[0-9]{4,5}$/i.test(newVehicle.licensePlate.replace(/\./g, ''));
    const isColorInvalid = newVehicle.color.trim() !== '' && /\d/.test(newVehicle.color);
    
    const showPlateError = touchedPlate && isPlateInvalid;
    const showColorError = touchedColor && isColorInvalid;

    const isAddBtnDisabled = !newVehicle.licensePlate.trim() || isPlateInvalid || !newVehicle.color.trim() || isColorInvalid;

    const handleAddVehicle = () => {
        const plate = newVehicle.licensePlate.trim();
        const color = newVehicle.color.trim();

        if (!plate) { toast.error(t('user.create.toasts.plateRequired') || 'Vui lòng nhập biển số'); return; }
        
        const plateStr = plate.replace(/\./g, '');
        if (!/^[0-9]{2}[A-Z]{1,2}[0-9]?[- ]?[0-9]{4,5}$/i.test(plateStr)) {
            toast.error(t('user.create.toasts.plateInvalid') || 'Biển số không hợp lệ (VD: 51A-12345)');
            return;
        }

        if (!color) { toast.error(t('user.create.toasts.colorRequired') || 'Vui lòng nhập màu xe'); return; }

        const v: Vehicle = { type: newVehicle.type, licensePlate: plate.toUpperCase(), color: color };
        const next = [...vehicles, v];
        setVehicles(next);
        setVehicleIndex(next.length - 1);
        setNewVehicle({ type: 'MOTORCYCLE', licensePlate: '', color: '' });
        setTouchedPlate(false);
        setTouchedColor(false);
        setShowAddVehicle(false);
    };

    // ── Submit ────────────────────────────────────────────────────────────────

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!incidentType || vehicles.length === 0 || !incidentLocation || !contactPhone) {
            toast.error(t('user.create.toasts.fillRequired'));
            return;
        }
        const selectedVehicle = vehicles[vehicleIndex];
        setLoadingSubmit(true);
        try {
            const response = await api.post('/guest/rescue-requests', {
                incidentType,
                vehicleType: selectedVehicle.type,
                licensePlate: selectedVehicle.licensePlate,
                vehicleColor: selectedVehicle.color,
                pickupLocation: incidentLocation,
                contactPhone,
                description: description || undefined,
                mediaObjectKeys: images.map(i => i.objectKey),
                videoUrls: videoUrls.length > 0 ? videoUrls : undefined,
                videoUploadIds: videoUploadIds.length > 0 ? videoUploadIds : undefined,
            });
            toast.success(t('user.create.toasts.createSuccess'));
            router.push(`/guest/rescue/${response.data.id}/status`);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || t('user.create.toasts.defaultError'));
        } finally {
            setLoadingSubmit(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen" style={{ background: C.bg, fontFamily: 'Lexend, sans-serif', paddingBottom: '88px' }}>
            {/* Firebase invisible recaptcha anchor */}
            <div id="recaptcha-container" />

            {/* ── Sticky header ── */}
            <header className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3" style={{ background: C.white, borderBottom: `1px solid ${C.border}` }}>
                <button
                    onClick={() => step === 'otp' ? setStep('phone') : router.back()}
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: C.bg, color: C.navy }}
                >
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div>
                    <h1 className="font-bold text-base leading-tight" style={{ color: C.navy }}>
                        {step === 'form' ? t('user.create.title') : t('guest.otp.title')}
                    </h1>
                    <p className="text-xs" style={{ color: C.gray }}>
                        {step === 'form'
                            ? `Khách · ${phone}`
                            : t('guest.otp.subtitle')}
                    </p>
                </div>
            </header>

            {/* ══════════════ STEP: PHONE ══════════════ */}
            {step === 'phone' && (
                <div className="px-4 py-8 max-w-md mx-auto">
                    <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                        <div className="text-center mb-6">
                            <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: '#fef2f2' }}>
                                <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#dc2626" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
                            </div>
                            <p className="text-sm" style={{ color: C.gray }}>Nhập số điện thoại để nhận mã OTP</p>
                        </div>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: C.navy }}>Số điện thoại</label>
                        <div className="flex items-center rounded-xl overflow-hidden" style={{ border: '1.5px solid #e5e7eb' }}>
                            <span className="px-3 py-3 text-sm font-medium flex-shrink-0" style={{ background: C.bg, color: C.gray, borderRight: '1px solid #e5e7eb' }}>+84</span>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="0912 345 678"
                                className="flex-1 px-3 py-3 outline-none text-sm"
                                style={{ color: C.navy, background: C.white }}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                            />
                        </div>
                        <button
                            onClick={handleSendOtp}
                            disabled={loadingOtp || !phone.trim()}
                            className="mt-4 w-full py-3 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98]"
                            style={{ background: loadingOtp || !phone.trim() ? '#fdba74' : `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)` }}
                        >
                            {loadingOtp ? 'Đang gửi OTP...' : 'Gửi mã OTP'}
                        </button>
                    </div>
                </div>
            )}

            {/* ══════════════ STEP: OTP ══════════════ */}
            {step === 'otp' && (
                <div className="px-4 py-8 max-w-md mx-auto">
                    <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                        <p className="text-sm mb-5 text-center" style={{ color: C.gray }}>
                            Mã OTP đã gửi đến <span className="font-semibold" style={{ color: C.navy }}>{phone}</span>
                        </p>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: C.navy }}>Nhập mã OTP</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                            placeholder="• • • • • •"
                            className="w-full text-center text-2xl tracking-[1em] font-mono py-3 rounded-xl outline-none"
                            style={{ border: '1.5px solid #e5e7eb', color: C.navy }}
                            onFocus={(e) => (e.target.style.border = `1.5px solid ${C.orange}`)}
                            onBlur={(e) => (e.target.style.border = '1.5px solid #e5e7eb')}
                            onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                        />
                        <button
                            onClick={handleVerifyOtp}
                            disabled={loadingVerify || otp.length < 6}
                            className="mt-4 w-full py-3 rounded-xl font-bold text-sm text-white transition-all"
                            style={{ background: loadingVerify || otp.length < 6 ? '#fdba74' : `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)` }}
                        >
                            {loadingVerify ? 'Đang xác minh...' : 'Xác minh & tiếp tục'}
                        </button>
                        <button
                            onClick={handleResendOtp}
                            disabled={countdown > 0}
                            className="mt-3 w-full text-sm py-2 transition-colors"
                            style={{ color: countdown > 0 ? '#9ca3af' : C.orange }}
                        >
                            {countdown > 0 ? `Gửi lại sau ${countdown}s` : 'Gửi lại OTP'}
                        </button>
                    </div>
                </div>
            )}

            {/* ══════════════ STEP: FORM ══════════════ */}
            {step === 'form' && (
                <form onSubmit={handleSubmit}>
                    <div className="px-4 py-5 space-y-4 max-w-2xl mx-auto">

                        {/* ── 1. Incident Type ── */}
                        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                            <SectionHeader step={1} title={t('user.create.selectType')} icon={<svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>} />
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                                {INCIDENT_TYPES.map((type) => {
                                    const active = incidentType === type.value;
                                    return (
                                        <button key={type.value} type="button" onClick={() => setIncidentType(type.value)}
                                            className="flex flex-col items-center gap-2 py-3 px-1 rounded-xl transition-all active:scale-95"
                                            style={{ border: `1.5px solid ${active ? C.orange : '#e5e7eb'}`, background: active ? C.orangeLight : C.white, color: active ? C.orange : C.gray }}>
                                            <span style={{ color: active ? C.orange : '#94a3b8' }}>{type.icon}</span>
                                            <span className="text-[11px] font-medium leading-tight text-center" style={{ color: active ? C.orange : C.navy }}>{type.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── 2. Vehicle ── */}
                        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                            <SectionHeader step={2} title={t('user.create.vehicleSection')} icon={<svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13l1.5-4.5A2 2 0 016.4 7h11.2a2 2 0 011.9 1.5L21 13m-18 0v5a1 1 0 001 1h1a1 1 0 001-1v-1h12v1a1 1 0 001 1h1a1 1 0 001-1v-5m-18 0h18M6 13h.01M18 13h.01" /></svg>} />

                            {vehicles.length === 0 ? (
                                <div className="text-center py-6 rounded-xl" style={{ border: '1.5px dashed #e5e7eb' }}>
                                    <div className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ background: C.orangeLight }}>
                                        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                                    </div>
                                    <p className="text-xs mb-3" style={{ color: C.gray }}>{t('user.create.noVehicle')}</p>
                                    <button type="button" onClick={() => setShowAddVehicle(true)} className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: C.orange }}>{t('user.create.addVehicleBtn')}</button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {vehicles.map((v, idx) => {
                                        const active = vehicleIndex === idx;
                                        return (
                                            <button key={idx} type="button" onClick={() => setVehicleIndex(idx)}
                                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left"
                                                style={{ border: `1.5px solid ${active ? C.orange : '#e5e7eb'}`, background: active ? C.orangeLight : C.white }}>
                                                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: active ? C.orange : '#f1f5f9', color: active ? 'white' : C.gray }}>
                                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13l1.5-4.5A2 2 0 016.4 7h11.2a2 2 0 011.9 1.5L21 13m-18 0v5a1 1 0 001 1h1a1 1 0 001-1v-1h12v1a1 1 0 001 1h1a1 1 0 001-1v-5m-18 0h18M6 13h.01M18 13h.01" /></svg>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold" style={{ color: active ? C.orange : C.navy }}>
                                                        {v.type === 'CAR' ? 'Ô tô' : 'Xe máy'} — {v.licensePlate}
                                                    </p>
                                                    {v.color && <p className="text-xs" style={{ color: C.gray }}>Màu {v.color}</p>}
                                                </div>
                                                {active && (
                                                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.orange }}>
                                                        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                    <button type="button" onClick={() => setShowAddVehicle(true)}
                                        className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                                        style={{ color: C.orange, background: C.orangeLight, border: `1.5px dashed ${C.orange}50` }}>
                                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                                        {t('user.create.addVehicleNewBtn')}
                                    </button>
                                </div>
                            )}

                            {showAddVehicle && (
                                <div className="mt-3 p-4 rounded-xl space-y-3" style={{ background: C.bg, border: `1.5px solid ${C.border}` }}>
                                    <p className="text-sm font-semibold" style={{ color: C.navy }}>{t('user.create.addNewVehicleTitle')}</p>
                                    <div className="flex gap-2">
                                        {(['MOTORCYCLE', 'CAR'] as const).map(vt => (
                                            <button key={vt} type="button" onClick={() => setNewVehicle(p => ({ ...p, type: vt }))}
                                                className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
                                                style={{ background: newVehicle.type === vt ? C.orange : C.white, color: newVehicle.type === vt ? 'white' : C.gray, border: `1.5px solid ${newVehicle.type === vt ? C.orange : '#e5e7eb'}` }}>
                                                {vt === 'CAR' ? 'Ô tô' : 'Xe máy'}
                                            </button>
                                        ))}
                                    </div>
                                    <div>
                                        <input 
                                            type="text" 
                                            value={newVehicle.licensePlate} 
                                            onChange={e => setNewVehicle(p => ({ ...p, licensePlate: e.target.value.toUpperCase() }))} 
                                            placeholder={t('user.create.platePlaceholder')} 
                                            style={{ ...inputStyle, border: showPlateError ? '1.5px solid #ef4444' : '1.5px solid #e5e7eb' }} 
                                            onFocus={e => { if (!showPlateError) e.target.style.border = `1.5px solid ${C.orange}`; }} 
                                            onBlur={e => { 
                                                setTouchedPlate(true);
                                                if (!showPlateError && !isPlateInvalid) e.target.style.border = '1.5px solid #e5e7eb'; 
                                            }} 
                                        />
                                        {showPlateError && (
                                            <p className="text-[11px] text-red-500 mt-1.5 pl-1">{t('user.create.toasts.plateInvalid') || 'Biển số không hợp lệ (VD: 51A-12345)'}</p>
                                        )}
                                    </div>
                                    <div>
                                        <input 
                                            type="text" 
                                            value={newVehicle.color} 
                                            onChange={e => setNewVehicle(p => ({ ...p, color: e.target.value }))} 
                                            placeholder={t('user.create.colorPlaceholder')} 
                                            style={{ ...inputStyle, border: showColorError ? '1.5px solid #ef4444' : '1.5px solid #e5e7eb' }} 
                                            onFocus={e => { if (!showColorError) e.target.style.border = `1.5px solid ${C.orange}`; }} 
                                            onBlur={e => { 
                                                setTouchedColor(true);
                                                if (!showColorError && !isColorInvalid) e.target.style.border = '1.5px solid #e5e7eb'; 
                                            }} 
                                        />
                                        {showColorError && (
                                            <p className="text-[11px] text-red-500 mt-1.5 pl-1">{t('user.create.toasts.colorInvalid') || 'Màu xe không hợp lệ (không chứa số)'}</p>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            type="button" 
                                            onClick={handleAddVehicle} 
                                            disabled={isAddBtnDisabled}
                                            className="flex-1 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors" 
                                            style={{ background: isAddBtnDisabled ? '#fdba74' : C.orange }}
                                        >
                                            {t('user.create.addBtn')}
                                        </button>
                                        <button type="button" onClick={() => {
                                            setShowAddVehicle(false);
                                            setTouchedPlate(false);
                                            setTouchedColor(false);
                                        }} className="flex-1 py-2 rounded-xl text-sm font-medium" style={{ background: C.white, color: C.gray, border: '1px solid #e5e7eb' }}>{t('user.create.cancelBtn')}</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── 3. Location ── */}
                        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                            <SectionHeader step={3} title={t('user.create.locationSection')} icon={<svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
                            <LocationPicker
                                label={t('user.create.locationLabel')}
                                value={incidentLocation}
                                onChange={setIncidentLocation}
                                placeholder={t('user.create.locationSearchPlaceholder')}
                                required
                            />

                            {/* GPS current location card */}
                            <div className="mt-3 rounded-xl overflow-hidden"
                                style={{ border: `1.5px solid ${loadingLocation ? C.border : currentLocation ? C.orange + '40' : C.border}`, background: currentLocation ? C.orangeLight : C.bg }}>
                                {loadingLocation ? (
                                    <div className="flex items-center gap-3 px-4 py-3">
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 flex-shrink-0" style={{ borderColor: C.orange, borderTopColor: 'transparent' }} />
                                        <span className="text-sm" style={{ color: C.gray }}>{t('user.create.gettingLocation')}</span>
                                    </div>
                                ) : currentLocation ? (
                                    <div className="px-4 py-3">
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: C.orange }}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" /></svg>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold mb-0.5" style={{ color: C.orange }}>{t('user.create.currentLocationLabel')}</p>
                                                <p className="text-sm leading-snug" style={{ color: C.navy }}>{currentLocation.addressText}</p>
                                            </div>
                                            <button type="button" onClick={fetchLocation} className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: C.orange + '20', color: C.orange }}>
                                                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                            </button>
                                        </div>
                                        <button type="button" onClick={() => setIncidentLocation(currentLocation)}
                                            className="mt-2.5 w-full py-2 rounded-lg text-sm font-semibold text-white active:scale-[0.98]"
                                            style={{ background: C.orange }}>
                                            {t('user.create.useThisLocation')}
                                        </button>
                                    </div>
                                ) : (
                                    <button type="button" onClick={fetchLocation} className="w-full flex items-center gap-3 px-4 py-3 hover:opacity-70">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.border }}>
                                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.gray} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        </div>
                                        <span className="text-sm" style={{ color: C.gray }}>{t('user.create.tapToGetLocation')}</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* ── 4. Contact Phone ── */}
                        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                            <SectionHeader step={4} title={t('user.create.contactSection')} icon={<svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>} />
                            <label className="block text-xs font-medium mb-1.5" style={{ color: C.gray }}>
                                {t('user.create.phoneLabel')} <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input
                                type="tel"
                                value={contactPhone}
                                onChange={e => setContactPhone(e.target.value)}
                                placeholder={t('user.create.phonePlaceholder')}
                                style={inputStyle}
                                onFocus={e => (e.target.style.border = `1.5px solid ${C.orange}`)}
                                onBlur={e => (e.target.style.border = '1.5px solid #e5e7eb')}
                                required
                            />
                            <p className="mt-1.5 text-xs" style={{ color: C.gray }}>{t('user.create.phoneHint')}</p>
                        </div>

                        {/* ── 5. Description ── */}
                        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                            <SectionHeader step={5} title={t('user.create.descriptionSection')} icon={<svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" /></svg>} />
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder={t('user.create.descriptionPlaceholder')}
                                rows={3}
                                style={{ ...inputStyle, resize: 'none' }}
                                onFocus={e => (e.target.style.border = `1.5px solid ${C.orange}`)}
                                onBlur={e => (e.target.style.border = '1.5px solid #e5e7eb')}
                            />
                        </div>

                        {/* ── 6. Photos & Video ── */}
                        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                            <SectionHeader step={6} title={t('user.create.mediaSection')} icon={<svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} />
                            <GuestImageUploader
                                images={images}
                                onAdd={(objectKey, publicUrl) => setImages(prev => [...prev, { objectKey, publicUrl }])}
                                onRemove={(objectKey) => setImages(prev => prev.filter(i => i.objectKey !== objectKey))}
                            />
                            <p className="text-xs font-medium mt-4 mb-2" style={{ color: C.gray }}>{t('user.create.videoLabel')}</p>
                            <VideoUpload
                                label=""
                                maxVideos={2}
                                cloudinaryCloudName={process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || ''}
                                cloudinaryUploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || ''}
                                skipTracking
                                uploadedVideos={videoUrls.map((url, idx) => ({ url, uploadId: videoUploadIds[idx] }))}
                                onSuccess={(videoUrl, uploadId) => {
                                    setVideoUrls(prev => [...prev, videoUrl]);
                                    setVideoUploadIds(prev => [...prev, uploadId]);
                                }}
                                onRemove={(videoUrl) => {
                                    const idx = videoUrls.indexOf(videoUrl);
                                    setVideoUrls(prev => prev.filter((_, i) => i !== idx));
                                    setVideoUploadIds(prev => prev.filter((_, i) => i !== idx));
                                }}
                            />
                        </div>

                    </div>

                    {/* ── Sticky submit bar ── */}
                    <div className="fixed bottom-0 left-0 right-0 z-20 px-4 py-3" style={{ background: C.white, borderTop: `1px solid ${C.border}`, boxShadow: '0 -4px 20px rgba(0,0,0,0.06)' }}>
                        <div className="max-w-2xl mx-auto">
                            <button
                                type="submit"
                                disabled={loadingSubmit || vehicles.length === 0}
                                className="w-full h-12 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98]"
                                style={{
                                    background: loadingSubmit || vehicles.length === 0 ? '#fdba74' : `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)`,
                                    boxShadow: vehicles.length > 0 ? `0 4px 16px ${C.orange}40` : 'none',
                                }}
                            >
                                {loadingSubmit ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                                        {t('user.create.submitting')}
                                    </span>
                                ) : (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                        {t('user.create.submitBtn')}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            )}
        </div>
    );
}
