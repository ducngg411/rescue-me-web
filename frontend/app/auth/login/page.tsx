'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { loginWithEmail, loginWithGoogle } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';

interface LoginFormData {
    email: string;
    password: string;
}

export default function LoginPage() {
    const router = useRouter();
    const { setUser } = useAuth();
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormData>();

    // ==================== EMAIL LOGIN ====================
    const onSubmitEmail = async (data: LoginFormData) => {
        setLoading(true);
        setError('');

        try {
            const response = await loginWithEmail(data.email, data.password);
            setUser(response.user);

            // Redirect based on role and profile completion status
            if (response.requiresProfileCompletion) {
                router.push('/onboarding/role');
            } else if (response.user.role === 'ADMIN') {
                // Admin goes to admin dashboard
                router.push('/admin/dashboard');
            } else if (response.user.role === 'PROVIDER') {
                // Provider goes to provider page
                router.push('/provider');
            } else {
                // Regular user goes to user page
                router.push('/user');
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Đăng nhập thất bại');
        } finally {
            setLoading(false);
        }
    };

    // ==================== GOOGLE LOGIN ====================
    const handleGoogleSuccess = async (credentialResponse: any) => {
        setLoading(true);
        setError('');

        try {
            const response = await loginWithGoogle(credentialResponse.credential);
            setUser(response.user);

            // Redirect based on role and profile completion status
            if (response.requiresProfileCompletion) {
                router.push('/onboarding/role');
            } else if (response.user.role === 'ADMIN') {
                // Admin goes to admin dashboard
                router.push('/admin/dashboard');
            } else if (response.user.role === 'PROVIDER') {
                // Provider goes to provider page
                router.push('/provider');
            } else {
                // Regular user goes to user page
                router.push('/user');
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Đăng nhập Google thất bại');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleError = () => {
        setError('Đăng nhập Google bị hủy');
    };

    return (
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''}>
            <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-md w-full space-y-8">
                    <div>
                        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                            Đăng nhập vào Rescue Me
                        </h2>
                        <p className="mt-2 text-center text-sm text-gray-600">
                            Hoặc{' '}
                            <a href="/auth/register" className="font-medium text-blue-600 hover:text-blue-500">
                                đăng ký tài khoản mới
                            </a>
                        </p>
                    </div>

                    {/* Google Login */}
                    <div className="flex justify-center">
                        <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={handleGoogleError}
                            text="continue_with"
                            locale="vi"
                        />
                    </div>

                    {/* Divider */}
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-gray-50 text-gray-500">Hoặc tiếp tục với email</span>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="rounded-md bg-red-50 p-4">
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    )}

                    {/* Email Login Form */}
                    <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmitEmail)}>
                        <div className="rounded-md shadow-sm -space-y-px">
                            <div>
                                <label htmlFor="email" className="sr-only">
                                    Email
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    autoComplete="email"
                                    {...register('email', {
                                        required: 'Email không được để trống',
                                        pattern: {
                                            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                            message: 'Email không hợp lệ',
                                        },
                                    })}
                                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                    placeholder="Email"
                                />
                                {errors.email && (
                                    <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                                )}
                            </div>
                            <div>
                                <label htmlFor="password" className="sr-only">
                                    Mật khẩu
                                </label>
                                <input
                                    id="password"
                                    type="password"
                                    autoComplete="current-password"
                                    {...register('password', {
                                        required: 'Mật khẩu không được để trống',
                                    })}
                                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                    placeholder="Mật khẩu"
                                />
                                {errors.password && (
                                    <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                                )}
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </GoogleOAuthProvider>
    );
}
