'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import ProviderLayout from '@/components/ProviderLayout';
import {
    User, Phone, MapPin, Zap, Radio, Save, RefreshCw, Clock,
    CheckCircle2, AlertCircle, ChevronRight, Shield, Wrench, Lock,
    Eye, EyeOff, Camera, XCircle, ArrowLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useLanguage } from '@/contexts/LanguageContext';

const C = {
    orange: '#f97316',
    orangeDark: '#ea6c0a',
    orangeLight: '#fff7ed',
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#e2e8f0',
    bg: '#f4f6f9',
    green: '#16a34a',
    greenLight: '#f0fdf4',
    red: '#ef4444',
    redLight: '#fef2f2',
};

// ── Input ────────────────────────────────────────────────────────────────────
function Input({ label, value, onChange, placeholder, type = 'text', disabled, suffix, suffix2 }: {
    label: string; value: string; onChange?: (v: string) => void;
    placeholder?: string; type?: string; disabled?: boolean;
    suffix?: React.ReactNode; suffix2?: React.ReactNode;
}) {
    return (
        <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: C.gray }}>
                {label}
            </label>
            <div className="relative">
                <input
                    type={type}
                    value={value}
                    onChange={e => onChange?.(e.target.value)}
                    placeholder={placeholder}
                    disabled={disabled}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                    style={{
                        background: disabled ? '#f8fafc' : 'white',
                        border: `1.5px solid ${disabled ? '#e2e8f0' : C.border}`,
                        color: disabled ? C.gray : C.navy,
                        fontFamily: 'Lexend, sans-serif',
                    }}
                    onFocus={e => { if (!disabled) e.currentTarget.style.borderColor = C.orange; }}
                    onBlur={e => { if (!disabled) e.currentTarget.style.borderColor = C.border; }}
                />
                {suffix && <div className="absolute right-4 top-1/2 -translate-y-1/2">{suffix}</div>}
                {suffix2 && <div className="absolute right-10 top-1/2 -translate-y-1/2">{suffix2}</div>}
            </div>
        </div>
    );
}

// ── Password Input ───────────────────────────────────────────────────────────
function PasswordInput({ label, value, onChange, placeholder }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
    const [show, setShow] = useState(false);
    return (
        <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: C.gray }}>{label}</label>
            <div className="relative">
                <input
                    type={show ? 'text' : 'password'}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-4 py-3 pr-10 rounded-xl text-sm outline-none transition-all"
                    style={{ background: 'white', border: `1.5px solid ${C.border}`, color: C.navy }}
                    onFocus={e => e.currentTarget.style.borderColor = C.orange}
                    onBlur={e => e.currentTarget.style.borderColor = C.border}
                />
                <button type="button" onClick={() => setShow(!show)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-gray-100">
                    {show ? <EyeOff className="w-4 h-4" style={{ color: C.gray }} /> : <Eye className="w-4 h-4" style={{ color: C.gray }} />}
                </button>
            </div>
        </div>
    );
}

// ── Card ─────────────────────────────────────────────────────────────────────
function Card({ icon, iconBg, title, children }: {
    icon: React.ReactNode; iconBg: string; title: string; children: React.ReactNode;
}) {
    return (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'white', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: `1px solid ${C.border}` }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: iconBg }}>{icon}</div>
                <h2 className="text-sm font-bold" style={{ color: C.navy }}>{title}</h2>
            </div>
            <div className="px-5 py-4 space-y-4">{children}</div>
        </div>
    );
}

// ── Radius Slider ────────────────────────────────────────────────────────────
function RadiusSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const { t } = useLanguage();
    const chips = [5, 10, 15, 20, 30, 50];
    const chipIndex = chips.indexOf(value) !== -1
        ? chips.indexOf(value)
        : Math.max(0, chips.findIndex(c => c >= value));
    const pct = (chipIndex / (chips.length - 1)) * 100;
    return (
        <div>
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs" style={{ color: C.gray }}>{t('provider.settings.workArea.radiusLabel')}</span>
                <span className="text-base font-bold" style={{ color: C.orange }}>{value} <span className="text-xs font-semibold">km</span></span>
            </div>
            <input
                type="range" min={0} max={chips.length - 1} step={1} value={chipIndex}
                onChange={e => onChange(chips[Number(e.target.value)])}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer mb-3"
                style={{
                    background: `linear-gradient(to right, ${C.orange} 0%, ${C.orange} ${pct}%, #e2e8f0 ${pct}%, #e2e8f0 100%)`,
                    accentColor: C.orange,
                }}
            />
            <div className="flex justify-between">
                {chips.map(s => (
                    <button key={s} type="button" onClick={() => onChange(s)}
                        className="text-[10px] font-bold px-2 py-1 rounded-lg transition-all"
                        style={{
                            background: value === s ? C.orange : '#f1f5f9',
                            color: value === s ? 'white' : C.gray,
                            transform: value === s ? 'scale(1.05)' : 'scale(1)',
                        }}>
                        {s}km
                    </button>
                ))}
            </div>
            <div className="mt-3 px-3 py-2.5 rounded-xl flex items-start gap-2" style={{ background: '#fff7ed' }}>
                <div className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center" style={{ background: C.orange }}>
                    <span className="text-[8px] text-white font-bold">i</span>
                </div>
                <p className="text-xs" style={{ color: '#92400e' }}>
                    {t('provider.settings.workArea.radiusHint').replace('{value}', String(value))}
                </p>
            </div>
        </div>
    );
}

// ── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ label, description, value, onChange }: {
    label: string; description: string; value: boolean; onChange: (v: boolean) => void;
}) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: C.navy }}>{label}</p>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: C.gray }}>{description}</p>
            </div>
            <button type="button" onClick={() => onChange(!value)}
                className="relative flex-shrink-0 mt-0.5 w-11 h-6 rounded-full transition-colors duration-200"
                style={{ background: value ? C.orange : '#cbd5e1' }}>
                <div className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200"
                    style={{ transform: value ? 'translateX(23px)' : 'translateX(2px)' }} />
            </button>
        </div>
    );
}

// ── Link Row ─────────────────────────────────────────────────────────────────
function LinkRow({ icon, iconBg, title, subtitle, onClick }: {
    icon: React.ReactNode; iconBg: string; title: string; subtitle: string; onClick: () => void;
}) {
    return (
        <button onClick={onClick} className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl hover:opacity-90 transition-opacity"
            style={{ background: 'white', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: iconBg }}>{icon}</div>
                <div className="text-left">
                    <p className="text-sm font-semibold" style={{ color: C.navy }}>{title}</p>
                    <p className="text-xs" style={{ color: C.gray }}>{subtitle}</p>
                </div>
            </div>
            <ChevronRight className="w-4 h-4" style={{ color: '#cbd5e1' }} />
        </button>
    );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function ProviderSettingsPage() {
    const { user, loading: authLoading, logout } = useAuth();
    const router = useRouter();
    const fileRef = useRef<HTMLInputElement>(null);
    const { t } = useLanguage();

    // Auth guard: redirect if not logged in or not a provider
    useEffect(() => {
        if (!authLoading && (!user || user.role !== 'PROVIDER')) {
            router.push('/auth/login');
        }
    }, [user, authLoading, router]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // --- Avatar Upload State ---
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

    // Profile state
    const [fullName, setFullName] = useState('');
    const [serviceName, setServiceName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [serviceRadiusKm, setServiceRadiusKm] = useState(15);
    const [emergencyAvailable, setEmergencyAvailable] = useState(false);

    // Read-only
    const [email, setEmail] = useState('');
    const [verificationStatus, setVerificationStatus] = useState('');
    const [providerType, setProviderType] = useState('');
    const [providerId, setProviderId] = useState('');
    const [averageRating, setAverageRating] = useState<number | null>(null);
    const [reviewCount, setReviewCount] = useState(0);
    const [authProvider, setAuthProvider] = useState('');
    const [rejectionReason, setRejectionReason] = useState('');

    // Password state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);

    // Snapshot for cancel
    const snapshot = useRef<any>(null);

    const loadSettings = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/me/provider/settings');
            const d = res.data?.data ?? res.data;
            const initial = {
                fullName: d.fullName || d.name || '',
                serviceName: d.serviceName || '',
                phoneNumber: d.phoneNumber || '',
                serviceRadiusKm: d.serviceRadiusKm ?? 15,
                emergencyAvailable: d.emergencyAvailable ?? false,
            };
            snapshot.current = initial;
            setFullName(initial.fullName);
            setServiceName(initial.serviceName);
            setPhoneNumber(initial.phoneNumber);
            setServiceRadiusKm(initial.serviceRadiusKm);
            setEmergencyAvailable(initial.emergencyAvailable);
            setEmail(d.email || d.contactEmail || '');
            setVerificationStatus(d.verificationStatus || '');
            setProviderType(d.providerType || '');
            setProviderId(d.id?.slice(-4).toUpperCase() || '');
            setAverageRating(d.averageRating ?? null);
            setReviewCount(d.reviewCount ?? 0);
            setAuthProvider(d.authProvider || '');
            setRejectionReason(d.rejectReasonDetail || d.rejectReasonCode || '');
        } catch {
            toast.error(t('provider.settings.toasts.loadFail'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadSettings(); }, [loadSettings]);

    const handleCancel = () => {
        if (!snapshot.current) return;
        setFullName(snapshot.current.fullName);
        setServiceName(snapshot.current.serviceName);
        setPhoneNumber(snapshot.current.phoneNumber);
        setServiceRadiusKm(snapshot.current.serviceRadiusKm);
        setEmergencyAvailable(snapshot.current.emergencyAvailable);
        toast(t('provider.settings.toasts.canceled'), { icon: '↩️' });
    };

    const handleSave = async () => {
        if (!phoneNumber.trim()) { toast.error(t('provider.settings.toasts.phoneRequired')); return; }
        if (!fullName.trim()) { toast.error(t('provider.settings.toasts.nameRequired')); return; }
        setSaving(true);
        try {
            await api.patch('/me/provider/settings', {
                fullName: fullName.trim(),
                serviceName: serviceName.trim() || undefined,
                phoneNumber: phoneNumber.trim(),
                serviceRadiusKm,
                emergencyAvailable,
            });
            snapshot.current = { fullName, serviceName, phoneNumber, serviceRadiusKm, emergencyAvailable };
            toast.success(t('provider.settings.toasts.saveSuccess'));
        } catch (e: any) {
            toast.error(e?.response?.data?.message || t('provider.settings.toasts.saveFail'));
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (!currentPassword) { toast.error(t('provider.settings.toasts.pwCurrentRequired')); return; }
        if (newPassword.length < 6) { toast.error(t('provider.settings.toasts.pwTooShort')); return; }
        if (newPassword !== confirmPassword) { toast.error(t('provider.settings.toasts.pwMismatch')); return; }
        setChangingPassword(true);
        try {
            await api.patch('/me/provider/change-password', { currentPassword, newPassword });
            toast.success(t('provider.settings.toasts.pwSuccess'));
            setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
        } catch (e: any) {
            toast.error(e?.response?.data?.message || t('provider.settings.toasts.pwFail'));
        } finally {
            setChangingPassword(false);
        }
    };

    const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingAvatar(true);
        try {
            const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
            const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', uploadPreset!);
            formData.append('folder', `avatars/${user?.id}`);

            const res = await fetch(
                `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
                { method: 'POST', body: formData }
            );
            if (!res.ok) throw new Error('Cloudinary upload failed');
            const data = await res.json();

            await api.patch('/me/avatar', { avatarUrl: data.secure_url });
            
            // Re-fetch user to reflect avatar change globally in context
            // Since useAuth doesn't expose refreshUser directly in some setups, we might just reload or if there is refreshUser we use it.
            // Let's check what auth operations we have. We will use a safe approach by emitting an event or if refreshUser exists.
            
            toast.success(t('provider.settings.toasts.avatarSuccess') || 'Avatar updated successfully!');
            // To ensure the new avatar is shown immediately, we reload the window. 
            // Better: If useAuth exports refreshUser, use it. But looking at line 198: const { user, loading: authLoading, logout } = useAuth();
            window.location.reload();
        } catch (err) {
            console.error(err);
            toast.error(t('provider.settings.toasts.avatarFail') || 'Failed to update avatar');
        } finally {
            setIsUploadingAvatar(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    const statusMap: Record<string, { label: string; color: string; bg: string }> = {
        APPROVED: { label: t('provider.settings.statusBadge.APPROVED'), color: C.green, bg: C.greenLight },
        PENDING: { label: t('provider.settings.statusBadge.PENDING'), color: '#d97706', bg: '#fefce8' },
        REJECTED: { label: t('provider.settings.statusBadge.REJECTED'), color: C.red, bg: C.redLight },
        DRAFT: { label: t('provider.settings.statusBadge.DRAFT'), color: C.gray, bg: '#f1f5f9' },
        SUSPENDED: { label: t('provider.settings.statusBadge.SUSPENDED'), color: C.red, bg: C.redLight },
    };
    const statusInfo = statusMap[verificationStatus] ?? statusMap.DRAFT;

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
            <RefreshCw className="w-7 h-7 animate-spin" style={{ color: C.orange }} />
        </div>
    );

    const initials = (fullName || 'P').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    // Block profile edits while application is under review
    const isPendingLock = verificationStatus === 'PENDING';

    return (
        <ProviderLayout activeTab="/provider/settings">
            <div className="pb-28">

                {/* ── Header bar ── */}
                <header
                    className="flex items-center justify-between px-4 py-3 flex-shrink-0 sticky top-0 z-20"
                    style={{ background: '#ffffff', borderBottom: `1px solid ${C.border}` }}
                >
                    {/* Mobile: back arrow + RescueMe | Desktop: page title */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/provider/active')}
                            className="flex md:hidden items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 transition-colors"
                            style={{ color: C.navy }}
                        >
                            <ArrowLeft style={{ width: 18, height: 18 }} />
                        </button>
                        <div className="flex md:hidden items-center gap-2">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: C.orange }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 7v10l8 5 8-5V7L12 2z" fill="white" opacity="0.9" /></svg>
                            </div>
                            <span className="font-bold text-sm" style={{ color: C.navy }}>RescueMe</span>
                        </div>
                        <h2 className="hidden md:block text-base font-semibold" style={{ color: C.navy }}>{t('provider.nav.settings')}</h2>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
                            <span className="text-xs font-medium" style={{ color: '#64748b' }}>{t('common.systemOperational')}</span>
                        </div>
                        <LanguageSwitcher />
                        <button className="p-1.5 rounded-lg" style={{ color: '#94a3b8' }}>
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                        </button>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 bg-cover bg-center" style={{ background: user?.avatar ? `url(${user.avatar}) center/cover` : C.orange }}>
                            {!user?.avatar && initials.charAt(0)}
                        </div>
                    </div>
                </header>

                <div className="px-4 pt-5 space-y-4 max-w-2xl mx-auto">

                    {/* ── Profile Card ── */}
                    <div className="rounded-2xl overflow-hidden relative"
                        style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)', boxShadow: '0 4px 24px rgba(26,26,46,0.35)' }}>
                        <div className="px-5 py-5 flex items-center gap-4">
                            {/* Avatar with camera */}
                            <div className="relative flex-shrink-0">
                                <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 flex items-center justify-center text-2xl font-bold text-white relative"
                                    style={{ borderColor: 'rgba(255,255,255,0.2)', background: user?.avatar ? `url(${user.avatar}) center/cover` : `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})` }}>
                                    {!user?.avatar && initials}
                                    {isUploadingAvatar && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => !isUploadingAvatar && fileRef.current?.click()}
                                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center border-2 border-[#1a1a2e] disabled:opacity-50"
                                    style={{ background: C.orange }}
                                    disabled={isUploadingAvatar}>
                                    <Camera className="w-3 h-3 text-white" />
                                </button>
                                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <h2 className="text-base font-bold text-white truncate">{fullName || t('provider.settings.profileCard.noName')}</h2>
                                <p className="text-xs mb-2 truncate" style={{ color: '#94a3b8' }}>{email}</p>
                                <div className="flex items-center flex-wrap gap-2">
                                    {providerId && (
                                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                                            style={{ background: 'rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                                            {t('provider.settings.profileCard.providerId')}: #{providerId}
                                        </span>
                                    )}
                                    <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full"
                                        style={{ background: statusInfo.bg, color: statusInfo.color }}>
                                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: statusInfo.color }} />
                                        {statusInfo.label}
                                    </span>
                                    {averageRating !== null && (
                                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                                            style={{ background: 'rgba(251,191,36,0.2)', color: '#fbbf24' }}>
                                            ★ {averageRating.toFixed(1)} ({reviewCount})
                                        </span>
                                    )}
                                </div>
                            </div>

                            <button onClick={() => router.push('/provider/dashboard')}
                                className="flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                                style={{ background: 'rgba(255,255,255,0.12)', color: 'white', border: '1px solid rgba(255,255,255,0.15)' }}>
                                {t('provider.settings.profileCard.publicProfile')}
                            </button>
                        </div>
                    </div>

                    {/* ── PENDING lock banner ── */}
                    {isPendingLock && (
                        <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: '#fffbeb', border: '1.5px solid #fde68a' }}>
                            <Clock className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#d97706' }} />
                            <div>
                                <p className="text-sm font-bold mb-0.5" style={{ color: '#92400e' }}>{t('provider.settings.pendingLock.title')}</p>
                                <p className="text-xs" style={{ color: '#b45309' }}>{t('provider.settings.pendingLock.desc')}</p>
                            </div>
                        </div>
                    )}

                    {/* ── 2-col grid ── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        {/* Personal info */}
                        <Card icon={<User className="w-4 h-4" style={{ color: '#2563eb' }} />} iconBg="#eff6ff" title={t('provider.settings.personalInfo.title')}>
                            <Input label={t('provider.settings.personalInfo.fullNameLabel')} value={fullName} onChange={isPendingLock ? undefined : setFullName} placeholder={t('provider.settings.personalInfo.fullNamePlaceholder')} disabled={isPendingLock} />
                            <div>
                                <Input label={t('provider.settings.personalInfo.displayNameLabel')} value={serviceName} onChange={isPendingLock ? undefined : setServiceName} placeholder={t('provider.settings.personalInfo.displayNamePlaceholder')} disabled={isPendingLock} />
                                <p className="text-[10px] mt-1.5 italic" style={{ color: '#94a3b8' }}>
                                    {t('provider.settings.personalInfo.displayNameHint')}
                                </p>
                            </div>
                        </Card>

                        {/* Contact */}
                        <Card icon={<Phone className="w-4 h-4" style={{ color: C.green }} />} iconBg={C.greenLight} title={t('provider.settings.contact.title')}>
                            <Input label={t('provider.settings.contact.phoneLabel')} value={phoneNumber} onChange={isPendingLock ? undefined : setPhoneNumber} placeholder="0912345678" type="tel" disabled={isPendingLock} />
                            <Input label={t('provider.settings.contact.emailLabel')} value={email} disabled />
                        </Card>
                    </div>

                    {/* ── 2-col grid row 2 ── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        {/* Radius */}
                        <Card icon={<MapPin className="w-4 h-4" style={{ color: C.orange }} />} iconBg={C.orangeLight} title={t('provider.settings.workArea.title')}>
                            {isPendingLock
                                ? <p className="text-xs py-4 text-center" style={{ color: C.gray }}>{t('provider.settings.workArea.lockedWhilePending')}</p>
                                : <RadiusSlider value={serviceRadiusKm} onChange={setServiceRadiusKm} />}
                        </Card>

                        {/* Service options */}
                        <Card icon={<Zap className="w-4 h-4" style={{ color: '#7c3aed' }} />} iconBg="#f5f3ff" title={t('provider.settings.serviceOptions.title')}>
                            <Toggle
                                label={t('provider.settings.serviceOptions.emergencyLabel')}
                                description={t('provider.settings.serviceOptions.emergencyDesc')}
                                value={isPendingLock ? false : emergencyAvailable}
                                onChange={isPendingLock ? () => { } : setEmergencyAvailable}
                            />
                        </Card>
                    </div>

                    {/* ── Change Password ── */}
                    {authProvider !== 'GOOGLE' && (
                        <Card icon={<Lock className="w-4 h-4" style={{ color: '#64748b' }} />} iconBg="#f1f5f9" title={t('provider.settings.changePassword.title')}>
                            <PasswordInput label={t('provider.settings.changePassword.currentLabel')} value={currentPassword} onChange={setCurrentPassword} placeholder="••••••••" />
                            <PasswordInput label={t('provider.settings.changePassword.newLabel')} value={newPassword} onChange={setNewPassword} placeholder={t('provider.settings.changePassword.newPlaceholder')} />
                            <PasswordInput label={t('provider.settings.changePassword.confirmLabel')} value={confirmPassword} onChange={setConfirmPassword} placeholder={t('provider.settings.changePassword.confirmPlaceholder')} />
                            {newPassword && confirmPassword && newPassword !== confirmPassword && (
                                <p className="text-xs flex items-center gap-1" style={{ color: C.red }}>
                                    <XCircle className="w-3 h-3" /> {t('provider.settings.changePassword.mismatch')}
                                </p>
                            )}
                            <button onClick={handleChangePassword} disabled={changingPassword}
                                className="w-full py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all"
                                style={{
                                    background: changingPassword ? '#d1d5db' : '#1e293b',
                                    opacity: changingPassword ? 0.7 : 1,
                                }}>
                                {changingPassword ? <><RefreshCw className="w-4 h-4 animate-spin" /> {t('provider.settings.changePassword.submitting')}</> : <><Lock className="w-4 h-4" /> {t('provider.settings.changePassword.submitBtn')}</>}
                            </button>
                        </Card>
                    )}

                    {/* ── Quick Links ── */}
                    <LinkRow
                        icon={<Wrench className="w-5 h-5" style={{ color: C.green }} />}
                        iconBg="#dcfce7"
                        title={t('provider.settings.links.walletHistory')}
                        subtitle={t('provider.settings.links.walletHistoryDesc')}
                        onClick={() => router.push('/provider/wallet')}
                    />
                    <LinkRow
                        icon={<Radio className="w-5 h-5" style={{ color: C.orange }} />}
                        iconBg={C.orangeLight}
                        title={t('provider.settings.links.verification')}
                        subtitle={t('provider.settings.links.verificationDesc')}
                        onClick={() => router.push('/provider/dashboard')}
                    />
                    {verificationStatus === 'REJECTED' && (
                        <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: C.redLight, border: `1.5px solid #fecaca` }}>
                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: C.red }} />
                            <div className="flex-1">
                                <p className="text-sm font-bold mb-1" style={{ color: '#991b1b' }}>{t('provider.settings.rejectedCard.title')}</p>
                                {rejectionReason ? (
                                    <p className="text-xs mb-2" style={{ color: '#b91c1c' }}>{t('provider.settings.rejectedCard.reason')} {rejectionReason}</p>
                                ) : (
                                    <p className="text-xs mb-2" style={{ color: '#b91c1c' }}>{t('provider.settings.rejectedCard.updatePrompt')}</p>
                                )}
                                <button onClick={() => router.push('/provider/onboarding')}
                                    className="text-xs font-bold px-3 py-1.5 rounded-lg text-white"
                                    style={{ background: C.red }}>
                                    {t('provider.settings.rejectedCard.updateBtn')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Mobile Logout Button */}
                    <button
                        onClick={logout}
                        className="w-full flex md:hidden items-center justify-center gap-2 px-4 py-3.5 rounded-2xl transition-all active:scale-[0.98] mt-4"
                        style={{ background: C.redLight, color: C.red, border: `1.5px solid #fecaca` }}
                    >
                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span className="text-sm font-bold">{t('provider.settings.logoutBtn')}</span>
                    </button>
                </div>

                {/* ── Bottom action bar ── */}
                <div className="fixed bottom-[60px] md:bottom-0 left-0 md:left-[220px] right-0 px-4 pb-6 pt-4 z-40 pointer-events-none"
                    style={{ background: 'linear-gradient(to top, white 70%, transparent)' }}>
                    <div className="flex gap-3 max-w-2xl mx-auto pointer-events-auto">
                        <button onClick={handleCancel}
                            className="flex-1 py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
                            style={{ background: 'white', color: C.navy, border: `1.5px solid ${C.border}`, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                            {t('provider.settings.cancelBtn')}
                        </button>
                        <button onClick={handleSave} disabled={saving}
                            className="flex-[2] py-3.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
                            style={{
                                background: saving ? '#d1d5db' : `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`,
                                boxShadow: saving ? 'none' : `0 6px 24px ${C.orange}50`,
                            }}>
                            {saving
                                ? <><RefreshCw className="w-4 h-4 animate-spin" /> {t('provider.settings.saving')}</>
                                : <><Save className="w-4 h-4" /> {t('provider.settings.saveAll')}</>}
                        </button>
                        {isPendingLock && (
                            <div className="absolute inset-0 rounded-2xl flex items-center justify-center"
                                style={{ background: '#fde68a', cursor: 'not-allowed' }}
                                title={t('provider.settings.pendingLock.cannotSaveTitle')}>
                                <Clock className="w-4 h-4 mr-2" style={{ color: '#92400e' }} />
                                <span className="text-sm font-bold" style={{ color: '#92400e' }}>{t('provider.settings.pendingLock.overlay')}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </ProviderLayout>
    );
}
