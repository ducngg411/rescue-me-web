'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, AlertTriangle, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import api from '@/lib/api';

const C = { orange: '#f97316', orangeDark: '#ea6c0a', orangeLight: '#fff7ed', navy: '#1a1a2e', gray: '#6b7280', border: '#e2e8f0', bg: '#f4f6f9', green: '#16a34a', red: '#ef4444' };

const SectionCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="bg-white rounded-2xl border p-5 mb-4" style={{ borderColor: C.border }}>
        <div className="flex items-center gap-2 mb-4 pb-3 border-b" style={{ borderColor: C.border }}>
            <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: C.orange }} />
            <h2 className="text-sm font-bold" style={{ color: C.navy }}>{title}</h2>
        </div>
        {children}
    </div>
);

const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex py-1.5 border-b last:border-b-0" style={{ borderColor: C.border }}>
        <span className="text-xs w-40 flex-shrink-0" style={{ color: C.gray }}>{label}</span>
        <span className="text-xs font-medium" style={{ color: C.navy }}>{value}</span>
    </div>
);

const UploadStatus = ({ uploaded, label, uploadedText, missingText }: { uploaded: boolean; label: string; uploadedText: string; missingText: string }) => (
    <div className="flex items-center justify-between py-1.5 border-b last:border-b-0" style={{ borderColor: C.border }}>
        <span className="text-xs" style={{ color: C.navy }}>{label}</span>
        {uploaded
            ? <div className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" style={{ color: C.green }} /><span className="text-xs" style={{ color: C.green }}>{uploadedText}</span></div>
            : <div className="flex items-center gap-1"><XCircle className="w-3.5 h-3.5" style={{ color: C.red }} /><span className="text-xs" style={{ color: C.red }}>{missingText}</span></div>}
    </div>
);

interface ReviewSubmitStepProps {
    serviceInfo: any;
    requiredDocs: any;
    optionalDocs: any;
    onBack: () => void;
    isShell?: boolean;
    isSubmitting?: boolean;
    isEditMode?: boolean;
}

export default function ReviewSubmitStep({ serviceInfo, requiredDocs, optionalDocs, onBack, isShell, isSubmitting: parentSubmitting, isEditMode }: ReviewSubmitStepProps) {
    const router = useRouter();
    const { refreshUser } = useAuth();
    const { t } = useLanguage();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const submitting = parentSubmitting || isSubmitting;

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError('');
        try {
            const uploadIds = [
                requiredDocs.citizenIdFront?.id, requiredDocs.citizenIdBack?.id,
                requiredDocs.selfie?.id, requiredDocs.carPhoto?.id, requiredDocs.motorbikePhoto?.id,
                optionalDocs?.driverLicense?.id, optionalDocs?.businessLicense?.id,
            ].filter(Boolean);
            await api.post('/me/provider/submit-verification', { uploadIds });
            await refreshUser();
            // Toast is handled by dashboard/page.tsx when it detects ?verification=submitted
            const dest = isEditMode
                ? '/provider/dashboard?verification=submitted&edit=true'
                : '/provider/dashboard?verification=submitted';
            router.push(dest);
        } catch (err: any) {
            setError(err.response?.data?.message || t('provider.onboarding.reviewSubmit.submitError'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const serviceLabels: Record<string, string> = {
        TOWING: t('provider.onboarding.serviceInfo.serviceTypeOptions.TOWING'),
        BATTERY_JUMP: t('provider.onboarding.serviceInfo.serviceTypeOptions.BATTERY_JUMP'),
        TIRE_CHANGE: t('provider.onboarding.serviceInfo.serviceTypeOptions.TIRE_CHANGE'),
        FUEL_DELIVERY: t('provider.onboarding.serviceInfo.serviceTypeOptions.FUEL_DELIVERY'),
        LOCKOUT: t('provider.onboarding.serviceInfo.serviceTypeOptions.LOCKOUT'),
        BREAKDOWN_REPAIR: t('provider.onboarding.serviceInfo.serviceTypeOptions.BREAKDOWN_REPAIR'),
    };
    const vehicleLabels: Record<string, string> = {
        CAR: t('provider.onboarding.serviceInfo.services.vehicleTypeOptions.car'),
        MOTORCYCLE: t('provider.onboarding.serviceInfo.services.vehicleTypeOptions.motorcycle'),
    };

    return (
        <div>
            {/* Service info summary */}
            <SectionCard title={t('provider.onboarding.reviewSubmit.serviceInfoTitle')}>
                <div>
                    <Row label={t('provider.onboarding.reviewSubmit.fields.providerType')} value={serviceInfo?.providerType === 'INDIVIDUAL' ? t('provider.onboarding.serviceInfo.basicInfo.providerTypeOptions.individual.label') : t('provider.onboarding.serviceInfo.basicInfo.providerTypeOptions.business.label')} />
                    <Row label={t('provider.onboarding.reviewSubmit.fields.fullName')} value={serviceInfo?.fullName || '—'} />
                    <Row label={t('provider.onboarding.reviewSubmit.fields.phone')} value={serviceInfo?.phoneNumber || '—'} />
                    {serviceInfo?.businessName && <Row label={t('provider.onboarding.reviewSubmit.fields.businessName')} value={serviceInfo.businessName} />}
                    <Row label={t('provider.onboarding.reviewSubmit.fields.services')} value={(serviceInfo?.serviceTypes || []).map((type: string) => serviceLabels[type]).join(', ') || '—'} />
                    <Row label={t('provider.onboarding.reviewSubmit.fields.supportedVehicles')} value={(serviceInfo?.supportedVehicleTypes || []).map((type: string) => vehicleLabels[type]).join(', ') || '—'} />
                    <Row label={t('provider.onboarding.reviewSubmit.fields.radius')} value={serviceInfo?.serviceRadiusKm ? `${serviceInfo.serviceRadiusKm} km` : '—'} />
                    <Row label={t('provider.onboarding.reviewSubmit.fields.address')} value={serviceInfo?.providerType === 'INDIVIDUAL' ? serviceInfo?.permanentAddress?.addressText : serviceInfo?.businessAddress?.addressText || '—'} />
                    {serviceInfo?.rescueVehicles?.length > 0 && (
                        <div className="flex py-1.5">
                            <span className="text-xs w-40 flex-shrink-0" style={{ color: C.gray }}>{t('provider.onboarding.reviewSubmit.fields.rescueVehicles')}</span>
                            <div className="flex flex-wrap gap-1.5">
                                {serviceInfo.rescueVehicles.map((v: any, i: number) => (
                                    <span key={i} className="text-xs px-2 py-0.5 rounded-lg font-mono" style={{ background: C.bg, color: C.navy }}>
                                        {vehicleLabels[v.type] || v.type} {v.plateNumber}
                                        {v.isPrimary && <span className="ml-1" style={{ color: C.orange }}>✓</span>}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </SectionCard>

            {/* Documents summary */}
            <SectionCard title={t('provider.onboarding.reviewSubmit.docsStatusTitle')}>
                <div>
                    <UploadStatus uploaded={!!requiredDocs.citizenIdFront} label={t('provider.onboarding.requiredDocs.identity.citizenFront')} uploadedText={t('provider.onboarding.reviewSubmit.uploaded')} missingText={t('provider.onboarding.reviewSubmit.notUploaded')} />
                    <UploadStatus uploaded={!!requiredDocs.citizenIdBack} label={t('provider.onboarding.requiredDocs.identity.citizenBack')} uploadedText={t('provider.onboarding.reviewSubmit.uploaded')} missingText={t('provider.onboarding.reviewSubmit.notUploaded')} />
                    <UploadStatus uploaded={!!requiredDocs.selfie} label={t('provider.onboarding.requiredDocs.identity.selfie')} uploadedText={t('provider.onboarding.reviewSubmit.uploaded')} missingText={t('provider.onboarding.reviewSubmit.notUploaded')} />
                    {serviceInfo?.rescueVehicles?.some((v: any) => v.type === 'CAR') && <UploadStatus uploaded={!!requiredDocs.carPhoto} label={t('provider.onboarding.requiredDocs.vehiclePhotos.carPhoto')} uploadedText={t('provider.onboarding.reviewSubmit.uploaded')} missingText={t('provider.onboarding.reviewSubmit.notUploaded')} />}
                    {serviceInfo?.rescueVehicles?.some((v: any) => v.type === 'MOTORCYCLE') && <UploadStatus uploaded={!!requiredDocs.motorbikePhoto} label={t('provider.onboarding.requiredDocs.vehiclePhotos.motorbikePhoto')} uploadedText={t('provider.onboarding.reviewSubmit.uploaded')} missingText={t('provider.onboarding.reviewSubmit.notUploaded')} />}
                    {optionalDocs?.driverLicense && <UploadStatus uploaded label={t('provider.onboarding.reviewSubmit.optional.driverLicense')} uploadedText={t('provider.onboarding.reviewSubmit.uploaded')} missingText={t('provider.onboarding.reviewSubmit.notUploaded')} />}
                    {optionalDocs?.businessLicense && <UploadStatus uploaded label={t('provider.onboarding.reviewSubmit.optional.businessLicense')} uploadedText={t('provider.onboarding.reviewSubmit.uploaded')} missingText={t('provider.onboarding.reviewSubmit.notUploaded')} />}
                </div>
            </SectionCard>

            {/* Warning */}
            <div className="flex items-start gap-3 p-4 rounded-2xl mb-4" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#d97706' }} />
                <p className="text-xs leading-relaxed" style={{ color: '#92400e' }}>
                    {t('provider.onboarding.reviewSubmit.warningPrefix')} <strong>{t('provider.onboarding.reviewSubmit.warningEmphasis')}</strong>. {t('provider.onboarding.reviewSubmit.warningSuffix')}
                </p>
            </div>

            {error && (
                <div className="flex items-start gap-3 p-4 rounded-2xl mb-4" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                    <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: C.red }} />
                    <p className="text-xs" style={{ color: C.red }}>{error}</p>
                </div>
            )}

            {/* Actions */}
            <div className="flex justify-between items-center pt-2">
                <button onClick={onBack} disabled={submitting} className="px-5 py-2.5 rounded-xl border text-sm font-medium transition-colors hover:bg-gray-50 disabled:opacity-50" style={{ borderColor: C.border, color: C.gray }}>{t('provider.onboarding.common.back')}</button>
                <button onClick={handleSubmit} disabled={submitting}
                    className="px-6 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center gap-2 transition-all disabled:opacity-70"
                    style={{ background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)` }}>
                    {submitting ? (
                        <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /><span>{t('provider.onboarding.reviewSubmit.submitting')}</span></>
                    ) : (
                        <><Send className="w-4 h-4" /><span>{t('provider.onboarding.reviewSubmit.submit')}</span></>
                    )}
                </button>
            </div>
        </div>
    );
}
