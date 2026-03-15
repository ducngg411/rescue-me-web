'use client';

import React, { useState, useEffect } from 'react';
import { IdCard, Car } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import FileUpload from '@/components/FileUpload';
import { UploadPurpose, DocumentType, getUserUploads } from '@/lib/upload';

const C = { orange: '#f97316', orangeDark: '#ea6c0a', orangeLight: '#fff7ed', navy: '#1a1a2e', gray: '#6b7280', border: '#e2e8f0', bg: '#f4f6f9', green: '#16a34a', red: '#ef4444' };

const SectionCard = ({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) => (
    <div className="bg-white rounded-2xl border p-5 mb-4" style={{ borderColor: C.border }}>
        <div className="flex items-center gap-2 mb-4 pb-3 border-b" style={{ borderColor: C.border }}>
            <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: C.orange }} />
            <div>
                <h2 className="text-sm font-bold" style={{ color: C.navy }}>{title}</h2>
                {desc && <p className="text-[11px]" style={{ color: C.gray }}>{desc}</p>}
            </div>
        </div>
        {children}
    </div>
);

interface RequiredDocsStepProps {
    initialData: any;
    serviceInfo: any;
    onComplete: (data: any) => void;
    onBack: () => void;
    isShell?: boolean;
}

export default function RequiredDocsStep({ initialData, serviceInfo, onComplete, onBack, isShell }: RequiredDocsStepProps) {
    const { t } = useLanguage();
    const [uploads, setUploads] = useState({
        citizenIdFront: initialData?.citizenIdFront || null,
        citizenIdBack: initialData?.citizenIdBack || null,
        selfie: initialData?.selfie || null,
        carPhoto: initialData?.carPhoto || null,
        motorbikePhoto: initialData?.motorbikePhoto || null,
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    const needsCar = serviceInfo?.rescueVehicles?.some((v: any) => v.type === 'CAR') || false;
    const needsMoto = serviceInfo?.rescueVehicles?.some((v: any) => v.type === 'MOTORCYCLE') || false;

    useEffect(() => { loadUploads(); }, []);

    const loadUploads = async () => {
        try {
            const existing = await getUserUploads(UploadPurpose.PROVIDER_VERIFICATION);
            const map: any = {};
            const docTypeMap: Record<string, string> = {
                'CITIZEN_ID_FRONT': 'citizenIdFront', 'CITIZEN_ID_BACK': 'citizenIdBack',
                'SELFIE': 'selfie', 'CAR_PHOTO': 'carPhoto', 'MOTORBIKE_PHOTO': 'motorbikePhoto',
            };
            existing.forEach((u: any) => {
                const k = docTypeMap[u.docType];
                if (k) map[k] = { id: u.id, publicUrl: u.publicUrl };
            });
            setUploads({ citizenIdFront: map.citizenIdFront || null, citizenIdBack: map.citizenIdBack || null, selfie: map.selfie || null, carPhoto: map.carPhoto || null, motorbikePhoto: map.motorbikePhoto || null });
        } catch { } finally { setLoading(false); }
    };

    const validate = () => {
        const e: Record<string, string> = {};
        if (!uploads.citizenIdFront) e.citizenIdFront = t('provider.onboarding.requiredDocs.errors.required');
        if (!uploads.citizenIdBack) e.citizenIdBack = t('provider.onboarding.requiredDocs.errors.required');
        if (!uploads.selfie) e.selfie = t('provider.onboarding.requiredDocs.errors.required');
        if (needsCar && !uploads.carPhoto) e.carPhoto = t('provider.onboarding.requiredDocs.errors.required');
        if (needsMoto && !uploads.motorbikePhoto) e.motorbikePhoto = t('provider.onboarding.requiredDocs.errors.required');
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    if (loading) return (
        <div className="flex items-center justify-center py-16">
            <div className="w-9 h-9 rounded-full border-[3px] border-t-transparent animate-spin" style={{ borderColor: C.orange, borderTopColor: 'transparent' }} />
        </div>
    );

    return (
        <div>
            {/* Identity */}
            <SectionCard
                title={t('provider.onboarding.requiredDocs.identity.title')}
                desc={t('provider.onboarding.requiredDocs.identity.desc')}>
                <div className="space-y-5 pt-1">
                    <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: C.navy }}>{t('provider.onboarding.requiredDocs.identity.citizenFront')} <span style={{ color: C.red }}>*</span></label>
                        <FileUpload purpose={UploadPurpose.PROVIDER_VERIFICATION} docType={DocumentType.CITIZEN_ID_FRONT} existingUpload={uploads.citizenIdFront} onSuccess={(u: any) => setUploads({ ...uploads, citizenIdFront: u })} />
                        {errors.citizenIdFront && <p className="mt-1 text-xs" style={{ color: C.red }}>{errors.citizenIdFront}</p>}
                    </div>
                    <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: C.navy }}>{t('provider.onboarding.requiredDocs.identity.citizenBack')} <span style={{ color: C.red }}>*</span></label>
                        <FileUpload purpose={UploadPurpose.PROVIDER_VERIFICATION} docType={DocumentType.CITIZEN_ID_BACK} existingUpload={uploads.citizenIdBack} onSuccess={(u: any) => setUploads({ ...uploads, citizenIdBack: u })} />
                        {errors.citizenIdBack && <p className="mt-1 text-xs" style={{ color: C.red }}>{errors.citizenIdBack}</p>}
                    </div>
                    <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: C.navy }}>{t('provider.onboarding.requiredDocs.identity.selfie')} <span style={{ color: C.red }}>*</span></label>
                        <p className="text-[11px] mb-2" style={{ color: C.gray }}>{t('provider.onboarding.requiredDocs.identity.selfieHint')}</p>
                        <FileUpload purpose={UploadPurpose.PROVIDER_VERIFICATION} docType={DocumentType.SELFIE} existingUpload={uploads.selfie} onSuccess={(u: any) => setUploads({ ...uploads, selfie: u })} />
                        {errors.selfie && <p className="mt-1 text-xs" style={{ color: C.red }}>{errors.selfie}</p>}
                    </div>
                </div>
            </SectionCard>

            {/* Vehicle photos */}
            {(needsCar || needsMoto) && (
                <SectionCard
                    title={t('provider.onboarding.requiredDocs.vehiclePhotos.title')}
                    desc={t('provider.onboarding.requiredDocs.vehiclePhotos.desc')}>
                    <div className="space-y-5 pt-1">
                        {needsCar && (
                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: C.navy }}>{t('provider.onboarding.requiredDocs.vehiclePhotos.carPhoto')} <span style={{ color: C.red }}>*</span></label>
                                <p className="text-[11px] mb-1" style={{ color: C.gray }}>
                                    {t('provider.onboarding.requiredDocs.vehiclePhotos.registeredCarPlates')}: {serviceInfo?.rescueVehicles?.filter((v: any) => v.type === 'CAR').map((v: any) => v.plateNumber).join(', ')}
                                </p>
                                <FileUpload purpose={UploadPurpose.PROVIDER_VERIFICATION} docType={DocumentType.CAR_PHOTO} existingUpload={uploads.carPhoto} onSuccess={(u: any) => setUploads({ ...uploads, carPhoto: u })} />
                                {errors.carPhoto && <p className="mt-1 text-xs" style={{ color: C.red }}>{errors.carPhoto}</p>}
                            </div>
                        )}
                        {needsMoto && (
                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: C.navy }}>{t('provider.onboarding.requiredDocs.vehiclePhotos.motorbikePhoto')} <span style={{ color: C.red }}>*</span></label>
                                <p className="text-[11px] mb-1" style={{ color: C.gray }}>
                                    {t('provider.onboarding.requiredDocs.vehiclePhotos.registeredMotorbikePlates')}: {serviceInfo?.rescueVehicles?.filter((v: any) => v.type === 'MOTORCYCLE').map((v: any) => v.plateNumber).join(', ')}
                                </p>
                                <FileUpload purpose={UploadPurpose.PROVIDER_VERIFICATION} docType={DocumentType.MOTORBIKE_PHOTO} existingUpload={uploads.motorbikePhoto} onSuccess={(u: any) => setUploads({ ...uploads, motorbikePhoto: u })} />
                                {errors.motorbikePhoto && <p className="mt-1 text-xs" style={{ color: C.red }}>{errors.motorbikePhoto}</p>}
                            </div>
                        )}
                    </div>
                </SectionCard>
            )}

            {/* Actions */}
            <div className="flex justify-between items-center pt-2">
                <button onClick={onBack} className="px-5 py-2.5 rounded-xl border text-sm font-medium transition-colors hover:bg-gray-50" style={{ borderColor: C.border, color: C.gray }}>{t('provider.onboarding.common.back')}</button>
                <button onClick={() => { if (validate()) onComplete(uploads); }} className="px-6 py-2.5 rounded-xl text-white text-sm font-semibold transition-all" style={{ background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)` }}>
                    {t('provider.onboarding.common.continue')} →
                </button>
            </div>
        </div>
    );
}
