'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { CompleteProfileForm, CompleteProfileData } from '@/components/auth/CompleteProfileForm';

export default function CompleteProfilePage() {
    const router = useRouter();
    const { user, completeUserProfile, loading } = useAuth();

    useEffect(() => {
        if (!loading) {
            // Not logged
            if (!user) {
                router.push('/login');
                return;
            }

            // No role selected
            if (user.role == null) {
                router.push('/select-role');
                return;
            }

            // Profile already completed
            if (user.profileCompleted == true) {
                router.push('/')
                return;
            }
        }
    }, [user, completeUserProfile, loading]);

    const handleSubmit = async (data: CompleteProfileData) => {
        try {
            await completeUserProfile(
                data.phoneNumber,
                data.vehicleType,
                data.licensePlate,
                data.vehicleColor
            );

            router.push('/');
        } catch (error) {
            console.error('Failed to complete profile:', error);
            throw error;
        }
    };

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-gray-600">Đang tải...</p>
                </div>
            </div>
        );
    }

    if (!user || user.role === null || user.profileCompleted) {
        return null;
    }

    return (
        <div className="w-full max-w-2xl mx-auto">
            <div className="bg-card p-8 rounded-lg shadow-lg">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2">Hoàn tất hồ sơ</h1>
                    <p className="text-gray-600">
                        {user.role === 'user'
                            ? 'Cung cấp thông tin liên lạc và phương tiện của bạn'
                            : 'Cung cấp thông tin liên lạc để bắt đầu cung cấp dịch vụ'
                        }
                    </p>
                </div>

                <CompleteProfileForm
                    userRole={user.role as 'user' | 'provider'}
                    onSubmit={handleSubmit}
                />
            </div>
        </div>
    );
}
