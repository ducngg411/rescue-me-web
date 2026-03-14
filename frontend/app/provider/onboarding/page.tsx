'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuthGuard } from '@/lib/guards';
import api from '@/lib/api';

import {
    ServiceInfoStep,
    RequiredDocsStep,
    OptionalDocsStep,
    ReviewSubmitStep
} from '@/components/provider-onboarding';

const C = { orange: '#f97316', orangeDark: '#ea6c0a', navy: '#1a1a2e', gray: '#6b7280', border: '#e2e8f0', bg: '#f4f6f9', green: '#16a34a' };

const STEPS = [
    { n: 1, label: 'Thông tin dịch vụ' },
    { n: 2, label: 'Tài liệu bắt buộc' },
    { n: 3, label: 'Tài liệu tùy chọn' },
    { n: 4, label: 'Xem lại & Gửi' },
];

const STEP_DESC = [
    'Thông tin về dịch vụ, phương tiện và vùng hoạt động của bạn',
    'CCCD, ảnh selfie và ảnh phương tiện để xác minh danh tính',
    'Bằng lái xe, giấy phép kinh doanh — tăng độ tin cậy (tùy chọn)',
    'Kiểm tra lại tất cả trước khi gửi cho admin xét duyệt',
];

export default function ProviderOnboardingPage() {
    const router = useRouter();
    const { isReady } = useAuthGuard({ requireAuth: true });
    const [currentStep, setCurrentStep] = useState(1);
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [serviceInfo, setServiceInfo] = useState<any>(null);
    const [requiredDocs, setRequiredDocs] = useState<any>(null);
    const [optionalDocs, setOptionalDocs] = useState<any>(null);

    // Refs for step submit triggers
    const [stepTrigger, setStepTrigger] = useState(0);

    useEffect(() => {
        if (isReady) loadProfile();
    }, [isReady]);

    const loadProfile = async () => {
        try {
            const res = await api.get('/me/provider/profile');
            setProfile(res.data);
            if (res.data.verificationStatus !== 'DRAFT' && res.data.verificationStatus !== 'REJECTED') {
                router.push('/provider/dashboard');
            }
        } catch (err) {
            console.error('Failed to load profile:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleStepComplete = async (stepData: any) => {
        if (currentStep === 1) {
            try {
                setServiceInfo(stepData);
                await api.put('/me/provider/profile', stepData);
                setCurrentStep(2);
            } catch (err) {
                console.error('Failed to save service info:', err);
                alert('Không thể lưu thông tin. Vui lòng thử lại.');
            }
        } else if (currentStep === 2) {
            setRequiredDocs(stepData);
            setCurrentStep(3);
        } else if (currentStep === 3) {
            setOptionalDocs(stepData);
            setCurrentStep(4);
        } else if (currentStep === 4) {
            await submitVerification();
        }
    };

    const handleSkipOptional = () => { setOptionalDocs({}); setCurrentStep(4); };

    const submitVerification = async () => {
        setIsSubmitting(true);
        try {
            const uploadIds = [
                requiredDocs?.citizenIdFront?.id, requiredDocs?.citizenIdBack?.id,
                requiredDocs?.selfie?.id, requiredDocs?.carPhoto?.id, requiredDocs?.motorbikePhoto?.id,
                optionalDocs?.driverLicense?.id, optionalDocs?.businessLicense?.id,
            ].filter(Boolean);
            const res = await api.post('/me/provider/submit-verification', { uploadIds });
            if (res.data.success) router.push('/provider/dashboard?verification=submitted');
            else alert(res.data.message || 'Failed to submit verification');
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to submit verification');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isReady || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg, fontFamily: 'Poppins, sans-serif' }}>
                <div className="w-10 h-10 rounded-full border-[3px] border-t-transparent animate-spin" style={{ borderColor: C.orange, borderTopColor: 'transparent' }} />
            </div>
        );
    }

    return (
        <div className="h-screen flex overflow-hidden" style={{ background: C.bg, fontFamily: 'Poppins, sans-serif' }}>

            {/* ─── Left navy panel ─── */}
            <div className="hidden lg:flex flex-col gap-8 p-10 flex-shrink-0 h-screen overflow-y-auto" style={{ width: '300px', background: `linear-gradient(155deg, ${C.navy} 0%, #2d2d4e 100%)` }}>
                {/* Logo */}
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: C.orange }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 7v10l8 5 8-5V7L12 2z" fill="white" opacity="0.9" /></svg>
                    </div>
                    <span className="text-white font-bold text-base">RescueMe</span>
                </div>

                {/* Steps */}
                <div className="space-y-5">
                    <div>
                        <h2 className="text-white text-xl font-bold mb-1">Hồ sơ nhà cung cấp</h2>
                        <p className="text-white/50 text-xs leading-relaxed">Hoàn thành các bước để được xét duyệt trong 24–48h</p>
                    </div>
                    <div className="space-y-3">
                        {/* Step 0: Role selection always done */}
                        <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all duration-300"
                                style={{ background: C.green, color: 'white' }}>✓</div>
                            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>Chọn vai trò</span>
                        </div>
                        {STEPS.map(step => {
                            const done = currentStep > step.n;
                            const active = currentStep === step.n;
                            return (
                                <div key={step.n} className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all duration-300"
                                        style={{ background: done ? C.green : active ? C.orange : 'rgba(255,255,255,0.12)', color: 'white' }}>
                                        {done ? '✓' : step.n}
                                    </div>
                                    <span className="text-sm transition-colors duration-300"
                                        style={{ color: done || active ? 'white' : 'rgba(255,255,255,0.4)' }}>
                                        {step.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Tip card */}
                    <div className="bg-white/10 rounded-2xl p-4 border border-white/10 space-y-1.5">
                        <p className="text-white text-xs font-semibold">Sau khi hoàn thành:</p>
                        {['Hồ sơ chuyển sang trạng thái Chờ duyệt', 'Admin xem xét trong 24–48h', 'Bạn nhận thông báo kết quả qua email'].map(t => (
                            <div key={t} className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: C.orange }} />
                                <p className="text-white/65 text-xs leading-relaxed">{t}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <p className="text-white/25 text-xs">© 2024 RescueMe. All rights reserved.</p>
            </div>

            {/* ─── Right form panel ─── */}
            <div className="flex-1 overflow-y-auto h-screen">
                <div className="min-h-full flex flex-col py-10 px-6 max-w-2xl mx-auto">

                    {/* Mobile logo */}
                    <div className="flex items-center gap-2 mb-6 lg:hidden">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.orange }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 7v10l8 5 8-5V7L12 2z" fill="white" opacity="0.9" /></svg>
                        </div>
                        <span className="font-bold" style={{ color: C.navy }}>RescueMe</span>
                    </div>

                    {/* Step header */}
                    <div className="mb-6">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#fff7ed', color: C.orange }}>
                                Bước {currentStep} / {STEPS.length}
                            </span>
                        </div>
                        <h1 className="text-2xl font-bold" style={{ color: C.navy }}>{STEPS[currentStep - 1].label}</h1>
                        <p className="text-sm mt-0.5" style={{ color: C.gray }}>{STEP_DESC[currentStep - 1]}</p>
                    </div>

                    {/* Progress bar */}
                    <div className="flex gap-1.5 mb-8">
                        {STEPS.map(s => (
                            <div key={s.n} className="flex-1 h-2 rounded-full transition-all duration-500"
                                style={{ background: s.n <= currentStep ? C.orange : '#e5e7eb' }} />
                        ))}
                    </div>

                    {/* Step content */}
                    <div className="flex-1">
                        {currentStep === 1 && (
                            <ServiceInfoStep
                                initialData={serviceInfo || profile}
                                onComplete={handleStepComplete}
                                onBack={() => router.push('/provider/dashboard')}
                                isShell
                            />
                        )}
                        {currentStep === 2 && (
                            <RequiredDocsStep
                                initialData={requiredDocs}
                                serviceInfo={serviceInfo || profile}
                                onComplete={handleStepComplete}
                                onBack={() => setCurrentStep(1)}
                                isShell
                            />
                        )}
                        {currentStep === 3 && (
                            <OptionalDocsStep
                                initialData={optionalDocs}
                                serviceInfo={serviceInfo || profile}
                                onComplete={handleStepComplete}
                                onBack={() => setCurrentStep(2)}
                                onSkip={handleSkipOptional}
                                isShell
                            />
                        )}
                        {currentStep === 4 && (
                            <ReviewSubmitStep
                                serviceInfo={serviceInfo || profile}
                                requiredDocs={requiredDocs || {}}
                                optionalDocs={optionalDocs || {}}
                                onBack={() => setCurrentStep(3)}
                                isShell
                                isSubmitting={isSubmitting}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
