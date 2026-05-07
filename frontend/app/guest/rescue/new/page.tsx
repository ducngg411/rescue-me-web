'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGuest } from '@/contexts/GuestContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { sendPhoneOtp, verifyOtpAndCreateSession, clearRecaptchaVerifier } from '@/lib/guest-auth';
import { uploadGuestImage } from '@/lib/guest-upload';
import VideoUpload from '@/components/VideoUpload';
import ImageUpload, { type ImageUploadAdapter } from '@/components/ImageUpload';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { ConfirmationResult } from 'firebase/auth';
import { reverseGeocode } from '@/lib/vietmap';
import {
    RESCUE_FLOW_COLORS,
    IncidentTypeSection,
    VehicleSection,
    LocationSection,
    ContactSection,
    DescriptionSection,
    MediaSection,
    StickySubmitBar,
    type IncidentTypeValue,
    type RescueLocationData,
    type RescueVehicle,
} from '@/components/rescue-flow';

type Step = 'phone' | 'otp' | 'form';

const R = RESCUE_FLOW_COLORS;

const guestImageUploadAdapter: ImageUploadAdapter = (file, onProgress) => uploadGuestImage(file, onProgress);

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

    const [currentLocation, setCurrentLocation] = useState<RescueLocationData | null>(null);
    const [loadingLocation, setLoadingLocation] = useState(false);

    const [vehicles, setVehicles] = useState<RescueVehicle[]>([]);
    const [vehicleIndex, setVehicleIndex] = useState(0);
    const [showAddVehicle, setShowAddVehicle] = useState(false);
    const [newVehicle, setNewVehicle] = useState<{ type: 'CAR' | 'MOTORCYCLE'; licensePlate: string; color: string }>({
        type: 'MOTORCYCLE',
        licensePlate: '',
        color: '',
    });
    const [touchedPlate, setTouchedPlate] = useState(false);
    const [touchedColor, setTouchedColor] = useState(false);

    const [incidentType, setIncidentType] = useState('');
    const [incidentLocation, setIncidentLocation] = useState<RescueLocationData | null>(null);
    const [contactPhone, setContactPhone] = useState('');
    const [description, setDescription] = useState('');
    const [images, setImages] = useState<Array<{ objectKey: string; publicUrl: string; uploadId?: string }>>([]);
    const [videoUrls, setVideoUrls] = useState<string[]>([]);
    const [videoUploadIds, setVideoUploadIds] = useState<string[]>([]);

    useEffect(() => {
        if (guestToken && guestSession) {
            setStep('form');
            setPhone(guestSession.phone);
            setContactPhone(guestSession.phone);
        }
    }, [guestToken, guestSession]);

    useEffect(() => {
        if (countdown <= 0) return;
        const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
        return () => clearTimeout(id);
    }, [countdown]);

    useEffect(() => {
        fetchLocation();
    }, []);

    useEffect(() => () => clearRecaptchaVerifier(), []);

    const fetchLocation = async () => {
        if (!('geolocation' in navigator)) {
            toast.error(t('user.create.toasts.browserNoLocation'));
            return;
        }
        setLoadingLocation(true);
        navigator.geolocation.getCurrentPosition(
            async ({ coords }) => {
                const address = await reverseGeocode(coords.latitude, coords.longitude);
                const loc = { addressText: address, lat: coords.latitude, lng: coords.longitude };
                setCurrentLocation(loc);
                setLoadingLocation(false);
            },
            (err) => {
                setLoadingLocation(false);
                toast.error(t('user.create.toasts.locationError').replace('{error}', err.message));
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    };

    const handleSendOtp = async () => {
        const cleaned = phone.replace(/\s+/g, '');
        if (cleaned.length < 9) {
            toast.error(t('guest.otp.invalidPhone'));
            return;
        }
        setLoadingOtp(true);
        try {
            const result = await sendPhoneOtp(phone, 'recaptcha-container');
            setConfirmationResult(result);
            setStep('otp');
            setCountdown(60);
            toast.success(t('guest.otp.otpSent').replace('{{phone}}', phone));
        } catch (err: any) {
            toast.error(err?.message || t('guest.otp.sendFailed'));
        } finally {
            setLoadingOtp(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!confirmationResult || otp.length < 6) {
            toast.error(t('guest.otp.invalidOtp'));
            return;
        }
        setLoadingVerify(true);
        try {
            const response = await verifyOtpAndCreateSession(confirmationResult, otp);
            setGuestAuth(response);
            setStep('form');
            setPhone(response.phone);
            setContactPhone(response.phone);
            toast.success(t('guest.otp.verifySuccessToast'));
        } catch (err: any) {
            toast.error(
                err?.message?.includes('expired') ? t('guest.otp.otpExpired') : t('guest.otp.invalidOtp')
            );
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

    const isPlateInvalid =
        newVehicle.licensePlate.trim() !== '' &&
        !/^[0-9]{2}[A-Z]{1,2}[0-9]?[- ]?[0-9]{4,5}$/i.test(newVehicle.licensePlate.replace(/\./g, ''));
    const isColorInvalid = newVehicle.color.trim() !== '' && /\d/.test(newVehicle.color);
    const showPlateError = touchedPlate && isPlateInvalid;
    const showColorError = touchedColor && isColorInvalid;
    const isAddBtnDisabled = !newVehicle.licensePlate.trim() || isPlateInvalid || !newVehicle.color.trim() || isColorInvalid;

    const handleAddVehicle = () => {
        const plate = newVehicle.licensePlate.trim();
        const color = newVehicle.color.trim();

        if (!plate) {
            toast.error(t('user.create.toasts.plateRequired') || 'Vui lòng nhập biển số');
            return;
        }

        const plateStr = plate.replace(/\./g, '');
        if (!/^[0-9]{2}[A-Z]{1,2}[0-9]?[- ]?[0-9]{4,5}$/i.test(plateStr)) {
            toast.error(t('user.create.toasts.plateInvalid') || 'Biển số không hợp lệ (VD: 51A-12345)');
            return;
        }

        if (!color) {
            toast.error(t('user.create.toasts.colorRequired') || 'Vui lòng nhập màu xe');
            return;
        }

        const v: RescueVehicle = { type: newVehicle.type, licensePlate: plate.toUpperCase(), color: color };
        const next = [...vehicles, v];
        setVehicles(next);
        setVehicleIndex(next.length - 1);
        setNewVehicle({ type: 'MOTORCYCLE', licensePlate: '', color: '' });
        setTouchedPlate(false);
        setTouchedColor(false);
        setShowAddVehicle(false);
    };

    const closeAddVehicle = () => {
        setShowAddVehicle(false);
        setTouchedPlate(false);
        setTouchedColor(false);
    };

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
                uploadIds: images.filter(i => i.uploadId).map(i => i.uploadId!),
                mediaObjectKeys: images.filter(i => !i.uploadId).map(i => i.objectKey),
                videoUrls: videoUrls.length > 0 ? videoUrls : undefined,
                videoUploadIds: videoUploadIds.length > 0 ? videoUploadIds : undefined,
            });
            toast.success(t('user.create.toasts.createSuccess'));
            router.push(`/guest/rescue/${response.data.id}/status`);
        } catch (err: any) {
            const data = err?.response?.data;
            if (data?.code === 'ACTIVE_REQUEST_EXISTS' && data?.requestId) {
                toast(t('guest.status.activeRequestRedirect'), { icon: '↩️' });
                router.push(`/guest/rescue/${data.requestId}/status`);
                return;
            }
            toast.error(data?.message || t('user.create.toasts.defaultError'));
        } finally {
            setLoadingSubmit(false);
        }
    };

    return (
        <div className="min-h-screen" style={{ background: R.bg, fontFamily: 'Lexend, sans-serif', paddingBottom: '88px' }}>
            <div id="recaptcha-container" />

            <header
                className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3"
                style={{ background: R.white, borderBottom: `1px solid ${R.border}` }}
            >
                <button
                    type="button"
                    onClick={() => (step === 'otp' ? setStep('phone') : router.back())}
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: R.bg, color: R.navy }}
                >
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div>
                    <h1 className="font-bold text-base leading-tight" style={{ color: R.navy }}>
                        {step === 'form' ? t('user.create.title') : t('guest.otp.title')}
                    </h1>
                    <p className="text-xs" style={{ color: R.gray }}>
                        {step === 'form'
                            ? t('guest.request.subtitle').replace('{{phone}}', phone)
                            : t('guest.otp.subtitle')}
                    </p>
                </div>
            </header>

            {step === 'phone' && (
                <div className="px-4 py-8 max-w-md mx-auto">
                    <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                        <div className="text-center mb-6">
                            <div
                                className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center"
                                style={{ background: '#fef2f2' }}
                            >
                                <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#dc2626" strokeWidth={1.8}>
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
                                    />
                                </svg>
                            </div>
                            <p className="text-sm" style={{ color: R.gray }}>
                                {t('guest.otp.intro')}
                            </p>
                        </div>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: R.navy }}>
                            {t('guest.otp.phoneLabel')}
                        </label>
                        <div className="flex items-center rounded-xl overflow-hidden" style={{ border: '1.5px solid #e5e7eb' }}>
                            <span
                                className="px-3 py-3 text-sm font-medium flex-shrink-0"
                                style={{ background: R.bg, color: R.gray, borderRight: '1px solid #e5e7eb' }}
                            >
                                +84
                            </span>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder={t('guest.otp.phonePlaceholder')}
                                className="flex-1 px-3 py-3 outline-none text-sm"
                                style={{ color: R.navy, background: R.white }}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleSendOtp}
                            disabled={loadingOtp || !phone.trim()}
                            className="mt-4 w-full py-3 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98]"
                            style={{
                                background:
                                    loadingOtp || !phone.trim() ? '#fdba74' : `linear-gradient(135deg, ${R.orange} 0%, ${R.orangeDark} 100%)`,
                            }}
                        >
                            {loadingOtp ? t('guest.otp.sendingOtp') : t('guest.otp.sendOtpBtn')}
                        </button>
                    </div>
                </div>
            )}

            {step === 'otp' && (
                <div className="px-4 py-8 max-w-md mx-auto">
                    <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                        <p className="text-sm mb-5 text-center" style={{ color: R.gray }}>
                            {t('guest.otp.sentToPhone')}{' '}
                            <span className="font-semibold" style={{ color: R.navy }}>
                                {phone}
                            </span>
                        </p>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: R.navy }}>
                            {t('guest.otp.otpLabel')}
                        </label>
                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                            placeholder={t('guest.otp.otpPlaceholder')}
                            className="w-full text-center text-2xl tracking-[0.35em] font-mono py-3 rounded-xl outline-none"
                            style={{ border: '1.5px solid #e5e7eb', color: R.navy }}
                            onFocus={(e) => (e.target.style.border = `1.5px solid ${R.orange}`)}
                            onBlur={(e) => (e.target.style.border = '1.5px solid #e5e7eb')}
                            onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                        />
                        <button
                            type="button"
                            onClick={handleVerifyOtp}
                            disabled={loadingVerify || otp.length < 6}
                            className="mt-4 w-full py-3 rounded-xl font-bold text-sm text-white transition-all"
                            style={{
                                background:
                                    loadingVerify || otp.length < 6 ? '#fdba74' : `linear-gradient(135deg, ${R.orange} 0%, ${R.orangeDark} 100%)`,
                            }}
                        >
                            {loadingVerify ? t('guest.otp.verifying') : t('guest.otp.verifyBtn')}
                        </button>
                        <button
                            type="button"
                            onClick={handleResendOtp}
                            disabled={countdown > 0}
                            className="mt-3 w-full text-sm py-2 transition-colors"
                            style={{ color: countdown > 0 ? '#9ca3af' : R.orange }}
                        >
                            {countdown > 0 ? t('guest.otp.resendIn').replace('{{seconds}}', String(countdown)) : t('guest.otp.resendOtp')}
                        </button>
                    </div>
                </div>
            )}

            {step === 'form' && (
                <form onSubmit={handleSubmit}>
                    <div className="px-4 py-5 space-y-4 max-w-2xl mx-auto">
                        <IncidentTypeSection
                            colors={R}
                            t={t}
                            incidentType={incidentType}
                            onSelectType={(v: IncidentTypeValue) => setIncidentType(v)}
                        />

                        <VehicleSection
                            colors={R}
                            t={t}
                            vehicles={vehicles}
                            vehicleIndex={vehicleIndex}
                            onSelectVehicle={setVehicleIndex}
                            showAddVehicle={showAddVehicle}
                            onOpenAddVehicle={() => setShowAddVehicle(true)}
                            onCloseAddVehicle={closeAddVehicle}
                            newVehicle={newVehicle}
                            setNewVehicle={setNewVehicle}
                            onAddVehicle={handleAddVehicle}
                            isPlateInvalid={isPlateInvalid}
                            isColorInvalid={isColorInvalid}
                            isAddBtnDisabled={isAddBtnDisabled}
                            showPlateError={showPlateError}
                            showColorError={showColorError}
                            onPlateBlur={() => setTouchedPlate(true)}
                            onColorBlur={() => setTouchedColor(true)}
                            vehicleTypeOrder={['MOTORCYCLE', 'CAR']}
                        />

                        <LocationSection
                            colors={R}
                            t={t}
                            incidentLocation={incidentLocation}
                            onIncidentLocationChange={setIncidentLocation}
                            currentLocation={currentLocation}
                            isLoadingLocation={loadingLocation}
                            onRefreshLocation={fetchLocation}
                            onUseCurrentLocation={() => setIncidentLocation(currentLocation!)}
                            locationPickerVariant="rescue"
                        />

                        <ContactSection
                            colors={R}
                            t={t}
                            contactPhone={contactPhone}
                            onContactPhoneChange={setContactPhone}
                        />

                        <DescriptionSection
                            colors={R}
                            t={t}
                            description={description}
                            onDescriptionChange={setDescription}
                        />

                        <MediaSection
                            colors={R}
                            t={t}
                            imageUploadSlot={
                                <ImageUpload
                                    uploadImage={guestImageUploadAdapter}
                                    maxImages={5}
                                    uploadedImages={images}
                                    onSuccess={(objectKey, publicUrl, uploadId) =>
                                        setImages((prev) => [...prev, { objectKey, publicUrl, uploadId }])
                                    }
                                    onRemove={(objectKey) =>
                                        setImages((prev) => prev.filter((i) => i.objectKey !== objectKey))
                                    }
                                    label=""
                                />
                            }
                            videoUploadSlot={
                                <VideoUpload
                                    label=""
                                    maxVideos={2}
                                    cloudinaryCloudName={process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || ''}
                                    cloudinaryUploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || ''}
                                    skipTracking
                                    uploadedVideos={videoUrls.map((url, idx) => ({
                                        url,
                                        uploadId: videoUploadIds[idx],
                                    }))}
                                    onSuccess={(videoUrl, uploadId) => {
                                        setVideoUrls((prev) => [...prev, videoUrl]);
                                        setVideoUploadIds((prev) => [...prev, uploadId]);
                                    }}
                                    onRemove={(videoUrl) => {
                                        const idx = videoUrls.indexOf(videoUrl);
                                        setVideoUrls((prev) => prev.filter((_, i) => i !== idx));
                                        setVideoUploadIds((prev) => prev.filter((_, i) => i !== idx));
                                    }}
                                />
                            }
                        />
                    </div>

                    <StickySubmitBar
                        colors={R}
                        t={t}
                        onBack={() => router.back()}
                        isSubmitting={loadingSubmit}
                        submitDisabled={loadingSubmit || vehicles.length === 0}
                        layout="submitOnly"
                    />
                </form>
            )}
        </div>
    );
}
