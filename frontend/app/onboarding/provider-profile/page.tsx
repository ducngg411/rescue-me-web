'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function ProviderProfilePage() {
    const router = useRouter();
    const { user, loading } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        // Redirect if not authenticated
        if (!loading && !user) {
            router.push('/auth/login');
            return;
        }

        // Redirect if profile already completed
        if (user && user.profileCompleted) {
            router.push('/');
            return;
        }

        // Redirect if role is not PROVIDER
        if (user && user.role !== 'PROVIDER') {
            router.push('/onboarding/user-profile');
            return;
        }
    }, [user, loading, router]);

    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Đang tải...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
            <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Hoàn Thiện Hồ Sơ Nhà Cung Cấp
                    </h1>
                    <p className="text-gray-600">
                        Vui lòng cung cấp thông tin dịch vụ của bạn
                    </p>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
                    <div className="flex items-start">
                        <svg className="w-6 h-6 text-yellow-600 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <div>
                            <h3 className="text-sm font-medium text-yellow-800 mb-1">
                                Trang này đang được phát triển
                            </h3>
                            <p className="text-sm text-yellow-700">
                                Form đăng ký nhà cung cấp dịch vụ sẽ sớm được cập nhật. Hiện tại bạn có thể bỏ qua bước này.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                        <input
                            type="text"
                            value={user.email}
                            disabled
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Vai trò</label>
                        <input
                            type="text"
                            value="Nhà cung cấp (PROVIDER)"
                            disabled
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                        />
                    </div>

                    <div className="pt-4">
                        <button
                            onClick={() => router.push('/')}
                            className="w-full py-3 px-6 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold hover:from-green-700 hover:to-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                        >
                            Tiếp tục
                        </button>
                    </div>

                    <p className="text-center text-sm text-gray-500">
                        Bạn có thể hoàn thiện hồ sơ sau trong phần cài đặt
                    </p>
                </div>
            </div>
        </div>
    );
}
