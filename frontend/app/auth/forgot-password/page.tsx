'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { forgotPasswordByEmail, forgotPasswordByPhone } from '@/lib/auth';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';

type Tab = 'email' | 'phone';
type PhoneStep = 'input' | 'otp';

interface EmailForm { email: string; }
interface PhoneForm { phone: string; }
interface OtpForm { otp: string; }

export default function ForgotPasswordPage() {
    const router = useRouter();
    const { t } = useLanguage();
    const [tab, setTab] = useState<Tab>('email');
    const [loading, setLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

    // Phone flow state
    const [phoneStep, setPhoneStep] = useState<PhoneStep>('input');
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
    const recaptchaContainerRef = useRef<HTMLDivElement>(null);
    const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

    const emailForm = useForm<EmailForm>();
    const phoneForm = useForm<PhoneForm>();
    const otpForm = useForm<OtpForm>();

    // Cooldown countdown
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendCooldown]);

    // Cleanup recaptcha on unmount
    useEffect(() => {
        return () => {
            if (recaptchaVerifierRef.current) {
                recaptchaVerifierRef.current.clear();
            }
        };
    }, []);

    const initRecaptcha = () => {
        if (!recaptchaVerifierRef.current && recaptchaContainerRef.current) {
            recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
                size: 'invisible',
            });
        }
        return recaptchaVerifierRef.current!;
    };

    // ── Email flow ──
    const onSubmitEmail = async (data: EmailForm) => {
        setLoading(true);
        try {
            await forgotPasswordByEmail(data.email);
            setEmailSent(true);
            setResendCooldown(30);
        } catch (err: any) {
            const msg = err?.response?.data?.message;
            toast.error(msg || t('auth.forgotPassword.sendEmailError'));
        } finally {
            setLoading(false);
        }
    };

    // ── Phone flow: send OTP ──
    const normalizePhone = (raw: string): string => {
        const cleaned = raw.replace(/[\s\-().]/g, '');
        // 0xxxxxxxxx (10 digits) → +84xxxxxxxxx
        if (/^0\d{9}$/.test(cleaned)) return '+84' + cleaned.slice(1);
        // already E.164
        if (cleaned.startsWith('+')) return cleaned;
        return cleaned;
    };

    const getFirebasePhoneError = (code: string): string => {
        switch (code) {
            case 'auth/invalid-phone-number':
                return t('auth.forgotPassword.phoneInvalid');
            case 'auth/too-many-requests':
                return t('auth.forgotPassword.phoneTooManyRequests');
            case 'auth/quota-exceeded':
                return t('auth.forgotPassword.phoneQuotaExceeded');
            case 'auth/captcha-check-failed':
                return t('auth.forgotPassword.phoneCaptchaFailed');
            case 'auth/missing-phone-number':
                return t('auth.forgotPassword.phoneMissing');
            default:
                return t('auth.forgotPassword.phoneOtpError').replace('{{code}}', code);
        }
    };

    const onSendOtp = async (data: PhoneForm) => {
        const e164Phone = normalizePhone(data.phone);
        setLoading(true);
        try {
            const verifier = initRecaptcha();
            const result = await signInWithPhoneNumber(auth, e164Phone, verifier);
            setConfirmationResult(result);
            setPhoneStep('otp');
            toast.success(t('auth.forgotPassword.otpSentTo') + ' ' + e164Phone);
        } catch (err: any) {
            // Reset recaptcha on error so user can retry
            if (recaptchaVerifierRef.current) {
                recaptchaVerifierRef.current.clear();
                recaptchaVerifierRef.current = null;
            }
            toast.error(getFirebasePhoneError(err?.code || ''));
        } finally {
            setLoading(false);
        }
    };

    // ── Phone flow: verify OTP ──
    const onVerifyOtp = async (data: OtpForm) => {
        if (!confirmationResult) return;
        setLoading(true);
        try {
            const userCredential = await confirmationResult.confirm(data.otp);
            const firebaseIdToken = await userCredential.user.getIdToken();
            const result = await forgotPasswordByPhone(firebaseIdToken);
            toast.success(t('auth.forgotPassword.otpSuccessTitle'));
            // Redirect to reset-password page with token
            router.push(`/auth/reset-password?token=${result.resetToken}`);
        } catch (err: any) {
            toast.error(err.code === 'auth/invalid-verification-code'
                ? t('auth.forgotPassword.otpInvalidCode')
                : t('auth.forgotPassword.otpVerifyError'));
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = (hasError: boolean) => ({
        border: hasError ? '1.5px solid #dc2626' : '1.5px solid #e5e7eb',
        color: '#1a1a2e',
    });

    return (
        <div className="min-h-screen flex" style={{ fontFamily: 'Lexend, sans-serif' }}>
            {/* Left illustration */}
            <div className="hidden lg:flex flex-1 relative min-h-0 overflow-hidden bg-gradient-to-br from-orange-50/80 via-gray-50 to-slate-50">
                <div className="absolute inset-0 flex items-center justify-center p-8 lg:p-12 xl:p-16">
                    <img
                        src="/illustration_route_planning.svg"
                        alt="Rescue Me Background"
                        className="max-w-full max-h-full w-auto h-auto object-contain object-center select-none"
                    />
                </div>
            </div>

            {/* Right: form card */}
            <div className="flex flex-1 lg:max-w-md xl:max-w-lg items-center justify-center bg-white px-8 py-12 relative">
                <div className="w-full max-w-sm">
                    {/* Back to login */}
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
                        {t('auth.forgotPassword.backToLogin')}
                    </a>

                    {/* Header */}
                    <div className="mb-6">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg, #ff6b35, #f7931e)' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0110 0v4" strokeLinecap="round" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold mb-1" style={{ color: '#1a1a2e' }}>
                            {t('auth.forgotPassword.title')}
                        </h1>
                        <p className="text-sm" style={{ color: '#6b7280' }}>
                            {t('auth.forgotPassword.subtitle')}
                        </p>
                    </div>

                    {/* Tabs */}
                    <div className="flex rounded-lg p-1 mb-6" style={{ background: '#f3f4f6' }}>
                        {(['email', 'phone'] as Tab[]).map(t2 => (
                            <button
                                key={t2}
                                onClick={() => { setTab(t2); setEmailSent(false); setPhoneStep('input'); }}
                                className="flex-1 py-2 text-sm font-medium rounded-md transition-all"
                                style={{
                                    background: tab === t2 ? '#ffffff' : 'transparent',
                                    color: tab === t2 ? '#f97316' : '#6b7280',
                                    boxShadow: tab === t2 ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                }}
                            >
                                {t2 === 'email' ? t('auth.forgotPassword.tabEmail') : t('auth.forgotPassword.tabPhone')}
                            </button>
                        ))}
                    </div>

                    {/* ── EMAIL TAB ── */}
                    {tab === 'email' && (
                        emailSent ? (
                            <div className="text-center py-6">
                                <div className="text-5xl mb-4">📬</div>
                                <h2 className="text-lg font-bold mb-2" style={{ color: '#1a1a2e' }}>
                                    {t('auth.forgotPassword.emailSentTitle')}
                                </h2>
                                <p className="text-sm leading-relaxed" style={{ color: '#6b7280' }}>
                                    {t('auth.forgotPassword.emailSentDesc')}
                                </p>
                                <button
                                    onClick={() => { setEmailSent(false); }}
                                    disabled={resendCooldown > 0}
                                    className="mt-6 text-sm font-medium transition-colors"
                                    style={{
                                        color: resendCooldown > 0 ? '#9ca3af' : '#f97316',
                                        cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                                    }}
                                >
                                    {resendCooldown > 0
                                        ? t('auth.forgotPassword.resendAfter').replace('{{seconds}}', String(resendCooldown))
                                        : t('auth.forgotPassword.resendEmail')}
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={emailForm.handleSubmit(onSubmitEmail)} className="space-y-4" noValidate>
                                <div>
                                    <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>
                                        {t('auth.forgotPassword.emailLabel')}
                                    </label>
                                    <input
                                        id="fp-email"
                                        type="email"
                                        autoComplete="email"
                                        placeholder={t('auth.forgotPassword.emailPlaceholder')}
                                        {...emailForm.register('email', {
                                            required: t('auth.forgotPassword.emailRequired'),
                                            pattern: { value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i, message: t('auth.forgotPassword.emailInvalid') },
                                        })}
                                        className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                                        style={inputStyle(!!emailForm.formState.errors.email)}
                                        onFocus={e => { if (!emailForm.formState.errors.email) e.target.style.border = '1.5px solid #f97316'; }}
                                        onBlur={e => { if (!emailForm.formState.errors.email) e.target.style.border = '1.5px solid #e5e7eb'; }}
                                    />
                                    {emailForm.formState.errors.email && (
                                        <p className="mt-1 text-xs" style={{ color: '#dc2626' }}>{emailForm.formState.errors.email.message}</p>
                                    )}
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-2.5 rounded-lg font-semibold text-sm text-white transition-all"
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
                                            {t('auth.forgotPassword.sendingBtn')}
                                        </span>
                                    ) : t('auth.forgotPassword.sendBtn')}
                                </button>
                            </form>
                        )
                    )}

                    {/* ── PHONE TAB ── */}
                    {tab === 'phone' && (
                        <>
                            {/* reCAPTCHA container — always mounted so the library never gets a null ref */}
                            <div id="recaptcha-container" ref={recaptchaContainerRef} style={{ display: 'none' }} />

                            {/* Step 1: enter phone */}
                            {phoneStep === 'input' && (
                                <form onSubmit={phoneForm.handleSubmit(onSendOtp)} className="space-y-4" noValidate>
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>
                                            {t('auth.forgotPassword.phoneLabel')}
                                        </label>
                                        <input
                                            id="fp-phone"
                                            type="tel"
                                            placeholder={t('auth.forgotPassword.phonePlaceholder')}
                                            {...phoneForm.register('phone', {
                                                required: t('auth.forgotPassword.phoneRequired'),
                                            })}
                                            className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                                            style={inputStyle(!!phoneForm.formState.errors.phone)}
                                            onFocus={e => { if (!phoneForm.formState.errors.phone) e.target.style.border = '1.5px solid #f97316'; }}
                                            onBlur={e => { if (!phoneForm.formState.errors.phone) e.target.style.border = '1.5px solid #e5e7eb'; }}
                                        />
                                        {phoneForm.formState.errors.phone && (
                                            <p className="mt-1 text-xs" style={{ color: '#dc2626' }}>{phoneForm.formState.errors.phone.message}</p>
                                        )}
                                        <p className="mt-1.5 text-xs" style={{ color: '#9ca3af' }}>
                                            {t('auth.forgotPassword.phoneHint')}
                                        </p>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full py-2.5 rounded-lg font-semibold text-sm text-white transition-all"
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
                                                {t('auth.forgotPassword.sendingOtpBtn')}
                                            </span>
                                        ) : t('auth.forgotPassword.sendOtpBtn')}
                                    </button>
                                </form>
                            )}

                            {/* Step 2: enter OTP */}
                            {phoneStep === 'otp' && (
                                <form onSubmit={otpForm.handleSubmit(onVerifyOtp)} className="space-y-4" noValidate>
                                    <div className="flex items-center gap-2 mb-2">
                                        <button
                                            type="button"
                                            onClick={() => setPhoneStep('input')}
                                            className="text-sm transition-colors"
                                            style={{ color: '#6b7280' }}
                                            onMouseEnter={e => (e.currentTarget.style.color = '#f97316')}
                                            onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
                                        >
                                            {t('auth.forgotPassword.changePhone')}
                                        </button>
                                    </div>
                                    <div
                                        className="rounded-lg px-4 py-3 text-sm mb-2"
                                        style={{ background: '#fff8f5', border: '1px solid #fed7aa', color: '#92400e' }}
                                    >
                                        {t('auth.forgotPassword.otpSentTo')} <strong>{phoneForm.getValues('phone')}</strong>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>
                                            {t('auth.forgotPassword.otpLabel')}
                                        </label>
                                        <input
                                            id="fp-otp"
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={6}
                                            placeholder={t('auth.forgotPassword.otpPlaceholder')}
                                            {...otpForm.register('otp', { required: t('auth.forgotPassword.otpRequired') })}
                                            className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all text-center tracking-widest text-lg font-bold"
                                            style={inputStyle(!!otpForm.formState.errors.otp)}
                                            onFocus={e => { e.target.style.border = '1.5px solid #f97316'; }}
                                            onBlur={e => { if (!otpForm.formState.errors.otp) e.target.style.border = '1.5px solid #e5e7eb'; }}
                                        />
                                        {otpForm.formState.errors.otp && (
                                            <p className="mt-1 text-xs" style={{ color: '#dc2626' }}>{otpForm.formState.errors.otp.message}</p>
                                        )}
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full py-2.5 rounded-lg font-semibold text-sm text-white transition-all"
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
                                                {t('auth.forgotPassword.verifyingBtn')}
                                            </span>
                                        ) : t('auth.forgotPassword.verifyBtn')}
                                    </button>
                                </form>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
