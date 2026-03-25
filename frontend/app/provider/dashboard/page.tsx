'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { CheckCircle, XCircle, Clock, Edit, Wallet, Send } from 'lucide-react';
import api from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import { useProviderGuard } from '@/lib/guards';
import ProviderLayout from '@/components/ProviderLayout';
import toast from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';

const C = {
    orange: '#f97316', orangeDark: '#ea6c0a', orangeLight: '#fff7ed',
    navy: '#1a1a2e', gray: '#6b7280', border: '#e2e8f0', bg: '#f4f6f9',
    green: '#16a34a', red: '#ef4444',
};

interface ProviderProfile {
    id: string;
    fullName: string;
    email: string;
    phoneNumber: string;
    providerType: string;
    verificationStatus: string;
    submittedAt: string | null;
    rejectedAt: string | null;
    rejectReasonCode: string | null;
    rejectReasonDetail: string | null;
    isActive: boolean;
    serviceTypes: string[];
    supportedVehicleTypes: string[];
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl border p-5 mb-4" style={{ borderColor: C.border }}>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b" style={{ borderColor: C.border }}>
                <div className="w-1 h-4 rounded-full shrink-0" style={{ background: C.orange }} />
                <h2 className="text-sm font-bold" style={{ color: C.navy }}>{title}</h2>
            </div>
            {children}
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: C.border }}>
            <span className="text-xs" style={{ color: C.gray }}>{label}</span>
            <span className="text-xs font-semibold" style={{ color: C.navy }}>{value}</span>
        </div>
    );
}

function ProviderDashboardContent() {
    const router = useRouter();
    const { t, locale } = useLanguage();
    const searchParams = useSearchParams();
    const verification = searchParams.get('verification');
    const isEdit = searchParams.get('edit') === 'true';
    const { isReady } = useProviderGuard();
    const [profile, setProfile] = useState<ProviderProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [walletBalance, setWalletBalance] = useState<number | null>(null);

    const MIN_DEPOSIT = 100_000;
    const dateLocale = locale === 'vi' ? 'vi-VN' : 'en-US';

    const formatDate = (value: string | null) => (value ? new Date(value).toLocaleString(dateLocale) : '');
    const formatCurrency = (value: number) => new Intl.NumberFormat(dateLocale).format(value);

    const serviceLabels: Record<string, string> = {
        TOWING: t('provider.profileDashboard.serviceLabels.TOWING'),
        BATTERY_JUMP: t('provider.profileDashboard.serviceLabels.BATTERY_JUMP'),
        TIRE_CHANGE: t('provider.profileDashboard.serviceLabels.TIRE_CHANGE'),
        FUEL_DELIVERY: t('provider.profileDashboard.serviceLabels.FUEL_DELIVERY'),
        LOCKOUT: t('provider.profileDashboard.serviceLabels.LOCKOUT'),
        BREAKDOWN_REPAIR: t('provider.profileDashboard.serviceLabels.BREAKDOWN_REPAIR'),
    };

    const vehicleLabels: Record<string, string> = {
        CAR: t('provider.profileDashboard.vehicleLabels.CAR'),
        MOTORCYCLE: t('provider.profileDashboard.vehicleLabels.MOTORCYCLE'),
    };

    useEffect(() => {
        if (isReady) loadProfile();
    }, [isReady]);

    // Fetch wallet balance for APPROVED providers to show deposit reminder
    useEffect(() => {
        if (profile?.verificationStatus === 'APPROVED') {
            api.get('/wallet/me')
                .then(r => setWalletBalance(r.data.availableBalance ?? 0))
                .catch(() => setWalletBalance(0));
        }
    }, [profile?.verificationStatus]);

    // Show toast when redirected after submission
    useEffect(() => {
        if (verification === 'submitted') {
            if (isEdit) {
                toast.success(t('provider.profileDashboard.toast.updatedSubmitted'), {
                    duration: 6000,
                    id: 'provider-verification-submitted-edit',
                });
            } else {
                toast.success(t('provider.profileDashboard.toast.submitted'), {
                    duration: 6000,
                    id: 'provider-verification-submitted',
                });
            }
            window.history.replaceState({}, '', '/provider/dashboard');
        }
    }, [verification, isEdit, t]);

    const loadProfile = async () => {
        try {
            const res = await api.get('/me/provider/profile');
            setProfile(res.data);
        } catch (err) {
            console.error('Failed to load profile:', err);
        } finally {
            setLoading(false);
        }
    };

    if (!isReady || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
                <div className="w-9 h-9 rounded-full border-[3px] border-t-transparent animate-spin" style={{ borderColor: C.orange, borderTopColor: 'transparent' }} />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
                <p className="text-sm" style={{ color: C.gray }}>{t('provider.profileDashboard.notFound')}</p>
            </div>
        );
    }

    const status = profile.verificationStatus;

    return (
        <ProviderLayout activeTab="/provider/dashboard">
            <div className="min-h-screen py-8 px-4" style={{ background: C.bg, fontFamily: 'Lexend, sans-serif' }}>
                <div className="max-w-2xl mx-auto">
                    <h1 className="text-xl font-bold mb-6" style={{ color: C.navy }}>{t('provider.profileDashboard.title')}</h1>

                    {/* ── PENDING banner ── */}
                    {status === 'PENDING' && (
                        <div className="bg-white rounded-2xl border-2 p-5 mb-4 flex items-start gap-4" style={{ borderColor: '#fde68a', background: '#fffbeb' }}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#fef3c7' }}>
                                <Clock className="w-5 h-5" style={{ color: '#d97706' }} />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold mb-1" style={{ color: '#92400e' }}>{t('provider.profileDashboard.pending.title')}</p>
                                <p className="text-xs leading-relaxed" style={{ color: '#b45309' }}>
                                    {t('provider.profileDashboard.pending.desc')}
                                </p>
                                {profile.submittedAt && (
                                    <p className="text-xs mt-2" style={{ color: '#b45309', opacity: 0.7 }}>
                                        {t('provider.profileDashboard.labels.submittedAt')}: {formatDate(profile.submittedAt)}
                                    </p>
                                )}
                                <div className="flex gap-2 mt-3">
                                    <button
                                        onClick={() => router.push('/provider/onboarding')}
                                        className="flex-1 py-2 rounded-xl text-xs font-semibold text-white"
                                        style={{ background: '#d97706' }}
                                    >
                                        {t('provider.profileDashboard.pending.editProfile')}
                                    </button>
                                    <button
                                        onClick={() => window.open('mailto:support@rescueme.vn', '_blank')}
                                        className="flex-1 py-2 rounded-xl text-xs font-semibold border"
                                        style={{ color: '#92400e', borderColor: '#fde68a', background: 'white' }}
                                    >
                                        {t('provider.profileDashboard.pending.contactSupport')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── DRAFT banner ── */}
                    {status === 'DRAFT' && (
                        <div className="bg-white rounded-2xl border p-5 mb-4 flex items-start gap-4" style={{ borderColor: C.border }}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.orangeLight }}>
                                <Send className="w-5 h-5" style={{ color: C.orange }} />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold mb-1" style={{ color: C.navy }}>{t('provider.profileDashboard.draft.title')}</p>
                                <p className="text-xs mb-3" style={{ color: C.gray }}>{t('provider.profileDashboard.draft.desc')}</p>
                                <button onClick={() => router.push('/provider/onboarding')}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all"
                                    style={{ background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})` }}>
                                    {t('provider.profileDashboard.draft.continue')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── APPROVED banner ── */}
                    {status === 'APPROVED' && (
                        <div className="bg-white rounded-2xl border p-5 mb-4 flex items-start gap-4" style={{ borderColor: '#bbf7d0', background: '#f0fdf4' }}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#dcfce7' }}>
                                <CheckCircle className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm font-bold mb-0.5 text-green-800">{t('provider.profileDashboard.approved.title')}</p>
                                <p className="text-xs text-green-700">{t('provider.profileDashboard.approved.desc')}</p>
                            </div>
                        </div>
                    )}

                    {/* ── REJECTED banner ── */}
                    {status === 'REJECTED' && (
                        <div className="bg-white rounded-2xl border-2 p-5 mb-4" style={{ borderColor: '#fca5a5', background: '#fff5f5' }}>
                            <div className="flex items-start gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#fee2e2' }}>
                                    <XCircle className="w-5 h-5" style={{ color: C.red }} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold mb-0.5" style={{ color: '#7f1d1d' }}>{t('provider.profileDashboard.rejected.title')}</p>
                                    <p className="text-xs" style={{ color: '#991b1b' }}>{t('provider.profileDashboard.rejected.desc')}</p>
                                </div>
                            </div>
                            {profile.rejectReasonCode && (
                                <div className="rounded-xl p-3 mb-3" style={{ background: '#fee2e280' }}>
                                    <p className="text-xs font-semibold mb-0.5" style={{ color: '#7f1d1d' }}>{t('provider.profileDashboard.labels.reason')}: {profile.rejectReasonCode}</p>
                                    {profile.rejectReasonDetail && <p className="text-xs" style={{ color: '#991b1b' }}>{profile.rejectReasonDetail}</p>}
                                    {profile.rejectedAt && <p className="text-[10px] mt-1" style={{ color: '#b91c1c', opacity: 0.7 }}>{t('provider.profileDashboard.labels.rejectedAt')}: {formatDate(profile.rejectedAt)}</p>}
                                </div>
                            )}
                            <button onClick={() => router.push('/provider/onboarding')}
                                className="w-full py-2 rounded-xl text-xs font-semibold text-white"
                                style={{ background: C.red }}>
                                <Edit className="w-3.5 h-3.5 inline mr-1.5" />{t('provider.profileDashboard.rejected.editResubmit')}
                            </button>
                        </div>
                    )}

                    {/* ── Provider info ── */}
                    <SectionCard title={t('provider.profileDashboard.infoCard.title')}>
                        <Row label={t('provider.profileDashboard.infoCard.fullName')} value={profile.fullName || t('provider.profileDashboard.notUpdated')} />
                        <Row label={t('provider.profileDashboard.infoCard.email')} value={profile.email} />
                        <Row label={t('provider.profileDashboard.infoCard.phone')} value={profile.phoneNumber || t('provider.profileDashboard.notUpdated')} />
                        <Row label={t('provider.profileDashboard.infoCard.providerType')} value={profile.providerType === 'INDIVIDUAL' ? t('provider.profileDashboard.providerType.individual') : t('provider.profileDashboard.providerType.business')} />
                        <Row label={t('provider.profileDashboard.infoCard.services')} value={profile.serviceTypes?.map(s => serviceLabels[s] || s).join(', ') || t('provider.profileDashboard.notUpdated')} />
                        <Row label={t('provider.profileDashboard.infoCard.vehicles')} value={profile.supportedVehicleTypes?.map(v => vehicleLabels[v] || v).join(', ') || t('provider.profileDashboard.notUpdated')} />
                    </SectionCard>

                    {/* ── Deposit reminder (APPROVED + balance < 100k) ── */}
                    {status === 'APPROVED' && walletBalance !== null && walletBalance < MIN_DEPOSIT && (
                        <div
                            className="rounded-2xl p-4 mb-4 flex items-start gap-3"
                            style={{ background: '#fffbeb', border: '1.5px solid #fde68a' }}
                        >
                            <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                style={{ background: '#fef3c7' }}
                            >
                                <Wallet className="w-4 h-4" style={{ color: '#d97706' }} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold mb-0.5" style={{ color: '#92400e' }}>
                                    {t('provider.profileDashboard.depositReminder.title')}
                                </p>
                                <p className="text-xs" style={{ color: '#b45309' }}>
                                    {t('provider.profileDashboard.depositReminder.needAtLeast')} <strong>{formatCurrency(MIN_DEPOSIT)} ₫</strong> {t('provider.profileDashboard.depositReminder.inWallet')}
                                    {walletBalance > 0 && <> · {t('provider.profileDashboard.depositReminder.currentBalance')}: <strong>{formatCurrency(walletBalance)}₫</strong></>}
                                </p>
                            </div>
                            <button
                                onClick={() => router.push('/provider/wallet')}
                                className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold text-white"
                                style={{ background: '#d97706' }}
                            >
                                {t('provider.profileDashboard.depositReminder.depositNow')}
                            </button>
                        </div>
                    )}

                    {/* ── Online/Offline toggle (only APPROVED) ── */}

                    <div className="bg-white rounded-2xl border p-5 mb-4" style={{ borderColor: C.border }}>
                        <div className="flex items-center gap-2 mb-4 pb-3 border-b" style={{ borderColor: C.border }}>
                            <div className="w-1 h-4 rounded-full shrink-0" style={{ background: C.orange }} />
                            <h2 className="text-sm font-bold" style={{ color: C.navy }}>{t('provider.profileDashboard.activity.title')}</h2>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium" style={{ color: C.navy }}>
                                    {status === 'APPROVED'
                                        ? (profile.isActive
                                            ? t('provider.profileDashboard.activity.statusApprovedOnline')
                                            : t('provider.profileDashboard.activity.statusApprovedOffline'))
                                        : t('provider.profileDashboard.activity.statusNotActivated')}
                                </p>
                                <p className="text-xs mt-0.5" style={{ color: C.gray }}>
                                    {status === 'APPROVED'
                                        ? t('provider.profileDashboard.activity.hintApproved')
                                        : t('provider.profileDashboard.activity.hintNotApproved')}
                                </p>
                            </div>
                            <button
                                disabled={status !== 'APPROVED'}
                                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${status === 'APPROVED' && profile.isActive ? 'bg-green-500' : 'bg-gray-300'} ${status !== 'APPROVED' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${profile.isActive && status === 'APPROVED' ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </ProviderLayout>
    );
}

export default function ProviderDashboard() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
                    <div className="w-9 h-9 rounded-full border-[3px] border-t-transparent animate-spin" style={{ borderColor: C.orange, borderTopColor: 'transparent' }} />
                </div>
            }
        >
            <ProviderDashboardContent />
        </Suspense>
    );
}
