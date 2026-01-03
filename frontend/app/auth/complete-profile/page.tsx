'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { completeProfile } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';

interface ProfileFormData {
    name: string;
    phone: string;
    address: string;
    emergencyContact: string;
}

export default function CompleteProfilePage() {
    const router = useRouter();
    const { refreshUser } = useAuth();
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<ProfileFormData>();

    const onSubmit = async (data: ProfileFormData) => {
        setLoading(true);
        setError('');

        try {
            await completeProfile(data);
            await refreshUser();

            // Redirect to home after successful profile completion
            router.push('/');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Hoàn thiện profile thất bại');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Hoàn thiện thông tin cá nhân
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Vui lòng cung cấp thông tin để chúng tôi có thể hỗ trợ bạn tốt hơn trong trường hợp khẩn cấp
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="rounded-md bg-red-50 p-4">
                        <p className="text-sm text-red-800">{error}</p>
                    </div>
                )}

                {/* Profile Form */}
                <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                                Họ và tên <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="name"
                                type="text"
                                {...register('name', {
                                    required: 'Họ và tên không được để trống',
                                })}
                                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                placeholder="Nguyễn Văn A"
                            />
                            {errors.name && (
                                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                                Số điện thoại <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="phone"
                                type="tel"
                                {...register('phone', {
                                    required: 'Số điện thoại không được để trống',
                                    pattern: {
                                        value: /^[0-9]{10,11}$/,
                                        message: 'Số điện thoại không hợp lệ (10-11 chữ số)',
                                    },
                                })}
                                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                placeholder="0123456789"
                            />
                            {errors.phone && (
                                <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                                Địa chỉ <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                id="address"
                                rows={3}
                                {...register('address', {
                                    required: 'Địa chỉ không được để trống',
                                })}
                                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                placeholder="123 Đường ABC, Quận XYZ, TP. HCM"
                            />
                            {errors.address && (
                                <p className="mt-1 text-sm text-red-600">{errors.address.message}</p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="emergencyContact" className="block text-sm font-medium text-gray-700">
                                Liên hệ khẩn cấp <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="emergencyContact"
                                type="text"
                                {...register('emergencyContact', {
                                    required: 'Liên hệ khẩn cấp không được để trống',
                                })}
                                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                placeholder="Họ tên người thân - Số điện thoại"
                            />
                            {errors.emergencyContact && (
                                <p className="mt-1 text-sm text-red-600">{errors.emergencyContact.message}</p>
                            )}
                            <p className="mt-1 text-xs text-gray-500">
                                Ví dụ: Nguyễn Văn B - 0987654321 (Mẹ)
                            </p>
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Đang lưu...' : 'Hoàn tất'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
