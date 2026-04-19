'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUserGuard } from '@/lib/guards';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { User, Phone, Mail, Globe, Lock, LogOut, X, Camera, Banknote, Plus, Edit3, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import RescueMeLogo from '@/components/RescueMeLogo';
import { useUserDisputeNavBadge } from '@/contexts/UserDisputeNavBadgeContext';
import { BANK_CUSTOM_CODE, getBankOptions } from '@/lib/banks';
import BankSelect from '@/components/BankSelect';

const C = {
    orange: '#f97316',
    orangeDark: '#ea6c0a',
    orangeLight: '#fff7ed',
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#f1f5f9',
    bg: '#f8fafc',
    white: '#ffffff',
    danger: '#ef4444',
    dangerLight: '#fef2f2',
};

// ── Reusable Modal Component ──
function SettingsModal({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(26, 26, 46, 0.4)' }}>
            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden" style={{ boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
                <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: C.border }}>
                    <h3 className="font-bold text-base" style={{ color: C.navy }}>{title}</h3>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
                        <X size={18} style={{ color: C.gray }} />
                    </button>
                </div>
                <div className="p-4">
                    {children}
                </div>
            </div>
        </div>
    );
}

export default function UserSettingsPage() {
    const router = useRouter();
    const { isReady, user } = useUserGuard();
    const { logout, refreshUser } = useAuth();
    const { t } = useLanguage();
    const { disputeNavBadge, resetDisputeNavBadge } = useUserDisputeNavBadge();

    const [isEditingName, setIsEditingName] = useState(false);
    const [editName, setEditName] = useState('');

    const [isEditingPhone, setIsEditingPhone] = useState(false);
    const [editPhone, setEditPhone] = useState('');

    const [isEditingPassword, setIsEditingPassword] = useState(false);
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // --- Avatar Upload State ---
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // --- Local Validation Errors ---
    const [phoneError, setPhoneError] = useState('');
    const [plateError, setPlateError] = useState('');

    // --- Vehicle Management State ---
    const [isAddingVehicle, setIsAddingVehicle] = useState(false);
    const [newVehiclePlate, setNewVehiclePlate] = useState('');
    const [newVehicleColor, setNewVehicleColor] = useState('');
    const [newVehicleBrand, setNewVehicleBrand] = useState('');
    const [newVehicleType, setNewVehicleType] = useState<'MOTORCYCLE' | 'CAR'>('MOTORCYCLE');

    // --- Withdrawal accounts (customer) ---
    type WithdrawalAccount = {
        id: string;
        accountNumber: string;
        bankCode?: string | null;
        bankName: string;
        branchName?: string | null;
        accountHolderName: string;
        createdAt?: string;
        updatedAt?: string;
    };

    const [withdrawalAccounts, setWithdrawalAccounts] = useState<WithdrawalAccount[]>([]);
    const [withdrawalAccountsLoading, setWithdrawalAccountsLoading] = useState(false);
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
    const [isAccountSaving, setIsAccountSaving] = useState(false);
    const [accountForm, setAccountForm] = useState<{
        accountNumber: string;
        bankCode?: string;
        bankName: string;
        branchName: string;
        accountHolderName: string;
    }>({
        accountNumber: '',
        bankCode: undefined,
        bankName: '',
        branchName: '',
        accountHolderName: '',
    });

    const displayAccountNumber = (accNum: string) => String(accNum ?? '').trim();

    const fetchWithdrawalAccounts = async () => {
        setWithdrawalAccountsLoading(true);
        try {
            const res = await api.get('/me/withdrawal-accounts');
            const list = res.data?.data ?? res.data;
            setWithdrawalAccounts(Array.isArray(list) ? list : []);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Không thể tải danh sách tài khoản rút tiền');
        } finally {
            setWithdrawalAccountsLoading(false);
        }
    };

    useEffect(() => {
        if (isReady && user) {
            fetchWithdrawalAccounts();
        }
    }, [isReady, user?.id]);

    const openAddAccountModal = () => {
        setEditingAccountId(null);
        setAccountForm({
            accountNumber: '',
            bankCode: undefined,
            bankName: '',
            branchName: '',
            accountHolderName: '',
        });
        setIsAccountModalOpen(true);
    };

    const openEditAccountModal = (acc: WithdrawalAccount) => {
        setEditingAccountId(acc.id);
        setAccountForm({
            accountNumber: acc.accountNumber ?? '',
            bankCode: acc.bankCode ?? undefined,
            bankName: acc.bankName ?? '',
            branchName: acc.branchName ?? '',
            accountHolderName: acc.accountHolderName ?? '',
        });
        setIsAccountModalOpen(true);
    };

    const handleDeleteAccount = async (accountId: string) => {
        if (!confirm(t('user.settings.withdrawalAccounts.deleteConfirm'))) return;
        try {
            await api.delete(`/me/withdrawal-accounts/${accountId}`);
            toast.success(t('user.settings.withdrawalAccounts.toastDeleted'));
            await fetchWithdrawalAccounts();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || t('user.settings.withdrawalAccounts.toastDeleteError'));
        }
    };

    const handleSubmitAccount = async (e: any) => {
        e.preventDefault();
        if (isAccountSaving) return;

        const payload = {
            accountNumber: accountForm.accountNumber.trim(),
            bankCode: accountForm.bankCode,
            bankName: accountForm.bankName.trim(),
            branchName: accountForm.branchName.trim() ? accountForm.branchName.trim() : undefined,
            accountHolderName: accountForm.accountHolderName.trim(),
        };

        if (!payload.accountNumber || !payload.bankName || !payload.accountHolderName) {
            toast.error(t('user.settings.withdrawalAccounts.validationRequired'));
            return;
        }

        setIsAccountSaving(true);
        try {
            if (editingAccountId) {
                await api.patch(`/me/withdrawal-accounts/${editingAccountId}`, payload);
                toast.success(t('user.settings.withdrawalAccounts.toastUpdated'));
            } else {
                await api.post('/me/withdrawal-accounts', payload);
                toast.success(t('user.settings.withdrawalAccounts.toastAdded'));
            }
            setIsAccountModalOpen(false);
            setEditingAccountId(null);
            await fetchWithdrawalAccounts();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || t('user.settings.withdrawalAccounts.toastSaveError'));
        } finally {
            setIsAccountSaving(false);
        }
    };

    const displayName = user?.fullName || user?.name || user?.email?.split('@')[0] || t('common.unknown');

    // Build vehicle list: use rescueVehicles if populated, otherwise synthesize from primary fields
    const primaryVehicle = (user?.vehicleType && user?.licensePlate) ? {
        type: user.vehicleType as 'CAR' | 'MOTORCYCLE',
        plateNumber: user.licensePlate,
        color: user.vehicleColor || '',
        brand: '',
    } : null;
    const vehicles: Array<{ type: 'CAR' | 'MOTORCYCLE'; plateNumber: string; color?: string; brand?: string }> =
        (user?.rescueVehicles?.length ? user.rescueVehicles : (primaryVehicle ? [primaryVehicle] : []));

    const navItems = [
        { label: t('user.nav.home'), href: '/user', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
        { label: t('user.nav.history'), href: '/user/requests', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
        { label: t('user.nav.wallet'), href: '/user/wallet', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg> },
        { label: t('user.nav.disputes'), href: '/user/disputes', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> },
        { label: t('user.nav.map'), href: '/user/incident-map', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.242-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
        { label: t('user.nav.settings'), href: '/user/settings', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
    ];

    const settingsLabel = t('user.nav.settings');

    const handleLogout = async () => {
        await logout();
        router.push('/auth/login');
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
            await refreshUser();
            toast.success(t('user.settings.toasts.updateSuccess'));
        } catch (err) {
            console.error(err);
            toast.error(t('user.settings.toasts.updateFailed'));
        } finally {
            setIsUploadingAvatar(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handlePhoneChange = (val: string) => {
        setEditPhone(val);
        const phoneRegex = /^0[39][0-9]{8}$/;
        if (val && !phoneRegex.test(val)) {
            setPhoneError('Số điện thoại không hợp lệ (phải bắt đầu bằng 03 hoặc 09 và đủ 10 số)');
        } else {
            setPhoneError('');
        }
    };

    const handleSaveProfile = async (field: 'name' | 'phone') => {
        setErrorMsg('');

        // Validate phone number regex before submitting
        if (field === 'phone' && phoneError) {
            return; // blocked by real-time validation
        }

        setIsSaving(true);
        try {
            const payload = {
                fullName: field === 'name' ? editName : (user?.fullName || user?.name || ''),
                phoneNumber: field === 'phone' ? editPhone : (user?.phoneNumber || ''),
            };

            await api.put('/me/profile', payload);
            await refreshUser();
            toast.success(t('user.settings.toasts.updateSuccess'));
            setIsEditingName(false);
            setIsEditingPhone(false);
        } catch (err: any) {
            console.error(err);
            setErrorMsg(err?.response?.data?.message || t('user.settings.toasts.updateFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteVehicle = async (indexToDelete: number) => {
        if (!confirm(t('user.settings.vehicles.deleteConfirm'))) return;

        try {
            const updatedVehicles = vehicles.filter((_, idx) => idx !== indexToDelete);
            await api.put('/me/profile', {
                fullName: user?.fullName || user?.name || '',
                phoneNumber: user?.phoneNumber || '',
                vehicles: updatedVehicles,
            });
            await refreshUser();
            toast.success(t('user.settings.toasts.deleteVehicleSuccess'));
        } catch (err: any) {
            console.error(err);
            toast.error(t('user.settings.toasts.updateFailed'));
        }
    };

    const handlePlateChange = (val: string) => {
        setNewVehiclePlate(val);
        const plateRegex = /^[1-9][0-9][A-Z0-9]{1,2}[- .]?(\d{4}|\d{3}[.]?\d{2})$/i;
        if (val && !plateRegex.test(val.trim())) {
            setPlateError('Biển số xe không hợp lệ (ví dụ: 29A-123.45 hoặc 59T1-1234)');
        } else {
            setPlateError('');
        }
    };

    const handleAddVehicle = async () => {
        setErrorMsg('');

        const plate = newVehiclePlate.trim().toUpperCase();
        const brand = newVehicleBrand.trim();
        const color = newVehicleColor.trim();

        if (!plate || !color || !brand) {
            setErrorMsg('Vui lòng nhập đầy đủ thông tin xe');
            return;
        }

        if (plateError) return; // blocked by real-time validation

        setIsSaving(true);
        try {
            const newVehicle = {
                type: newVehicleType,
                plateNumber: plate,
                color: color,
                brand: brand,
            };
            const updatedVehicles = [...vehicles, newVehicle];

            await api.put('/me/profile', {
                fullName: user?.fullName || user?.name || '',
                phoneNumber: user?.phoneNumber || '',
                vehicles: updatedVehicles,
            });
            await refreshUser();
            toast.success(t('user.settings.toasts.addVehicleSuccess'));
            setIsAddingVehicle(false);
            setNewVehiclePlate('');
            setNewVehicleColor('');
            setNewVehicleBrand('');
            setNewVehicleType('MOTORCYCLE');
        } catch (err: any) {
            console.error(err);

            // Extract and display specific validation errors from backend
            let errorMsgToDisplay = t('user.settings.toasts.updateFailed');
            if (err?.response?.data?.message) {
                const backendMsg = err.response.data.message;
                errorMsgToDisplay = Array.isArray(backendMsg) ? backendMsg[0] : backendMsg;
            }
            setErrorMsg(errorMsgToDisplay);
        } finally {
            setIsSaving(false);
        }
    };

    const handleChangePassword = async () => {
        setErrorMsg('');
        if (newPassword !== confirmPassword) {
            setErrorMsg(t('user.settings.toasts.passwordMismatch'));
            return;
        }
        setIsSaving(true);
        try {
            await api.put('/auth/change-password', { oldPassword, newPassword });
            toast.success(t('user.settings.toasts.updateSuccess'));
            setIsEditingPassword(false);
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            console.error(err);
            setErrorMsg(err?.response?.data?.message || t('user.settings.toasts.updateFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    if (!isReady) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-3" style={{ borderColor: C.orange }}></div>
                    <p className="text-sm" style={{ color: C.gray }}>{t('common.loading')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex" style={{ fontFamily: 'Lexend, sans-serif', background: C.bg }}>

            {/* ═══ DESKTOP Sidebar ═══ */}
            <aside
                className="hidden md:flex flex-col justify-between py-6 px-4 flex-shrink-0 sticky top-0 h-screen"
                style={{ width: '220px', background: C.white, borderRight: `1px solid ${C.border}` }}
            >
                <div>
                    <div className="flex items-center gap-2 mb-8 px-2">
                        <RescueMeLogo size={28} textClass="text-base" />
                    </div>
                    <nav className="space-y-1">
                        {navItems.map(item => {
                            const active = item.label === settingsLabel;
                            return (
                                <button
                                    key={item.label}
                                    onClick={() => {
                                        if (item.href === '/user/disputes') resetDisputeNavBadge();
                                        if (item.href !== '#') router.push(item.href);
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                                    style={{ background: active ? C.orangeLight : 'transparent', color: active ? C.orange : '#64748b' }}
                                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = C.bg; }}
                                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                >
                                    {item.icon}{item.label}
                                    {item.href === '/user/disputes' && disputeNavBadge > 0 && !active && (
                                        <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#fee2e2', color: '#dc2626' }}>
                                            {disputeNavBadge > 99 ? '99+' : disputeNavBadge}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                </div>
                {/* User Info */}
                <div className="flex items-center gap-3 px-2 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 bg-cover bg-center" style={{ background: user?.avatar ? `url(${user.avatar}) center/cover` : C.orange }}>
                        {!user?.avatar && displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: C.navy }}>{displayName}</p>
                        <p className="text-xs" style={{ color: C.gray }}>Cơ bản</p>
                    </div>
                </div>
            </aside>

            {/* ═══ Main Area ═══ */}
            <div className="flex-1 flex flex-col min-w-0" style={{ paddingBottom: '64px' }}>

                {/* ── Header ── */}
                <header
                    className="flex items-center gap-3 px-4 py-3 flex-shrink-0 sticky top-0 z-20"
                    style={{ background: C.white, borderBottom: `1px solid ${C.border}` }}
                >
                    <button
                        onClick={() => router.push('/user')}
                        className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: C.bg, color: C.navy }}
                    >
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                        <div className="flex md:hidden items-center gap-2">
                            <RescueMeLogo size={24} textClass="hidden" />
                        </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="font-bold text-base leading-tight" style={{ color: C.navy }}>{t('user.settings.title')}</h1>
                        <p className="text-xs" style={{ color: C.gray }}>{t('user.settings.subtitle')}</p>
                    </div>
                </header>

                {/* ── Body ── */}
                <div className="flex-1 overflow-y-auto">
                    <div className="p-4 md:p-6 max-w-3xl mx-auto w-full space-y-6">

                        {/* Profile Info Section */}
                        <section>
                            <h2 className="text-sm font-bold mb-3 px-1" style={{ color: C.navy }}>{t('user.settings.personalInfo.title')}</h2>
                            <div className="bg-white rounded-2xl p-6 mb-4 border" style={{ borderColor: C.border, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                                <h3 className="text-sm font-bold mb-4" style={{ color: C.navy }}>{t('user.settings.personalInfo.avatarTitle') || 'Profile Picture'}</h3>
                                <div className="flex items-center gap-6">
                                    <div className="relative cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
                                        <div className="w-24 h-24 rounded-full border-2 flex flex-col items-center justify-center overflow-hidden transition-all group-hover:border-blue-500" style={{ borderColor: C.border, background: user?.avatar ? `url(${user.avatar}) center/cover` : C.orangeLight }}>
                                            {!user?.avatar && <User style={{ width: 44, height: 44, color: C.orange, marginTop: '12px' }} />}
                                        </div>
                                        <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center border-2 border-white bg-blue-600 group-hover:bg-blue-700 transition-colors shadow-sm">
                                            <Camera size={14} color="white" />
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold" style={{ color: C.navy }}>{t('user.settings.personalInfo.changeAvatar') || 'Change Avatar'}</h4>
                                        <p className="text-xs text-gray-500 mt-1 mb-3">{t('user.settings.personalInfo.avatarHint') || 'JPG, PNG or GIF. Max size 2MB.'}</p>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            accept="image/jpeg,image/png,image/gif"
                                            onChange={handleAvatarSelect}
                                        />
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isUploadingAvatar}
                                            className="px-4 py-2 bg-slate-100 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
                                            style={{ color: C.navy }}
                                        >
                                            {isUploadingAvatar ? t('common.loading') || 'Loading...' : t('user.settings.personalInfo.uploadNew') || 'Upload New'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl p-2 space-y-2 border" style={{ borderColor: C.border, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                                <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.orangeLight }}>
                                        <User style={{ width: 18, height: 18, color: C.orange }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs" style={{ color: C.gray }}>{t('user.settings.personalInfo.fullName')}</p>
                                        <p className="text-sm font-semibold truncate" style={{ color: C.navy }}>{user?.fullName || user?.name || t('user.settings.personalInfo.unupdated')}</p>
                                    </div>
                                    <button
                                        onClick={() => { setEditName(user?.fullName || user?.name || ''); setErrorMsg(''); setIsEditingName(true); }}
                                        className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                                        style={{ color: C.orange, background: C.orangeLight }}
                                    >
                                        {t('user.settings.personalInfo.editBtn')}
                                    </button>
                                </div>
                                <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.orangeLight }}>
                                        <Phone style={{ width: 18, height: 18, color: C.orange }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs" style={{ color: C.gray }}>{t('user.settings.personalInfo.phone')}</p>
                                        <p className="text-sm font-semibold truncate" style={{ color: C.navy }}>{user?.phoneNumber || t('user.settings.personalInfo.unupdated')}</p>
                                    </div>
                                    <button
                                        onClick={() => { setEditPhone(user?.phoneNumber || ''); setErrorMsg(''); setIsEditingPhone(true); }}
                                        className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                                        style={{ color: C.orange, background: C.orangeLight }}
                                    >
                                        {t('user.settings.personalInfo.editBtn')}
                                    </button>
                                </div>
                                <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.border }}>
                                        <Mail style={{ width: 18, height: 18, color: C.gray }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs" style={{ color: C.gray }}>{t('user.settings.personalInfo.email')}</p>
                                        <p className="text-sm font-semibold truncate" style={{ color: C.navy }}>{user?.email}</p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Vehicles Section */}
                        <section>
                            <div className="flex items-center justify-between mb-3 px-1">
                                <h2 className="text-sm font-bold" style={{ color: C.navy }}>{t('user.settings.vehicles.title')}</h2>
                                <button
                                    onClick={() => { setErrorMsg(''); setIsAddingVehicle(true); }}
                                    className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80 flex items-center gap-1"
                                    style={{ color: C.orange, background: C.orangeLight }}
                                >
                                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                    </svg>
                                    {t('user.settings.vehicles.addBtn')}
                                </button>
                            </div>

                            <div className="space-y-3">
                                {vehicles.length === 0 ? (
                                    <div className="bg-white rounded-2xl p-6 text-center border" style={{ borderColor: C.border }}>
                                        <p className="text-sm" style={{ color: C.gray }}>{t('user.settings.vehicles.empty')}</p>
                                    </div>
                                ) : (
                                    vehicles.map((v: any, index: number) => (
                                        <div key={index} className="bg-white rounded-2xl p-4 border flex items-center justify-between" style={{ borderColor: C.border, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                                            <div className="flex items-center gap-4 min-w-0">
                                                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: C.orangeLight }}>
                                                    {v.type === 'CAR' ? (
                                                        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 19v-1a4 4 0 014-4h4a4 4 0 014 4v1M3 13a4 4 0 014-4h10a4 4 0 014 4m-12 8a2 2 0 100-4 2 2 0 000 4zm10 0a2 2 0 100-4 2 2 0 000 4z" />
                                                        </svg>
                                                    ) : (
                                                        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 20a4 4 0 100-8 4 4 0 000 8zm-8 0a4 4 0 100-8 4 4 0 000 8zm16-4v-2c0-1.1-.9-2-2-2h-3v-2c0-2.2-1.8-4-4-4H8a4 4 0 00-4 4v2H1" />
                                                        </svg>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-base font-bold truncate" style={{ color: C.navy }}>{v.plateNumber}</p>
                                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                        <span className="text-xs font-medium px-2 py-0.5 rounded-md" style={{ background: C.bg, color: C.gray }}>
                                                            {v.brand}
                                                        </span>
                                                        <span className="text-xs font-medium px-2 py-0.5 rounded-md" style={{ background: C.bg, color: C.gray }}>
                                                            {v.color}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteVehicle(index)}
                                                className="p-2 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0 ml-2"
                                            >
                                                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>

                        {/* Withdrawal Accounts Section */}
                        <section id="withdrawal-accounts">
                            <div className="flex items-center justify-between mb-3 px-1">
                                <h2 className="text-sm font-bold" style={{ color: C.navy }}>{t('user.settings.withdrawalAccounts.title')}</h2>
                                <button
                                    type="button"
                                    onClick={openAddAccountModal}
                                    className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80 flex items-center gap-1"
                                    style={{ color: C.orange, background: C.orangeLight }}
                                >
                                    <Plus size={14} />
                                    {t('user.settings.withdrawalAccounts.addBtn')}
                                </button>
                            </div>

                            <div className="bg-white rounded-2xl p-2 space-y-2 border" style={{ borderColor: C.border, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                                {withdrawalAccountsLoading ? (
                                    <div className="p-4 text-center text-xs text-gray-500">{t('user.settings.withdrawalAccounts.loading')}</div>
                                ) : withdrawalAccounts.length === 0 ? (
                                    <div className="p-4 text-center text-xs text-gray-500">{t('user.settings.withdrawalAccounts.empty')}</div>
                                ) : (
                                    withdrawalAccounts.map(acc => (
                                        <div
                                            key={acc.id}
                                            className="flex items-start justify-between gap-3 p-3 rounded-xl border"
                                            style={{ borderColor: C.border, boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-bold truncate" style={{ color: C.navy }}>{acc.bankName}</p>
                                                <p className="text-xs mt-1" style={{ color: C.gray }}>
                                                    {t('user.settings.withdrawalAccounts.accountSummary', {
                                                        number: displayAccountNumber(acc.accountNumber),
                                                        name: acc.accountHolderName,
                                                    })}
                                                </p>
                                                {acc.branchName && (
                                                    <p className="text-xs mt-1" style={{ color: C.gray }}>
                                                        {t('user.settings.withdrawalAccounts.branchLine', { name: acc.branchName })}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => openEditAccountModal(acc)}
                                                    className="p-2 rounded-lg hover:bg-slate-50 transition-colors"
                                                    style={{ color: C.orange, border: `1.5px solid ${C.border}` }}
                                                    aria-label={t('user.settings.withdrawalAccounts.editAriaLabel')}
                                                >
                                                    <Edit3 size={16} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteAccount(acc.id)}
                                                    className="p-2 rounded-lg hover:bg-slate-50 transition-colors"
                                                    style={{ color: C.danger, border: `1.5px solid ${C.border}` }}
                                                    aria-label={t('user.settings.withdrawalAccounts.deleteAriaLabel')}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>

                        {/* System Preferences Section */}
                        <section>
                            <h2 className="text-sm font-bold mb-3 px-1" style={{ color: C.navy }}>{t('user.settings.preferences.title')}</h2>
                            <div className="bg-white rounded-2xl p-2 space-y-2 border" style={{ borderColor: C.border, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                                <div className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.border }}>
                                            <Globe style={{ width: 18, height: 18, color: C.gray }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold" style={{ color: C.navy }}>{t('user.settings.preferences.language')}</p>
                                            <p className="text-xs" style={{ color: C.gray }}>{t('user.settings.preferences.languageDesc')}</p>
                                        </div>
                                    </div>
                                    <LanguageSwitcher />
                                </div>
                            </div>
                        </section>

                        {/* Security Section */}
                        <section>
                            <h2 className="text-sm font-bold mb-3 px-1" style={{ color: C.navy }}>{t('user.settings.security.title')}</h2>
                            <div className="bg-white rounded-2xl p-2 space-y-2 border" style={{ borderColor: C.border, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                                <button
                                    onClick={() => { setErrorMsg(''); setIsEditingPassword(true); }}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left focus:outline-none"
                                >
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.border }}>
                                        <Lock style={{ width: 18, height: 18, color: C.gray }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold" style={{ color: C.navy }}>{t('user.settings.security.changePassword')}</p>
                                        <p className="text-xs" style={{ color: C.gray }}>{t('user.settings.security.changePasswordDesc')}</p>
                                    </div>
                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#cbd5e1" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left focus:outline-none"
                                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = C.dangerLight)}
                                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.dangerLight }}>
                                        <LogOut style={{ width: 18, height: 18, color: C.danger }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold" style={{ color: C.danger }}>{t('user.settings.security.logout')}</p>
                                        <p className="text-xs" style={{ color: '#f87171' }}>{t('user.settings.security.logoutDesc')}</p>
                                    </div>
                                </button>
                            </div>
                        </section>

                    </div>
                </div>
            </div>

            {/* ═══ MOBILE Bottom Navigation ═══ */}
            <nav
                className="fixed bottom-0 left-0 right-0 md:hidden z-30 flex items-stretch"
                style={{ background: C.white, borderTop: `1px solid ${C.border}`, height: '60px' }}
            >
                {navItems.map(item => {
                    const active = item.label === settingsLabel;
                    return (
                        <button
                            key={item.label}
                            onClick={() => {
                                if (item.href === '/user/disputes') resetDisputeNavBadge();
                                if (item.href !== '#') router.push(item.href);
                            }}
                            className="relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
                            style={{ color: active ? C.orange : '#94a3b8' }}
                        >
                            <span style={{ color: active ? C.orange : '#94a3b8' }}>{item.icon}</span>
                            <span className="text-[9px] font-medium">{item.label}</span>
                            {item.href === '/user/disputes' && disputeNavBadge > 0 && !active && (
                                <span className="absolute top-1 right-2 min-w-[16px] h-4 px-0.5 text-[9px] font-bold text-white rounded-full flex items-center justify-center" style={{ background: '#ef4444' }}>
                                    {disputeNavBadge > 99 ? '99+' : disputeNavBadge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* ═══ Modals ═══ */}

            {/* Withdrawal Accounts Modal */}
            <SettingsModal
                isOpen={isAccountModalOpen}
                onClose={() => setIsAccountModalOpen(false)}
                title={editingAccountId ? t('user.settings.withdrawalAccounts.modalEditTitle') : t('user.settings.withdrawalAccounts.modalAddTitle')}
            >
                <form onSubmit={handleSubmitAccount} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: C.navy }}>{t('user.settings.withdrawalAccounts.accountNumberLabel')}</label>
                        <input
                            type="text"
                            value={accountForm.accountNumber}
                            onChange={e => setAccountForm(s => ({ ...s, accountNumber: e.target.value.replace(/\D/g, '') }))}
                            className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-orange-500"
                            style={{ borderColor: C.border, color: C.navy }}
                            placeholder={t('user.settings.withdrawalAccounts.accountNumberPlaceholder')}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: C.navy }}>{t('user.settings.withdrawalAccounts.bankLabel')}</label>
                        <BankSelect
                            value={accountForm.bankCode ?? ''}
                            onChange={(nextCode, option) => {
                                if (nextCode === BANK_CUSTOM_CODE) {
                                    setAccountForm(s => ({ ...s, bankCode: undefined, bankName: '' }));
                                    return;
                                }
                                const labelFromOption = option?.label ?? '';
                                if (labelFromOption) {
                                    setAccountForm(s => ({ ...s, bankCode: nextCode, bankName: labelFromOption }));
                                    return;
                                }
                                getBankOptions().then(list => {
                                    const label = list.find(b => b.code === nextCode)?.label ?? '';
                                    setAccountForm(s => ({ ...s, bankCode: nextCode, bankName: label }));
                                });
                            }}
                            className="w-full"
                            style={{}}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: C.navy }}>{t('user.settings.withdrawalAccounts.bankNameLabel')}</label>
                        <input
                            type="text"
                            value={accountForm.bankName}
                            onChange={e => setAccountForm(s => ({ ...s, bankName: e.target.value }))}
                            className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-orange-500"
                            style={{ borderColor: C.border, color: C.navy }}
                            placeholder={t('user.settings.withdrawalAccounts.bankNamePlaceholder')}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: C.navy }}>{t('user.settings.withdrawalAccounts.branchLabel')}</label>
                        <input
                            type="text"
                            value={accountForm.branchName}
                            onChange={e => setAccountForm(s => ({ ...s, branchName: e.target.value }))}
                            className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-orange-500"
                            style={{ borderColor: C.border, color: C.navy }}
                            placeholder={t('user.settings.withdrawalAccounts.branchPlaceholder')}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: C.navy }}>{t('user.settings.withdrawalAccounts.accountHolderLabel')}</label>
                        <input
                            type="text"
                            value={accountForm.accountHolderName}
                            onChange={e => setAccountForm(s => ({ ...s, accountHolderName: e.target.value }))}
                            className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-orange-500"
                            style={{ borderColor: C.border, color: C.navy }}
                            placeholder={t('user.settings.withdrawalAccounts.accountHolderPlaceholder')}
                        />
                    </div>

                    <div className="flex gap-2 justify-end pt-2">
                        <button
                            type="button"
                            onClick={() => setIsAccountModalOpen(false)}
                            className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors hover:bg-slate-100"
                            style={{ color: C.gray }}
                            disabled={isAccountSaving}
                        >
                            {t('user.settings.withdrawalAccounts.cancelBtn')}
                        </button>
                        <button
                            type="submit"
                            disabled={isAccountSaving}
                            className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                            style={{ backgroundColor: C.orange }}
                        >
                            {isAccountSaving ? t('user.settings.withdrawalAccounts.savingBtn') : t('user.settings.withdrawalAccounts.saveBtn')}
                        </button>
                    </div>
                </form>
            </SettingsModal>

            {/* Edit Name Modal */}
            <SettingsModal
                isOpen={isEditingName}
                onClose={() => setIsEditingName(false)}
                title={t('user.settings.modals.editNameTitle')}
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: C.navy }}>{t('user.settings.modals.editNameLabel')}</label>
                        <input
                            type="text"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-orange-500"
                            style={{ borderColor: C.border, color: C.navy }}
                            placeholder={t('user.settings.modals.editNamePlaceholder')}
                        />
                    </div>
                    {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}
                    <div className="flex gap-2 justify-end pt-2">
                        <button
                            onClick={() => setIsEditingName(false)}
                            className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors hover:bg-slate-100"
                            style={{ color: C.gray }}
                        >
                            {t('user.settings.modals.cancelBtn')}
                        </button>
                        <button
                            disabled={isSaving}
                            onClick={() => handleSaveProfile('name')}
                            className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                            style={{ backgroundColor: C.orange }}
                        >
                            {isSaving ? t('user.settings.modals.savingBtn') : t('user.settings.modals.saveBtn')}
                        </button>
                    </div>
                </div>
            </SettingsModal>

            {/* Edit Phone Modal */}
            <SettingsModal
                isOpen={isEditingPhone}
                onClose={() => setIsEditingPhone(false)}
                title={t('user.settings.modals.editPhoneTitle')}
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: C.navy }}>{t('user.settings.modals.editPhoneLabel')}</label>
                        <input
                            type="tel"
                            value={editPhone}
                            onChange={e => handlePhoneChange(e.target.value)}
                            className={`w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-orange-500 ${phoneError ? 'border-red-500 focus:border-red-500' : ''}`}
                            style={{ borderColor: phoneError ? '#ef4444' : C.border, color: C.navy }}
                            placeholder={t('user.settings.modals.editPhonePlaceholder')}
                        />
                        {phoneError && <p className="text-xs text-red-500 mt-1">{phoneError}</p>}
                    </div>
                    {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}
                    <div className="flex gap-2 justify-end pt-2">
                        <button
                            onClick={() => setIsEditingPhone(false)}
                            className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors hover:bg-slate-100"
                            style={{ color: C.gray }}
                        >
                            {t('user.settings.modals.cancelBtn')}
                        </button>
                        <button
                            disabled={isSaving}
                            onClick={() => handleSaveProfile('phone')}
                            className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                            style={{ backgroundColor: C.orange }}
                        >
                            {isSaving ? t('user.settings.modals.savingBtn') : t('user.settings.modals.saveBtn')}
                        </button>
                    </div>
                </div>
            </SettingsModal>

            {/* Add Vehicle Modal */}
            <SettingsModal
                isOpen={isAddingVehicle}
                onClose={() => setIsAddingVehicle(false)}
                title={t('user.settings.modals.addVehicleTitle')}
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        <button
                            onClick={() => setNewVehicleType('MOTORCYCLE')}
                            className={`py-2 rounded-xl text-sm font-semibold border-2 transition-all ${newVehicleType === 'MOTORCYCLE' ? 'border-orange-500 text-orange-500 bg-orange-50' : 'border-slate-100 text-slate-500'}`}
                        >
                            Xe máy
                        </button>
                        <button
                            onClick={() => setNewVehicleType('CAR')}
                            className={`py-2 rounded-xl text-sm font-semibold border-2 transition-all ${newVehicleType === 'CAR' ? 'border-orange-500 text-orange-500 bg-orange-50' : 'border-slate-100 text-slate-500'}`}
                        >
                            Ô tô
                        </button>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: C.navy }}>{t('user.settings.modals.plateLabel')}</label>
                        <input
                            type="text"
                            value={newVehiclePlate}
                            onChange={e => handlePlateChange(e.target.value)}
                            className={`w-full px-3 py-2 border rounded-xl text-sm outline-none uppercase ${plateError ? 'border-red-500 focus:border-red-500' : 'focus:border-orange-500'}`}
                            style={{ borderColor: plateError ? '#ef4444' : C.border, color: C.navy }}
                            placeholder={t('user.settings.modals.platePlaceholder')}
                        />
                        {plateError && <p className="text-xs text-red-500 mt-1">{plateError}</p>}
                    </div>
                    <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: C.navy }}>{t('user.settings.modals.colorLabel')}</label>
                        <input
                            type="text"
                            value={newVehicleColor}
                            onChange={e => setNewVehicleColor(e.target.value)}
                            className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-orange-500"
                            style={{ borderColor: C.border, color: C.navy }}
                            placeholder={t('user.settings.modals.colorPlaceholder')}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: C.navy }}>{t('user.settings.modals.brandLabel')}</label>
                        <input
                            type="text"
                            value={newVehicleBrand}
                            onChange={e => setNewVehicleBrand(e.target.value)}
                            className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-orange-500"
                            style={{ borderColor: C.border, color: C.navy }}
                            placeholder={t('user.settings.modals.brandPlaceholder')}
                        />
                    </div>

                    {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}
                    <div className="flex gap-2 justify-end pt-2">
                        <button
                            onClick={() => setIsAddingVehicle(false)}
                            className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors hover:bg-slate-100"
                            style={{ color: C.gray }}
                        >
                            {t('user.settings.modals.cancelBtn')}
                        </button>
                        <button
                            disabled={isSaving}
                            onClick={handleAddVehicle}
                            className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                            style={{ backgroundColor: C.orange }}
                        >
                            {isSaving ? t('user.settings.modals.savingBtn') : t('user.settings.modals.saveBtn')}
                        </button>
                    </div>
                </div>
            </SettingsModal>

            {/* Change Password Modal */}
            <SettingsModal
                isOpen={isEditingPassword}
                onClose={() => setIsEditingPassword(false)}
                title={t('user.settings.modals.changePasswordTitle')}
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: C.navy }}>{t('user.settings.modals.oldPasswordLabel')}</label>
                        <input
                            type="password"
                            value={oldPassword}
                            onChange={e => setOldPassword(e.target.value)}
                            className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-orange-500"
                            style={{ borderColor: C.border, color: C.navy }}
                            placeholder={t('user.settings.modals.oldPasswordPlaceholder')}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: C.navy }}>{t('user.settings.modals.newPasswordLabel')}</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-orange-500"
                            style={{ borderColor: C.border, color: C.navy }}
                            placeholder={t('user.settings.modals.newPasswordPlaceholder')}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: C.navy }}>{t('user.settings.modals.confirmPasswordLabel')}</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            className="w-full px-3 py-2 border rounded-xl text-sm outline-none focus:border-orange-500"
                            style={{ borderColor: C.border, color: C.navy }}
                            placeholder={t('user.settings.modals.confirmPasswordPlaceholder')}
                        />
                    </div>
                    {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}
                    <div className="flex gap-2 justify-end pt-2">
                        <button
                            onClick={() => setIsEditingPassword(false)}
                            className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors hover:bg-slate-100"
                            style={{ color: C.gray }}
                        >
                            {t('user.settings.modals.cancelBtn')}
                        </button>
                        <button
                            disabled={isSaving || !oldPassword || !newPassword || !confirmPassword}
                            onClick={handleChangePassword}
                            className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                            style={{ backgroundColor: C.orange }}
                        >
                            {isSaving ? t('user.settings.modals.savingBtn') : t('user.settings.modals.saveBtn')}
                        </button>
                    </div>
                </div>
            </SettingsModal>

        </div>
    );
}
