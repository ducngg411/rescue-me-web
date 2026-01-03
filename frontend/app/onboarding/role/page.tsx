'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { selectRole } from '@/lib/auth';

export default function RoleSelectionPage() {
    const router = useRouter();
    const { user, loading, refreshUser } = useAuth();
    const [selectedRole, setSelectedRole] = useState<'USER' | 'PROVIDER' | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

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
    }, [user, loading, router]);

    const handleContinue = async () => {
        if (!selectedRole) {
            setError('Vui lòng chọn vai trò của bạn');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            await selectRole(selectedRole);
            await refreshUser();

            // Redirect based on role
            if (selectedRole === 'USER') {
                router.push('/onboarding/user-profile');
            } else {
                router.push('/onboarding/provider-profile');
            }
        } catch (err: any) {
            console.error('Role selection error:', err);
            setError(err.response?.data?.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Đang tải...</p>
                </div>
            </div>
        );
    }

    if (!user || user.profileCompleted) {
        return null;
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
            <div className="max-w-4xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
                <div className="p-8 md:p-12">
                    {/* Header */}
                    <div className="text-center mb-12">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
                            Chọn Vai Trò Của Bạn
                        </h1>
                        <p className="text-gray-600 text-lg">
                            Vui lòng chọn vai trò phù hợp để tiếp tục
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-red-800 text-sm">{error}</p>
                        </div>
                    )}

                    {/* Role Options */}
                    <div className="grid md:grid-cols-2 gap-6 mb-8">
                        {/* USER Option */}
                        <button
                            onClick={() => setSelectedRole('USER')}
                            disabled={isSubmitting}
                            className={`relative p-8 rounded-xl border-2 transition-all duration-200 text-left ${selectedRole === 'USER'
                                ? 'border-blue-600 bg-blue-50 shadow-lg scale-105'
                                : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                                } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            {selectedRole === 'USER' && (
                                <div className="absolute top-4 right-4">
                                    <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center mb-4">
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-gray-900">Người Dùng</h3>
                            </div>
                            <p className="text-gray-600 leading-relaxed">
                                Tôi cần sử dụng dịch vụ cứu hộ khi gặp sự cố trên đường
                            </p>
                        </button>

                        {/* PROVIDER Option */}
                        <button
                            onClick={() => setSelectedRole('PROVIDER')}
                            disabled={isSubmitting}
                            className={`relative p-8 rounded-xl border-2 transition-all duration-200 text-left ${selectedRole === 'PROVIDER'
                                ? 'border-green-600 bg-green-50 shadow-lg scale-105'
                                : 'border-gray-200 hover:border-green-300 hover:shadow-md'
                                } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            {selectedRole === 'PROVIDER' && (
                                <div className="absolute top-4 right-4">
                                    <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center mb-4">
                                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-gray-900">Nhà Cung Cấp</h3>
                            </div>
                            <p className="text-gray-600 leading-relaxed">
                                Tôi cung cấp dịch vụ cứu hộ và muốn kết nối với khách hàng
                            </p>
                        </button>
                    </div>

                    {/* Continue Button */}
                    <button
                        onClick={handleContinue}
                        disabled={!selectedRole || isSubmitting}
                        className={`w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-200 ${!selectedRole || isSubmitting
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'
                            }`}
                    >
                        {isSubmitting ? (
                            <span className="flex items-center justify-center">
                                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Đang xử lý...
                            </span>
                        ) : (
                            'Tiếp Tục'
                        )}
                    </button>

                    {/* Info */}
                    <p className="text-center text-sm text-gray-500 mt-6">
                        Bạn có thể cập nhật thông tin chi tiết ở bước tiếp theo
                    </p>
                </div>
            </div>
        </div>
    );
}
