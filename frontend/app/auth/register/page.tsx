'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { registerWithEmail, loginWithGoogle } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';

interface RegisterFormData {
    email: string;
    password: string;
    confirmPassword: string;
    name: string;
}

const getPasswordStrength = (password: string): 'weak' | 'medium' | 'strong' => {
    if (password.length < 8) return 'weak';

    const hasUpperCase = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (hasUpperCase && hasNumber && hasSpecialChar && password.length >= 12) {
        return 'strong';
    } else if (hasUpperCase && hasNumber) {
        return 'medium';
    }

    return 'weak';
};

export default function RegisterPage() {
    const router = useRouter();
    const { setUser } = useAuth();
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak');
    const [passwordValue, setPasswordValue] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const {
        register,
        handleSubmit,
        watch,
        getValues,
        formState: { errors },
    } = useForm<RegisterFormData>();

    const password = watch('password', '');
    const confirmPassword = watch('confirmPassword', '');

    // Update password strength whenever passwordValue changes
    useEffect(() => {
        if (passwordValue) {
            setPasswordStrength(getPasswordStrength(passwordValue));
        }
    }, [passwordValue]);

    // Update password strength on change
    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const pwd = e.target.value;
        setPasswordValue(pwd);
    };

    // ==================== EMAIL REGISTRATION ====================
    const onSubmitEmail = async (data: RegisterFormData) => {
        setLoading(true);
        setError('');

        // Validate password strength
        if (passwordStrength === 'weak') {
            setError('Mật khẩu không đủ mạnh. Vui lòng chọn mật khẩu mạnh hơn.');
            setLoading(false);
            return;
        }

        try {
            const response = await registerWithEmail(data.email, data.password, data.name);
            setUser(response.user);

            // Always redirect to role selection for new registrations
            router.push('/onboarding/role');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Đăng ký thất bại');
        } finally {
            setLoading(false);
        }
    };

    // ==================== GOOGLE REGISTRATION ====================
    const handleGoogleSuccess = async (credentialResponse: any) => {
        setLoading(true);
        setError('');

        try {
            const response = await loginWithGoogle(credentialResponse.credential);
            setUser(response.user);

            // Redirect based on profile completion status
            if (response.requiresProfileCompletion) {
                router.push('/onboarding/role');
            } else {
                router.push('/');
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

    const strengthColors = {
        weak: 'bg-red-500',
        medium: 'bg-yellow-500',
        strong: 'bg-green-500',
    };

    const strengthTexts = {
        weak: 'Yếu',
        medium: 'Trung bình',
        strong: 'Mạnh',
    };

    return (
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''}>
            <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-md w-full space-y-8">
                    <div>
                        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                            Đăng ký tài khoản
                        </h2>
                        <p className="mt-2 text-center text-sm text-gray-600">
                            Hoặc{' '}
                            <a href="/auth/login" className="font-medium text-blue-600 hover:text-blue-500">
                                đăng nhập nếu đã có tài khoản
                            </a>
                        </p>
                    </div>

                    {/* Google Registration */}
                    <div className="flex justify-center">
                        <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={handleGoogleError}
                            text="signup_with"
                            locale="vi"
                        />
                    </div>

                    {/* Divider */}
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-gray-50 text-gray-500">Hoặc đăng ký bằng email</span>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="rounded-md bg-red-50 p-4">
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    )}

                    {/* Email Registration Form */}
                    <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmitEmail)}>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                                    Họ và tên
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
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
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
                                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    placeholder="email@example.com"
                                />
                                {errors.email && (
                                    <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                                )}
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                    Mật khẩu
                                </label>
                                <div className="relative mt-1">
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        {...register('password', {
                                            required: 'Mật khẩu không được để trống',
                                            minLength: {
                                                value: 8,
                                                message: 'Mật khẩu phải có ít nhất 8 ký tự',
                                            },
                                            pattern: {
                                                value: /^(?=.*[A-Z])(?=.*\d)/,
                                                message: 'Mật khẩu phải có ít nhất 1 chữ hoa và 1 số',
                                            },
                                            onChange: handlePasswordChange,
                                        })}
                                        className="appearance-none relative block w-full px-3 py-2 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                                    >
                                        {showPassword ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                                {errors.password && (
                                    <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                                )}

                                {/* Password Strength Indicator */}
                                {passwordValue && (
                                    <div className="mt-2">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                                                <div
                                                    className={`h-2 rounded-full transition-all ${strengthColors[passwordStrength]}`}
                                                    style={{
                                                        width:
                                                            passwordStrength === 'weak'
                                                                ? '33%'
                                                                : passwordStrength === 'medium'
                                                                    ? '66%'
                                                                    : '100%',
                                                    }}
                                                />
                                            </div>
                                            <span className="text-sm text-gray-600">
                                                {strengthTexts[passwordStrength]}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                                    Xác nhận mật khẩu
                                </label>
                                <div className="relative mt-1">
                                    <input
                                        id="confirmPassword"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        {...register('confirmPassword', {
                                            required: 'Vui lòng xác nhận mật khẩu',
                                            validate: (value) => {
                                                const currentPassword = getValues('password');
                                                return value === currentPassword || 'Mật khẩu không khớp';
                                            },
                                        })}
                                        className="appearance-none relative block w-full px-3 py-2 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                                    >
                                        {showConfirmPassword ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                                {errors.confirmPassword && (
                                    <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
                                )}
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading || passwordStrength === 'weak'}
                                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Đang đăng ký...' : 'Đăng ký'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </GoogleOAuthProvider>
    );
}
