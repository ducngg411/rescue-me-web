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
            } else if (!user.profileCompleted) {
                // Chưa xong bước chọn role / hồ sơ cơ bản → cùng luồng với useProviderGuard
                router.push('/onboarding/role');
            } else if (user.verificationStatus === 'APPROVED') {
                // Provider đã verified → Active mode
                router.push('/provider/active');
            } else if (
                user.verificationStatus === 'PENDING' ||
                user.verificationStatus === 'REJECTED' ||
                user.verificationStatus === 'SUSPENDED'
            ) {
                // Chờ duyệt, bị từ chối, hoặc tạm khóa → Dashboard (cùng guard với useProviderGuard)
                router.push('/provider/dashboard');
            } else {
                // DRAFT hoặc chưa gửi xác minh: wizard onboarding (khớp useProviderGuard; có thể tiếp tục từ dữ liệu đã lưu bước 1)
                router.push('/provider/onboarding');
            }
        }
    }, [user, loading, router]);

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
    );
}
