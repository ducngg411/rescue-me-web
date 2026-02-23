'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function ProviderPage() {
    const router = useRouter();
    const { user, loading } = useAuth();

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push('/auth/login');
            } else if (user.role !== 'PROVIDER') {
                router.push('/');
            } else if (user.verificationStatus === 'APPROVED') {
                // Provider đã verified → Active mode
                router.push('/provider/active');
            } else if (user.verificationStatus === 'PENDING') {
                // Đang chờ duyệt → Dashboard
                router.push('/provider/dashboard');
            } else {
                // DRAFT/REJECTED → Verification page
                router.push('/provider/verification');
            }
        }
    }, [user, loading, router]);

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
    );
}
