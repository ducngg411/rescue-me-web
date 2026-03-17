'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { registerWithEmail, loginWithGoogle } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import toast from 'react-hot-toast';
import { resolveAuthErrorMessage } from '@/lib/i18n/authErrorMessages';

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
    if (hasUpperCase && hasNumber && hasSpecialChar && password.length >= 12) return 'strong';
    if (hasUpperCase && hasNumber) return 'medium';
    return 'weak';
};

export default function RegisterPage() {
    const router = useRouter();
    const { setUser } = useAuth();
    const { t, locale } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak');
    const [passwordValue, setPasswordValue] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const {
        register,
        handleSubmit,
        getValues,
        formState: { errors },
    } = useForm<RegisterFormData>();

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const pwd = e.target.value;
        setPasswordValue(pwd);
        setPasswordStrength(getPasswordStrength(pwd));
    };

    const onSubmitEmail = async (data: RegisterFormData) => {
        setLoading(true);
        if (passwordStrength === 'weak') {
            toast.error(t('auth.register.passwordWeak'));
            setLoading(false);
            return;
        }
        try {
            const response = await registerWithEmail(data.email, data.password, data.name);
            setUser(response.user);
            toast.success(t('auth.register.registerSuccess'));
            router.push('/onboarding/role');
        } catch (err: any) {
            toast.error(resolveAuthErrorMessage(err.response?.data?.message, t, 'auth.register.registerFailed'));
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse: any) => {
        setLoading(true);
        try {
            const response = await loginWithGoogle(credentialResponse.credential);
            setUser(response.user);
            toast.success(t('auth.register.googleRegisterSuccess'));
            if (response.requiresProfileCompletion) {
                router.push('/onboarding/role');
            } else {
                router.push('/');
            }
        } catch (err: any) {
            toast.error(resolveAuthErrorMessage(err.response?.data?.message, t, 'auth.login.googleLoginFailed'));
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleError = () => {
        toast.error(t('auth.login.googleLoginCancelled'));
    };

    const strengthConfig = {
        weak: { color: '#ef4444', label: t('auth.register.strength.weak'), width: '33%' },
        medium: { color: '#f59e0b', label: t('auth.register.strength.medium'), width: '66%' },
        strong: { color: '#10b981', label: t('auth.register.strength.strong'), width: '100%' },
    };

    const inputBase = "w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all";
    const borderNormal = '1.5px solid #e5e7eb';
    const borderFocus = '1.5px solid #f97316';
    const borderError = '1.5px solid #dc2626';

    return (
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''}>
            <div className="min-h-screen flex" style={{ fontFamily: 'Lexend, sans-serif' }}>

                {/* ── Left: Rescue illustration ── */}
                <div className="hidden lg:flex flex-1 relative overflow-hidden bg-gray-50">
                    <div className="absolute inset-0">
                        <img
                            src="/illustration_background_car.svg"
                            alt="Rescue Me Background"
                            className="w-full h-full object-cover"
                        />
                    </div>
                </div>

                {/* ── Right: Register card ── */}
                <div className="flex flex-1 lg:max-w-md xl:max-w-lg items-center justify-center bg-white px-8 py-10 relative">
                    {/* Language Switcher top-right */}
                    <div className="absolute top-4 right-6">
                        <LanguageSwitcher />
                    </div>

                    <div className="w-full max-w-sm">
                        {/* Mobile logo */}
                        <div className="flex items-center gap-2 mb-6 lg:hidden">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#f97316' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                    <path d="M12 2L4 7v10l8 5 8-5V7L12 2z" fill="white" opacity="0.9" />
                                </svg>
                            </div>
                            <span className="font-bold text-lg" style={{ color: '#1e1b4b' }}>Rescue Me</span>
                        </div>

                        {/* Heading */}
                        <h1 className="text-2xl font-bold mb-1" style={{ color: '#1a1a2e' }}>
                            {t('auth.register.title')}
                        </h1>
                        <p className="text-sm mb-5" style={{ color: '#6b7280' }}>
                            {t('auth.register.hasAccount')}{' '}
                            <a
                                href="/auth/login"
                                className="font-medium transition-colors"
                                style={{ color: '#f97316' }}
                                onMouseEnter={e => (e.currentTarget.style.color = '#ea6c0a')}
                                onMouseLeave={e => (e.currentTarget.style.color = '#f97316')}
                            >
                                {t('auth.register.loginLink')}
                            </a>
                        </p>

                        {/* Form */}
                        <form onSubmit={handleSubmit(onSubmitEmail)} className="space-y-3.5">
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>{t('auth.register.nameLabel')}</label>
                                <input
                                    id="name"
                                    type="text"
                                    placeholder={t('auth.register.namePlaceholder')}
                                    {...register('name', { required: t('auth.register.nameRequired') })}
                                    className={inputBase}
                                    style={{ border: errors.name ? borderError : borderNormal, color: '#1a1a2e' }}
                                    onFocus={e => { if (!errors.name) e.target.style.border = borderFocus; }}
                                    onBlur={e => { if (!errors.name) e.target.style.border = borderNormal; }}
                                />
                                {errors.name && <p className="mt-1 text-xs" style={{ color: '#dc2626' }}>{errors.name.message}</p>}
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>{t('auth.register.emailLabel')}</label>
                                <input
                                    id="email"
                                    type="email"
                                    autoComplete="email"
                                    placeholder="email@example.com"
                                    {...register('email', {
                                        required: t('auth.login.emailRequired'),
                                        pattern: { value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, message: t('auth.login.emailInvalid') },
                                    })}
                                    className={inputBase}
                                    style={{ border: errors.email ? borderError : borderNormal, color: '#1a1a2e' }}
                                    onFocus={e => { if (!errors.email) e.target.style.border = borderFocus; }}
                                    onBlur={e => { if (!errors.email) e.target.style.border = borderNormal; }}
                                />
                                {errors.email && <p className="mt-1 text-xs" style={{ color: '#dc2626' }}>{errors.email.message}</p>}
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>{t('auth.register.passwordLabel')}</label>
                                <div className="relative">
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        {...register('password', {
                                            required: t('auth.register.passwordRequired'),
                                            minLength: { value: 8, message: t('auth.register.passwordMinLength') },
                                            pattern: { value: /^(?=.*[A-Z])(?=.*\d)/, message: t('auth.register.passwordPattern') },
                                            onChange: handlePasswordChange,
                                        })}
                                        className={`${inputBase} pr-10`}
                                        style={{ border: errors.password ? borderError : borderNormal, color: '#1a1a2e' }}
                                        onFocus={e => { if (!errors.password) e.target.style.border = borderFocus; }}
                                        onBlur={e => { if (!errors.password) e.target.style.border = borderNormal; }}
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-3 flex items-center" style={{ color: '#9ca3af' }}>
                                        {showPassword ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        )}
                                    </button>
                                </div>
                                {errors.password && <p className="mt-1 text-xs" style={{ color: '#dc2626' }}>{errors.password.message}</p>}
                                {passwordValue && (
                                    <div className="mt-2 flex items-center gap-2">
                                        <div className="flex-1 rounded-full h-1.5 overflow-hidden" style={{ background: '#e5e7eb' }}>
                                            <div className="h-full rounded-full transition-all duration-300" style={{ width: strengthConfig[passwordStrength].width, background: strengthConfig[passwordStrength].color }} />
                                        </div>
                                        <span className="text-xs font-medium" style={{ color: strengthConfig[passwordStrength].color }}>{strengthConfig[passwordStrength].label}</span>
                                    </div>
                                )}
                            </div>

                            {/* Confirm password */}
                            <div>
                                <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>{t('auth.register.confirmPasswordLabel')}</label>
                                <div className="relative">
                                    <input
                                        id="confirmPassword"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        {...register('confirmPassword', {
                                            required: t('auth.register.confirmPasswordRequired'),
                                            validate: value => value === getValues('password') || t('auth.register.confirmPasswordMismatch'),
                                        })}
                                        className={`${inputBase} pr-10`}
                                        style={{ border: errors.confirmPassword ? borderError : borderNormal, color: '#1a1a2e' }}
                                        onFocus={e => { if (!errors.confirmPassword) e.target.style.border = borderFocus; }}
                                        onBlur={e => { if (!errors.confirmPassword) e.target.style.border = borderNormal; }}
                                    />
                                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-3 flex items-center" style={{ color: '#9ca3af' }}>
                                        {showConfirmPassword ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        )}
                                    </button>
                                </div>
                                {errors.confirmPassword && <p className="mt-1 text-xs" style={{ color: '#dc2626' }}>{errors.confirmPassword.message}</p>}
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={loading || passwordStrength === 'weak'}
                                className="w-full py-2.5 rounded-lg font-semibold text-sm text-white transition-all mt-1"
                                style={{
                                    background: loading || passwordStrength === 'weak' ? '#fdba74' : '#f97316',
                                    cursor: loading || passwordStrength === 'weak' ? 'not-allowed' : 'pointer',
                                }}
                                onMouseEnter={e => { if (!loading && passwordStrength !== 'weak') (e.currentTarget as HTMLButtonElement).style.background = '#ea6c0a'; }}
                                onMouseLeave={e => { if (!loading && passwordStrength !== 'weak') (e.currentTarget as HTMLButtonElement).style.background = '#f97316'; }}
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                                        {t('auth.register.registering')}
                                    </span>
                                ) : t('auth.register.registerButton')}
                            </button>
                        </form>

                        {/* OR divider */}
                        <div className="flex items-center gap-3 my-4">
                            <div className="flex-1 h-px" style={{ background: '#e5e7eb' }} />
                            <span className="text-xs font-medium" style={{ color: '#9ca3af' }}>{t('common.or')}</span>
                            <div className="flex-1 h-px" style={{ background: '#e5e7eb' }} />
                        </div>

                        {/* Google */}
                        <div className="flex justify-center">
                            <GoogleLogin
                                onSuccess={handleGoogleSuccess}
                                onError={handleGoogleError}
                                text="signup_with"
                                locale={locale}
                                width="360"
                                shape="rectangular"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </GoogleOAuthProvider>
    );
}
