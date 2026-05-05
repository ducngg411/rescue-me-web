'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserGuard } from '@/lib/guards';
import { useLanguage } from '@/contexts/LanguageContext';
import ImageUpload from '@/components/ImageUpload';
import VideoUpload from '@/components/VideoUpload';
import { UploadPurpose } from '@/lib/upload';
import api from '@/lib/api';
import { reverseGeocode } from '@/lib/vietmap';
import toast from 'react-hot-toast';
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

interface UserProfile {
    fullName?: string;
    phoneNumber?: string;
    vehicleType?: 'CAR' | 'MOTORCYCLE';
    licensePlate?: string;
    vehicleColor?: string;
}

const R = RESCUE_FLOW_COLORS;

export default function CreateRescueRequestPage() {
    const router = useRouter();
    const { isReady } = useUserGuard();
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);
    const [isLoadingLocation, setIsLoadingLocation] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<RescueLocationData | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [vehicles, setVehicles] = useState<RescueVehicle[]>([]);
    const [showAddVehicle, setShowAddVehicle] = useState(false);
    const [newVehicle, setNewVehicle] = useState({ type: 'CAR' as 'CAR' | 'MOTORCYCLE', licensePlate: '', color: '' });

    const [formData, setFormData] = useState({
        incidentType: '',
        vehicleIndex: 0,
        incidentLocation: null as RescueLocationData | null,
        contactPhone: '',
        description: '',
        images: [] as Array<{ objectKey: string; publicUrl: string; uploadId?: string }>,
        videoUrls: [] as string[],
        videoUploadIds: [] as string[],
    });

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await api.get('/me/profile');
                const profile = response.data;
                setUserProfile(profile);
                const userVehicles: RescueVehicle[] = [];
                if (profile.rescueVehicles?.length) {
                    for (const v of profile.rescueVehicles) {
                        userVehicles.push({ type: v.type, licensePlate: v.plateNumber, color: v.color });
                    }
                } else if (profile.vehicleType && profile.licensePlate) {
                    userVehicles.push({
                        type: profile.vehicleType,
                        licensePlate: profile.licensePlate,
                        color: profile.vehicleColor,
                    });
                }
                setVehicles(userVehicles);
                if (profile.phoneNumber) {
                    setFormData((prev) => ({ ...prev, contactPhone: profile.phoneNumber }));
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
        if (!('geolocation' in navigator)) {
            toast.error(t('user.create.toasts.browserNoLocation'));
            return;
        }
        setIsLoadingLocation(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                const address = await reverseGeocode(latitude, longitude);
                const location = { addressText: address, lat: latitude, lng: longitude };
                setCurrentLocation(location);
                setIsLoadingLocation(false);
            },
            (error) => {
                setIsLoadingLocation(false);
                toast.error(t('user.create.toasts.locationError').replace('{error}', error.message));
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    };

    useEffect(() => {
        fetchLocation();
    }, []);

    const isPlateInvalid =
        newVehicle.licensePlate.trim() !== '' &&
        !/^[0-9]{2}[A-Z]{1,2}[0-9]?[- ]?[0-9]{4,5}$/i.test(newVehicle.licensePlate.replace(/\./g, ''));
    const isColorInvalid = newVehicle.color.trim() !== '' && /\d/.test(newVehicle.color);
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

        const vehicle: RescueVehicle = { type: newVehicle.type, licensePlate: plate, color: color };
        setVehicles((prev) => [...prev, vehicle]);
        setFormData((prev) => ({ ...prev, vehicleIndex: vehicles.length }));
        setNewVehicle({ type: 'CAR', licensePlate: '', color: '' });
        setShowAddVehicle(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.incidentType || vehicles.length === 0 || !formData.incidentLocation || !formData.contactPhone) {
            toast.error(t('user.create.toasts.fillRequired'));
            return;
        }
        const selectedVehicle = vehicles[formData.vehicleIndex];
        setIsLoading(true);
        try {
            const payload = {
                incidentType: formData.incidentType,
                vehicleType: selectedVehicle.type,
                licensePlate: selectedVehicle.licensePlate,
                vehicleColor: selectedVehicle.color,
                pickupLocation: formData.incidentLocation,
                contactPhone: formData.contactPhone,
                description: formData.description,
                uploadIds: formData.images.filter(img => img.uploadId).map(img => img.uploadId!),
                mediaObjectKeys: formData.images.filter(img => !img.uploadId).map(img => img.objectKey),
                videoUploadIds: formData.videoUploadIds,
                videoUrls: formData.videoUrls,
            };
            const response = await api.post('/rescue-requests', payload);
            toast.success(t('user.create.toasts.createSuccess'));
            router.push(`/user/requests/${response.data.id}`);
        } catch (error: any) {
            toast.error(
                error.response?.data?.message
                    ? t('user.create.toasts.createError').replace('{error}', error.response.data.message)
                    : t('user.create.toasts.defaultError')
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleImageUploadSuccess = (objectKey: string, publicUrl: string, uploadId?: string) => {
        setFormData((prev) => ({ ...prev, images: [...prev.images, { objectKey, publicUrl, uploadId }] }));
    };
    const handleImageRemove = (objectKey: string) => {
        setFormData((prev) => ({ ...prev, images: prev.images.filter((img) => img.objectKey !== objectKey) }));
    };

    if (!isReady || isLoadingProfile) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: R.bg }}>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: R.orange }} />
            </div>
        );
    }

    return (
        <div className="min-h-screen" style={{ background: R.bg, fontFamily: 'Lexend, sans-serif', paddingBottom: '88px' }}>
            <header
                className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3"
                style={{ background: R.white, borderBottom: `1px solid ${R.border}` }}
            >
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                    style={{ background: R.bg, color: R.navy }}
                >
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div>
                    <h1 className="font-bold text-base leading-tight" style={{ color: R.navy }}>
                        {t('user.create.title')}
                    </h1>
                    <p className="text-xs" style={{ color: R.gray }}>
                        {t('user.create.subtitle')}
                    </p>
                </div>
            </header>

            <form onSubmit={handleSubmit}>
                <div className="px-4 py-5 space-y-4 max-w-2xl mx-auto">
                    <IncidentTypeSection
                        colors={R}
                        t={t}
                        incidentType={formData.incidentType}
                        onSelectType={(v: IncidentTypeValue) => setFormData({ ...formData, incidentType: v })}
                    />

                    <VehicleSection
                        colors={R}
                        t={t}
                        vehicles={vehicles}
                        vehicleIndex={formData.vehicleIndex}
                        onSelectVehicle={(index) => setFormData({ ...formData, vehicleIndex: index })}
                        showAddVehicle={showAddVehicle}
                        onOpenAddVehicle={() => setShowAddVehicle(true)}
                        onCloseAddVehicle={() => setShowAddVehicle(false)}
                        newVehicle={newVehicle}
                        setNewVehicle={setNewVehicle}
                        onAddVehicle={handleAddVehicle}
                        isPlateInvalid={isPlateInvalid}
                        isColorInvalid={isColorInvalid}
                        isAddBtnDisabled={isAddBtnDisabled}
                        showPlateError={isPlateInvalid}
                        showColorError={isColorInvalid}
                    />

                    <LocationSection
                        colors={R}
                        t={t}
                        incidentLocation={formData.incidentLocation}
                        onIncidentLocationChange={(loc) => setFormData({ ...formData, incidentLocation: loc })}
                        currentLocation={currentLocation}
                        isLoadingLocation={isLoadingLocation}
                        onRefreshLocation={fetchLocation}
                        onUseCurrentLocation={() => setFormData((prev) => ({ ...prev, incidentLocation: currentLocation! }))}
                        locationPickerVariant="rescue"
                    />

                    <ContactSection
                        colors={R}
                        t={t}
                        contactPhone={formData.contactPhone}
                        onContactPhoneChange={(v) => setFormData({ ...formData, contactPhone: v })}
                    />

                    <DescriptionSection
                        colors={R}
                        t={t}
                        description={formData.description}
                        onDescriptionChange={(v) => setFormData({ ...formData, description: v })}
                    />

                    <MediaSection
                        colors={R}
                        t={t}
                        imageUploadSlot={
                            <ImageUpload
                                purpose={UploadPurpose.REQUEST_PHOTO}
                                maxImages={5}
                                uploadedImages={formData.images}
                                onSuccess={handleImageUploadSuccess}
                                onRemove={handleImageRemove}
                                label=""
                            />
                        }
                        videoUploadSlot={
                            <VideoUpload
                                label=""
                                maxVideos={2}
                                cloudinaryCloudName={process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || ''}
                                cloudinaryUploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || ''}
                                uploadedVideos={formData.videoUrls.map((url, idx) => ({
                                    url,
                                    uploadId: formData.videoUploadIds[idx],
                                }))}
                                onSuccess={(videoUrl, uploadId) => {
                                    setFormData((prev) => ({
                                        ...prev,
                                        videoUrls: [...prev.videoUrls, videoUrl],
                                        videoUploadIds: [...prev.videoUploadIds, uploadId],
                                    }));
                                }}
                                onRemove={(videoUrl) => {
                                    setFormData((prev) => {
                                        const urlIndex = prev.videoUrls.indexOf(videoUrl);
                                        return {
                                            ...prev,
                                            videoUrls: prev.videoUrls.filter((_, i) => i !== urlIndex),
                                            videoUploadIds: prev.videoUploadIds.filter((_, i) => i !== urlIndex),
                                        };
                                    });
                                }}
                            />
                        }
                    />
                </div>

                <StickySubmitBar
                    colors={R}
                    t={t}
                    onBack={() => router.back()}
                    isSubmitting={isLoading}
                    submitDisabled={isLoading || vehicles.length === 0}
                    layout="withBack"
                />
            </form>
        </div>
    );
}
