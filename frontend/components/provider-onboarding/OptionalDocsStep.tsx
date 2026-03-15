'use client';

import React, { useState, useEffect } from 'react';
import { Info } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import FileUpload from '@/components/FileUpload';
import { UploadPurpose, DocumentType, getUserUploads } from '@/lib/upload';

const C = { orange: '#f97316', orangeDark: '#ea6c0a', orangeLight: '#fff7ed', navy: '#1a1a2e', gray: '#6b7280', border: '#e2e8f0', bg: '#f4f6f9' };

const SectionCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="bg-white rounded-2xl border p-5 mb-4" style={{ borderColor: C.border }}>
        <div className="flex items-center gap-2 mb-4 pb-3 border-b" style={{ borderColor: C.border }}>
            <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: C.orange }} />
            <h2 className="text-sm font-bold" style={{ color: C.navy }}>{title}</h2>
        </div>
        {children}
    </div>
);

interface OptionalDocsStepProps {
    initialData: any;
    serviceInfo: any;
    onComplete: (data: any) => void;
    onBack: () => void;
    onSkip: () => void;
    isShell?: boolean;
}

export default function OptionalDocsStep({ initialData, serviceInfo, onComplete, onBack, onSkip, isShell }: OptionalDocsStepProps) {
    const { t } = useLanguage();
    const [uploads, setUploads] = useState({ driverLicense: initialData?.driverLicense || null, businessLicense: initialData?.businessLicense || null });
    const [loading, setLoading] = useState(true);
    const isBusiness = serviceInfo?.providerType === 'BUSINESS';

    useEffect(() => { loadUploads(); }, []);

    const loadUploads = async () => {
        try {
            const existing = await getUserUploads(UploadPurpose.PROVIDER_VERIFICATION);
            const map: any = {};
            existing.forEach((u: any) => {
                if (u.docType === 'DRIVER_LICENSE') map.driverLicense = { id: u.id, publicUrl: u.publicUrl };
                if (u.docType === 'BUSINESS_REGISTRATION') map.businessLicense = { id: u.id, publicUrl: u.publicUrl };
            });
            setUploads({ driverLicense: map.driverLicense || null, businessLicense: map.businessLicense || null });
        } catch { } finally { setLoading(false); }
    };

    if (loading) return (
        <div className="flex items-center justify-center py-16">
            <div className="w-9 h-9 rounded-full border-[3px] border-t-transparent animate-spin" style={{ borderColor: C.orange, borderTopColor: 'transparent' }} />
        </div>
    );

    return (
        <div>
            {/* Info banner */}
            <div className="flex items-start gap-3 p-4 rounded-2xl mb-4" style={{ background: C.orangeLight, border: `1px solid #fed7aa` }}>
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: C.orange }} />
                <p className="text-xs leading-relaxed" style={{ color: '#92400e' }}>
                    {t('provider.onboarding.optionalDocs.infoPrefix')} <strong>{t('provider.onboarding.optionalDocs.infoEmphasis')}</strong> {t('provider.onboarding.optionalDocs.infoSuffix')}
                </p>
            </div>

            <SectionCard title={t('provider.onboarding.optionalDocs.title')}>
                <div className="space-y-5">
                    <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: C.navy }}>{t('provider.onboarding.optionalDocs.driverLicenseLabel')}</label>
                        <p className="text-[11px] mb-2" style={{ color: C.gray }}>{t('provider.onboarding.optionalDocs.driverLicenseHint')}</p>
                        <FileUpload purpose={UploadPurpose.PROVIDER_VERIFICATION} docType={DocumentType.DRIVER_LICENSE} existingUpload={uploads.driverLicense} onSuccess={(u: any) => setUploads({ ...uploads, driverLicense: u })} />
                    </div>
                    {isBusiness && (
                        <div>
                            <label className="block text-xs font-semibold mb-1" style={{ color: C.navy }}>{t('provider.onboarding.optionalDocs.businessLicenseLabel')}</label>
                            <p className="text-[11px] mb-2" style={{ color: C.gray }}>{t('provider.onboarding.optionalDocs.businessLicenseHint')}</p>
                            <FileUpload purpose={UploadPurpose.PROVIDER_VERIFICATION} docType={DocumentType.BUSINESS_REGISTRATION} existingUpload={uploads.businessLicense} onSuccess={(u: any) => setUploads({ ...uploads, businessLicense: u })} />
                        </div>
                    )}
                </div>
            </SectionCard>

            {/* Actions */}
            <div className="flex justify-between items-center pt-2">
                <button onClick={onBack} className="px-5 py-2.5 rounded-xl border text-sm font-medium transition-colors hover:bg-gray-50" style={{ borderColor: C.border, color: C.gray }}>{t('provider.onboarding.common.back')}</button>
                <div className="flex gap-2">
                    <button onClick={onSkip} className="px-5 py-2.5 rounded-xl border text-sm font-medium transition-colors hover:bg-gray-50" style={{ borderColor: C.border, color: C.gray }}>{t('provider.onboarding.common.skip')}</button>
                    <button onClick={() => onComplete(uploads)} className="px-6 py-2.5 rounded-xl text-white text-sm font-semibold transition-all" style={{ background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)` }}>
                        {t('provider.onboarding.common.continue')} →
                    </button>
                </div>
            </div>
        </div>
    );
}
