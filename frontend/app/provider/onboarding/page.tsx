'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthGuard } from '@/lib/guards';
import api from '@/lib/api';

// Import step components
import {
    ServiceInfoStep,
    RequiredDocsStep,
    OptionalDocsStep,
    ReviewSubmitStep
} from '@/components/provider-onboarding';

export default function ProviderOnboardingPage() {
    const router = useRouter();
    const { isReady } = useAuthGuard({ requireAuth: true });
    const [currentStep, setCurrentStep] = useState(1);
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Store data from each step
    const [serviceInfo, setServiceInfo] = useState<any>(null);
    const [requiredDocs, setRequiredDocs] = useState<any>(null);
    const [optionalDocs, setOptionalDocs] = useState<any>(null);

    useEffect(() => {
        if (isReady) {
            loadProfile();
        }
    }, [isReady]);

    const loadProfile = async () => {
        try {
            const res = await api.get('/me/provider/profile');
            setProfile(res.data);

            // If already submitted or approved, redirect to dashboard
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
            // Save service info first, then move to step 2
            try {
                setServiceInfo(stepData);
                await saveServiceInfo(stepData);
                setCurrentStep(2);
            } catch (err) {
                console.error('Failed to save service info:', err);
                alert('Không thể lưu thông tin. Vui lòng thử lại.');
            }
        } else if (currentStep === 2) {
            // Save required docs and move to step 3
            setRequiredDocs(stepData);
            setCurrentStep(3);
        } else if (currentStep === 3) {
            // Save optional docs and move to step 4
            setOptionalDocs(stepData);
            setCurrentStep(4);
        } else if (currentStep === 4) {
            // Final submit
            await submitVerification();
        }
    };

    const handleSkipOptional = () => {
        setOptionalDocs({});
        setCurrentStep(4);
    };

    const saveServiceInfo = async (data: any) => {
        try {
            const res = await api.put('/me/provider/profile', data);
            console.log('Profile saved, status:', res.data.verificationStatus);
            // Update local profile state without triggering redirect
            setProfile(res.data);
        } catch (err: any) {
            console.error('Save profile error:', err);
            throw new Error(err.response?.data?.message || 'Failed to save profile');
        }
    };

    const submitVerification = async () => {
        try {
            // Collect all upload IDs
            const uploadIds = [
                requiredDocs?.citizenIdFront?.id,
                requiredDocs?.citizenIdBack?.id,
                requiredDocs?.selfie?.id,
                requiredDocs?.carPhoto?.id,
                requiredDocs?.motorbikePhoto?.id,
                optionalDocs?.driverLicense?.id,
                optionalDocs?.businessLicense?.id,
            ].filter(Boolean);

            const res = await api.post('/me/provider/submit-verification', { uploadIds });
            if (res.data.success) {
                router.push('/provider/dashboard?verification=submitted');
            } else {
                alert(res.data.message || 'Failed to submit verification');
            }
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to submit verification');
        }
    };

    if (!isReady || loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                {/* Progress Steps */}
                <div className="mb-8">
                    <div className="flex items-center">
                        {[1, 2, 3, 4].map((step) => (
                            <React.Fragment key={step}>
                                <div className="flex flex-col items-center">
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${currentStep >= step
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-300 text-gray-700'
                                            }`}
                                    >
                                        {step}
                                    </div>
                                    <span className={`text-xs mt-2 font-medium whitespace-nowrap ${currentStep >= step ? 'text-blue-600' : 'text-gray-500'
                                        }`}>
                                        {step === 1 && 'Thông tin dịch vụ'}
                                        {step === 2 && 'Tài liệu bắt buộc'}
                                        {step === 3 && 'Tài liệu tùy chọn'}
                                        {step === 4 && 'Xem lại & Gửi'}
                                    </span>
                                </div>
                                {step < 4 && (
                                    <div
                                        className={`flex-1 h-1 mx-3 ${currentStep > step ? 'bg-blue-600' : 'bg-gray-300'
                                            }`}
                                    />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* Step Content */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                    {currentStep === 1 && (
                        <ServiceInfoStep
                            initialData={serviceInfo || profile}
                            onComplete={handleStepComplete}
                            onBack={() => router.push('/provider/dashboard')}
                        />
                    )}
                    {currentStep === 2 && (
                        <RequiredDocsStep
                            initialData={requiredDocs}
                            serviceInfo={serviceInfo || profile}
                            onComplete={handleStepComplete}
                            onBack={() => setCurrentStep(1)}
                        />
                    )}
                    {currentStep === 3 && (
                        <OptionalDocsStep
                            initialData={optionalDocs}
                            serviceInfo={serviceInfo || profile}
                            onComplete={handleStepComplete}
                            onBack={() => setCurrentStep(2)}
                            onSkip={handleSkipOptional}
                        />
                    )}
                    {currentStep === 4 && (
                        <ReviewSubmitStep
                            serviceInfo={serviceInfo || profile}
                            requiredDocs={requiredDocs || {}}
                            optionalDocs={optionalDocs || {}}
                            onBack={() => setCurrentStep(3)}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
