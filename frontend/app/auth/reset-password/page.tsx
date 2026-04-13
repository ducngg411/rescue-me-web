'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { resetPassword } from '@/lib/auth';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';
import { Suspense } from 'react';

interface ResetForm {
    newPassword: string;
    confirmPassword: string;
}

function ResetPasswordContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { t } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const token = searchParams.get('token');

    const { register, handleSubmit, watch, formState: { errors } } = useForm<ResetForm>();

    const onSubmit = async (data: ResetForm) => {
        if (!token) {
            toast.error(t('auth.resetPassword.missingToken'));
            return;
        }
        setLoading(true);
        try {
            await resetPassword(token, data.newPassword);
            setSuccess(true);
        } catch (err: any) {
            const msg = err.response?.data?.message || '';
            if (msg.includes('hết hạn') || msg.includes('hợp lệ') || msg.includes('sử dụng')) {
                toast.error(t('auth.resetPassword.invalidToken'));
            } else {
                toast.error(msg || 'Đặt lại mật khẩu thất bại. Vui lòng thử lại.');
            }
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = (hasError: boolean) => ({
        border: hasError ? '1.5px solid #dc2626' : '1.5px solid #e5e7eb',
        color: '#1a1a2e',
    });

    const EyeIcon = ({ show }: { show: boolean }) => show ? (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
        </svg>
    ) : (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    );

    if (!token) {
        return (
            <div className="text-center py-6">
                <div className="text-5xl mb-4">⚠️</div>
                <p className="text-sm" style={{ color: '#6b7280' }}>{t('auth.resetPassword.missingToken')}</p>
                <a href="/auth/forgot-password" className="mt-4 inline-block text-sm font-medium" style={{ color: '#f97316' }}>
                    Yêu cầu lại
                </a>
            </div>
        );
    }

    return (
        <div className="w-full max-w-sm">
            {/* Back link */}
            <a
                href="/auth/login"
                className="flex items-center gap-1.5 text-sm mb-6 transition-colors"
                style={{ color: '#6b7280' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#f97316')}
                onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Quay lại đăng nhập
            </a>

            {/* Header */}
            <div className="mb-6">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg, #ff6b35, #f7931e)' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
                <h1 className="text-2xl font-bold mb-1" style={{ color: '#1a1a2e' }}>
                    {t('auth.resetPassword.title')}
                </h1>
                <p className="text-sm" style={{ color: '#6b7280' }}>
                    {t('auth.resetPassword.subtitle')}
                </p>
            </div>

            {/* Success state */}
            {success ? (
                <div className="text-center py-6">
                    <div className="text-5xl mb-4">🔐</div>
                    <h2 className="text-lg font-bold mb-2" style={{ color: '#1a1a2e' }}>
                        {t('auth.resetPassword.successTitle')}
                    </h2>
                    <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
                        {t('auth.resetPassword.successDesc')}
                    </p>
                    <button
                        onClick={() => router.push('/auth/login')}
                        className="w-full py-2.5 rounded-lg font-semibold text-sm text-white transition-all"
                        style={{ background: '#f97316' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#ea6c0a')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#f97316')}
                    >
                        {t('auth.resetPassword.loginBtn')}
                    </button>
                </div>
            ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                    {/* New password */}
                    <div>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>
                            {t('auth.resetPassword.newPasswordLabel')}
                        </label>
                        <div className="relative">
                            <input
                                id="new-password"
                                type={showNew ? 'text' : 'password'}
                                autoComplete="new-password"
                                placeholder={t('auth.resetPassword.newPasswordPlaceholder')}
                                {...register('newPassword', {
                                    required: t('auth.resetPassword.passwordRequired'),
                                    minLength: { value: 8, message: t('auth.resetPassword.passwordMinLength') },
                                    pattern: { value: /^(?=.*[A-Z])(?=.*\d)/, message: t('auth.resetPassword.passwordPattern') },
                                })}
                                className="w-full px-4 py-2.5 pr-10 rounded-lg text-sm outline-none transition-all"
                                style={inputStyle(!!errors.newPassword)}
                                onFocus={e => { if (!errors.newPassword) e.target.style.border = '1.5px solid #f97316'; }}
                                onBlur={e => { if (!errors.newPassword) e.target.style.border = '1.5px solid #e5e7eb'; }}
                            />
                            <button type="button" onClick={() => setShowNew(!showNew)}
                                className="absolute inset-y-0 right-3 flex items-center" style={{ color: '#9ca3af' }}>
                                <EyeIcon show={showNew} />
                            </button>
                        </div>
                        {errors.newPassword && (
                            <p className="mt-1 text-xs" style={{ color: '#dc2626' }}>{errors.newPassword.message}</p>
                        )}
                    </div>

                    {/* Confirm password */}
                    <div>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>
                            {t('auth.resetPassword.confirmPasswordLabel')}
                        </label>
                        <div className="relative">
                            <input
                                id="confirm-password"
                                type={showConfirm ? 'text' : 'password'}
                                autoComplete="new-password"
                                placeholder={t('auth.resetPassword.confirmPasswordPlaceholder')}
                                {...register('confirmPassword', {
                                    required: t('auth.resetPassword.passwordRequired'),
                                    validate: v => v === watch('newPassword') || t('auth.resetPassword.passwordMismatch'),
                                })}
                                className="w-full px-4 py-2.5 pr-10 rounded-lg text-sm outline-none transition-all"
                                style={inputStyle(!!errors.confirmPassword)}
                                onFocus={e => { if (!errors.confirmPassword) e.target.style.border = '1.5px solid #f97316'; }}
                                onBlur={e => { if (!errors.confirmPassword) e.target.style.border = '1.5px solid #e5e7eb'; }}
                            />
                            <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                                className="absolute inset-y-0 right-3 flex items-center" style={{ color: '#9ca3af' }}>
                                <EyeIcon show={showConfirm} />
                            </button>
                        </div>
                        {errors.confirmPassword && (
                            <p className="mt-1 text-xs" style={{ color: '#dc2626' }}>{errors.confirmPassword.message}</p>
                        )}
                    </div>

                    {/* Password hints */}
                    <div className="rounded-lg px-4 py-3 text-xs space-y-1" style={{ background: '#f9fafb', border: '1px solid #f3f4f6' }}>
                        <p style={{ color: '#6b7280' }}>{t('auth.resetPassword.hintsTitle')}</p>
                        <p style={{ color: /[A-Z]/.test(watch('newPassword') || '') ? '#16a34a' : '#9ca3af' }}>{t('auth.resetPassword.hintUppercase')}</p>
                        <p style={{ color: /\d/.test(watch('newPassword') || '') ? '#16a34a' : '#9ca3af' }}>{t('auth.resetPassword.hintNumber')}</p>
                        <p style={{ color: (watch('newPassword') || '').length >= 8 ? '#16a34a' : '#9ca3af' }}>{t('auth.resetPassword.hintLength')}</p>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 rounded-lg font-semibold text-sm text-white transition-all mt-2"
                        style={{ background: loading ? '#fdba74' : '#f97316', cursor: loading ? 'not-allowed' : 'pointer' }}
                        onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#ea6c0a'; }}
                        onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#f97316'; }}
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>
                                {t('auth.resetPassword.submittingBtn')}
                            </span>
                        ) : t('auth.resetPassword.submitBtn')}
                    </button>
                </form>
            )}
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen flex" style={{ fontFamily: 'Lexend, sans-serif' }}>
            <div className="hidden lg:flex flex-1 relative min-h-0 overflow-hidden bg-gradient-to-br from-orange-50/80 via-gray-50 to-slate-50">
                <div className="absolute inset-0 flex items-center justify-center p-8 lg:p-12 xl:p-16">
                    <img
                        src="/illustration_route_planning.svg"
                        alt="Rescue Me Background"
                        className="max-w-full max-h-full w-auto h-auto object-contain object-center select-none"
                    />
                </div>
            </div>
            <div className="flex flex-1 lg:max-w-md xl:max-w-lg items-center justify-center bg-white px-8 py-12">
                <Suspense fallback={<div className="text-sm" style={{ color: '#6b7280' }}>Đang tải...</div>}>
                    <ResetPasswordContent />
                </Suspense>
            </div>
        </div>
    );
}
