'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserCircle2, Truck, CheckCircle, ArrowRight, Loader2 } from 'lucide-react';
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
                router.push('/provider/onboarding');
            }
        } catch (err: any) {
            console.error('Role selection error:', err);
            setError(err.response?.data?.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
                    <p className="mt-4 text-sm text-gray-600">Đang tải...</p>
                </div>
            </div>
        );
    }

    if (!user || user.profileCompleted) {
        return null;
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="max-w-4xl w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="p-8 md:p-12">
                    {/* Header */}
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-full mb-4">
                            <UserCircle2 className="w-8 h-8 text-blue-600" />
                        </div>
                        <h1 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-3">
                            Chọn Vai Trò Của Bạn
                        </h1>
                        <p className="text-sm text-gray-600">
                            Vui lòng chọn vai trò phù hợp để tiếp tục
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 border-l-4 border-red-500 bg-red-50 rounded-r-lg p-4">
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    )}

                    {/* Role Options */}
                    <div className="grid md:grid-cols-2 gap-6 mb-8">
                        {/* USER Option */}
                        <button
                            onClick={() => setSelectedRole('USER')}
                            disabled={isSubmitting}
                            className={`relative p-6 rounded-lg border-2 transition-all duration-200 text-left ${selectedRole === 'USER'
                                ? 'border-blue-600 bg-blue-50'
                                : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                                } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            {selectedRole === 'USER' && (
                                <div className="absolute top-4 right-4">
                                    <CheckCircle className="w-6 h-6 text-blue-600" />
                                </div>
                            )}
                            <div className="flex items-center mb-3">
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                                    <UserCircle2 className="w-6 h-6 text-blue-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">Người Dùng</h3>
                            </div>
                            <p className="text-sm text-gray-700 leading-relaxed">
                                Tôi cần sử dụng dịch vụ cứu hộ khi gặp sự cố trên đường
                            </p>
                        </button>

                        {/* PROVIDER Option */}
                        <button
                            onClick={() => setSelectedRole('PROVIDER')}
                            disabled={isSubmitting}
                            className={`relative p-6 rounded-lg border-2 transition-all duration-200 text-left ${selectedRole === 'PROVIDER'
                                ? 'border-green-600 bg-green-50'
                                : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                                } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            {selectedRole === 'PROVIDER' && (
                                <div className="absolute top-4 right-4">
                                    <CheckCircle className="w-6 h-6 text-green-600" />
                                </div>
                            )}
                            <div className="flex items-center mb-3">
                                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                                    <Truck className="w-6 h-6 text-green-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">Nhà Cung Cấp</h3>
                            </div>
                            <p className="text-sm text-gray-700 leading-relaxed">
                                Tôi cung cấp dịch vụ cứu hộ và muốn kết nối với khách hàng
                            </p>
                        </button>
                    </div>

                    {/* Continue Button */}
                    <button
                        onClick={handleContinue}
                        disabled={!selectedRole || isSubmitting}
                        className={`w-full py-3 px-6 rounded-lg font-medium text-white transition-all duration-200 flex items-center justify-center gap-2 ${!selectedRole || isSubmitting
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 border-2 border-blue-600 hover:border-blue-700'
                            }`}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Đang xử lý...</span>
                            </>
                        ) : (
                            <>
                                <span>Tiếp Tục</span>
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>

                    {/* Info */}
                    <p className="text-center text-sm text-gray-600 mt-6">
                        Bạn có thể cập nhật thông tin chi tiết ở bước tiếp theo
                    </p>
                </div>
            </div>
        </div>
    );
}
