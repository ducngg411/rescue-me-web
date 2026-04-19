'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminGuard } from '@/lib/guards';
import { adminApi } from '@/lib/api';
import AdminLayout from '@/components/AdminLayout';
import AvatarImage from '@/components/AvatarImage';
import { displayOrderCode } from '@/lib/reconciliation';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    Search, ChevronLeft, ChevronRight, Filter, Calendar, Eye,
    X, Mail, Phone, Wallet, Car, Star, Clock, ShieldOff, ShieldCheck,
    AlertTriangle, Loader2, Trash2, ExternalLink, Users, CheckCircle, Lock, BarChart2
} from 'lucide-react';
import { ChartCard, HorizontalBarChart } from '@/components/AdminCharts';

const C = {
    orange: '#f97316',
    orangeLight: '#fff7ed',
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#e2e8f0',
    bg: '#f4f6f9',
    green: '#16a34a',
    greenLight: '#f0fdf4',
    red: '#ef4444',
    redLight: '#fef2f2',
    yellow: '#ca8a04',
    yellowLight: '#fefce8',
    blue: '#2563eb',
    blueLight: '#eff6ff',
};

function localeTag(locale: string) {
    return locale === 'vi' ? 'vi-VN' : 'en-US';
}

type Translate = (path: string, params?: Record<string, string | number>) => string;

function incidentTypeLabel(t: Translate, incidentType: string) {
    const path = `admin.requests.incident.${incidentType}`;
    const v = t(path);
    return v === path ? incidentType : v;
}

function requestStatusBadge(t: Translate, status: string) {
    const path = `admin.requests.status.${status}`;
    const label = t(path);
    const resolved = label === path ? status : label;
    const styles: Record<string, { color: string; bg: string }> = {
        COMPLETED: { color: C.green, bg: C.greenLight },
        CANCELLED: { color: C.red, bg: C.redLight },
        PAID: { color: C.green, bg: C.greenLight },
        IN_PROGRESS: { color: C.blue, bg: C.blueLight },
    };
    return { label: resolved, ...(styles[status] ?? { color: C.gray, bg: C.bg }) };
}

interface UserItem {
    id: string;
    fullName: string | null;
    email: string;
    avatar: string | null;
    phoneNumber: string | null;
    authProvider: 'EMAIL' | 'GOOGLE';
    profileCompleted: boolean;
    role: 'USER' | 'PROVIDER' | 'ADMIN';
    bannedAt: string | null;
    createdAt: string;
    lastLogin: string | null;
    _count: { rescueRequests: number; assignedRequests?: number };
    averageRating?: number;
    userWallet: { availableBalance: number } | null;
    providerWallet?: { availableBalance: number } | null;
}

interface UserDetail extends UserItem {
    licensePlate: string | null;
    vehicleColor: string | null;
    vehicleType: string | null;
    defaultAddress: { addressText?: string } | null;
    banReason: string | null;
    userWallet: { availableBalance: number; pendingBalance: number } | null;
    _count: { rescueRequests: number; reviewsGiven: number; assignedRequests?: number; reviewsReceived?: number };
    rescueRequests: Array<{
        id: string;
        orderCode: string | null;
        incidentType: string;
        status: string;
        createdAt: string;
        payment: { totalAmount: number } | null;
    }>;
    assignedRequests?: Array<{
        id: string;
        orderCode: string | null;
        incidentType: string;
        status: string;
        createdAt: string;
        payment: { totalAmount: number } | null;
    }>;
}

type TabType = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'ROLE_USER' | 'ROLE_PROVIDER' | 'ROLE_ADMIN' | 'ACCOUNT_ACTIVE' | 'ACCOUNT_BANNED';

const PAGE_SIZE = 10;

function RoleBadge({ role }: { role: UserItem['role'] }) {
    const { t } = useLanguage();
    const map: Record<UserItem['role'], { labelKey: string; bg: string; color: string }> = {
        USER: { labelKey: 'admin.users.role.USER', bg: '#eff6ff', color: '#2563eb' },
        PROVIDER: { labelKey: 'admin.users.role.PROVIDER', bg: '#f0fdf4', color: '#16a34a' },
        ADMIN: { labelKey: 'admin.users.role.ADMIN', bg: '#fefce8', color: '#ca8a04' },
    };
    const c = map[role];
    return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: c.bg, color: c.color }}>
            {t(c.labelKey)}
        </span>
    );
}

function ProfileBadge({ completed }: { completed: boolean }) {
    const { t } = useLanguage();
    return completed ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: C.greenLight, color: C.green }}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {t('admin.users.profileComplete')}
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: C.yellowLight, color: C.yellow }}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {t('admin.users.profileIncomplete')}
        </span>
    );
}

function AccountBadge({ banned }: { banned: boolean }) {
    const { t } = useLanguage();
    return banned ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: C.redLight, color: C.red }}>
            <ShieldOff className="w-2.5 h-2.5" />
            {t('admin.users.accountBanned')}
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: C.blueLight, color: C.blue }}>
            <ShieldCheck className="w-2.5 h-2.5" />
            {t('admin.users.accountActive')}
        </span>
    );
}

function AuthBadge({ provider }: { provider: 'EMAIL' | 'GOOGLE' }) {
    const { t } = useLanguage();
    if (provider === 'GOOGLE') return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: C.blueLight, color: C.blue }}>
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {t('admin.users.authGoogle')}
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: C.greenLight, color: C.green }}>
            <Mail className="w-3 h-3" />
            {t('admin.users.authEmail')}
        </span>
    );
}

// ── Slide-Over Detail Panel ──────────────────────────────────────────────────
function UserDetailPanel({
    userId,
    onClose,
    onUpdated,
    onDeleted,
}: {
    userId: string;
    onClose: () => void;
    onUpdated: () => void;
    onDeleted: () => void;
}) {
    const router = useRouter();
    const { t, locale } = useLanguage();
    const loc = localeTag(locale);
    const [user, setUser] = useState<UserDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null); // which action
    const [error, setError] = useState('');
    const [showBanModal, setShowBanModal] = useState(false);
    const [banReasonInput, setBanReasonInput] = useState('');
    const [showUnbanModal, setShowUnbanModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = await adminApi.getUserDetail(userId);
            setUser(data as UserDetail);
        } catch {
            setError(t('admin.users.panel.loadError'));
        } finally {
            setLoading(false);
        }
    }, [userId, t]);

    useEffect(() => { load(); }, [load]);

    const handleBanOpen = () => { setBanReasonInput(''); setShowBanModal(true); };

    const handleBanConfirm = async () => {
        if (!banReasonInput.trim()) return;
        setActionLoading('ban');
        setError('');
        try {
            await adminApi.suspendUser(userId, banReasonInput.trim());
            setShowBanModal(false);
            await load();
            onUpdated();
        } catch {
            setError(t('admin.users.panel.errorBan'));
        } finally {
            setActionLoading(null);
        }
    };

    const handleUnban = () => {
        setShowUnbanModal(true);
    };

    const handleUnbanConfirm = async () => {
        setActionLoading('unban');
        setError('');
        try {
            await adminApi.activateUser(userId);
            setShowUnbanModal(false);
            await load();
            onUpdated();
        } catch {
            setError(t('admin.users.panel.errorUnban'));
        } finally {
            setActionLoading(null);
        }
    };

    const handleDelete = () => {
        setShowDeleteModal(true);
    };

    const handleDeleteConfirm = async () => {
        setActionLoading('delete');
        setError('');
        try {
            await adminApi.deleteUser(userId);
            setShowDeleteModal(false);
            onDeleted();
        } catch {
            setError(t('admin.users.panel.errorDelete'));
        } finally {
            setActionLoading(null);
        }
    };

    const handleViewWallet = () => {
        // Admin Transactions has separate pages:
        // - /admin/transactions/provider/:id
        // - /admin/transactions/user/:id
        if (!user) return;
        if (user.role === 'PROVIDER') {
            router.push(`/admin/transactions/provider/${user.id}`);
            return;
        }
        if (user.role === 'USER') {
            router.push(`/admin/transactions/user/${user.id}`);
            return;
        }
        // ADMIN role: do nothing (no wallet page)
    };

    const isBanned = !!user?.bannedAt;

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

            {/* Panel */}
            <div
                className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md flex flex-col shadow-2xl overflow-hidden"
                style={{ background: '#fff', borderLeft: `1px solid ${C.border}` }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: C.border }}>
                    <h2 className="text-base font-bold" style={{ color: C.navy }}>{t('admin.users.panel.title')}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: C.gray }}>
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="w-8 h-8 rounded-full border-[3px] animate-spin" style={{ borderColor: C.orange, borderTopColor: 'transparent' }} />
                        </div>
                    ) : !user ? (
                        <div className="p-6 text-center text-sm" style={{ color: C.red }}>{error || t('admin.users.panel.notFound')}</div>
                    ) : (
                        <>
                            {error && (
                                <div className="mx-5 mt-4 p-3 rounded-xl text-sm flex items-center gap-2" style={{ background: C.redLight, color: C.red }}>
                                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                    {error}
                                </div>
                            )}

                            {/* Ban info banner */}
                            {isBanned && (
                                <div className="mx-5 mt-4 p-3 rounded-xl flex items-start gap-2" style={{ background: C.redLight, borderLeft: `3px solid ${C.red}` }}>
                                    <ShieldOff className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: C.red }} />
                                    <div>
                                        <p className="text-xs font-bold" style={{ color: C.red }}>{t('admin.users.panel.bannedTitle')}</p>
                                        <p className="text-xs mt-0.5" style={{ color: '#991b1b' }}>{t('admin.users.panel.bannedReason')}: {user.banReason}</p>
                                        <p className="text-[10px] mt-0.5 opacity-70" style={{ color: '#991b1b' }}>
                                            {t('admin.users.panel.bannedAt')}: {new Date(user.bannedAt!).toLocaleString(loc)}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Identity hero */}
                            <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: C.border }}>
                                <div className="flex items-center gap-4">
                                    <AvatarImage
                                        name={user.fullName || user.email}
                                        avatar={user.avatar}
                                        className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
                                        fallbackBackground={C.blue}
                                        initialsCount={1}
                                    />
                                    <div className="min-w-0">
                                        <p className="text-base font-bold truncate" style={{ color: C.navy }}>
                                            {user.fullName || t('admin.users.panel.namePlaceholder')}
                                        </p>
                                        <p className="text-xs truncate mb-2" style={{ color: C.gray }}>{user.email}</p>
                                        {/* Dual-status badges */}
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <ProfileBadge completed={user.profileCompleted} />
                                            <AccountBadge banned={isBanned} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Quick stats */}
                            <div className="grid grid-cols-3 gap-px border-b" style={{ background: C.border }}>
                                {[
                                            {
                                                label: t('admin.users.panel.statWalletBalance'),
                                                value: user.userWallet
                                                    ? `${user.userWallet.availableBalance.toLocaleString(loc)}₫`
                                                    : user.providerWallet
                                                        ? `${user.providerWallet.availableBalance.toLocaleString(loc)}₫`
                                                        : '—',
                                                icon: <Wallet className="w-3.5 h-3.5" />,
                                            },
                                    { 
                                        label: user.role === 'PROVIDER' ? t('admin.users.panel.statJobsCompleted') : t('admin.users.panel.statRequests'), 
                                        value: String(user.role === 'PROVIDER' ? user._count.assignedRequests : user._count.rescueRequests), 
                                        icon: <Car className="w-3.5 h-3.5" /> 
                                    },
                                    { 
                                        label: t('admin.users.panel.statRating'), 
                                        value: user.role === 'PROVIDER' 
                                            ? `${user.averageRating?.toFixed(1) || '0.0'} (${user._count.reviewsReceived || 0})` 
                                            : String(user._count.reviewsGiven), 
                                        icon: <Star className="w-3.5 h-3.5" /> 
                                    },
                                ].map(s => (
                                    <div key={s.label} className="bg-white px-3 py-3 text-center">
                                        <div className="flex items-center justify-center gap-1 mb-1" style={{ color: C.gray }}>
                                            {s.icon}
                                            <span className="text-[10px] font-semibold tracking-wider uppercase">{s.label}</span>
                                        </div>
                                        <p className="text-sm font-bold" style={{ color: C.navy }}>{s.value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Info rows */}
                            <div className="px-5 py-4 space-y-3 border-b" style={{ borderColor: C.border }}>
                                <p className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: C.gray }}>{t('admin.users.panel.contactSection')}</p>
                                {[
                                    { icon: <Phone className="w-3.5 h-3.5" />, label: t('admin.users.panel.phone'), value: user.phoneNumber || '—' },
                                    { icon: <Mail className="w-3.5 h-3.5" />, label: t('admin.users.panel.email'), value: user.email },
                                    { icon: <Car className="w-3.5 h-3.5" />, label: t('admin.users.panel.plate'), value: user.licensePlate ? `${user.licensePlate}${user.vehicleColor ? ` · ${user.vehicleColor}` : ''}` : '—' },
                                    { icon: <Clock className="w-3.5 h-3.5" />, label: t('admin.users.panel.joined'), value: new Date(user.createdAt).toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: 'numeric' }) },
                                    { icon: <Clock className="w-3.5 h-3.5" />, label: t('admin.users.panel.lastLogin'), value: user.lastLogin ? new Date(user.lastLogin).toLocaleString(loc, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' } as Intl.DateTimeFormatOptions) : '—' },
                                ].map(row => (
                                    <div key={row.label} className="flex items-start gap-3">
                                        <span className="mt-0.5 flex-shrink-0" style={{ color: C.gray }}>{row.icon}</span>
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: C.gray }}>{row.label}</p>
                                            <p className="text-sm font-medium truncate" style={{ color: C.navy }}>{row.value}</p>
                                        </div>
                                    </div>
                                ))}
                                <div className="flex items-start gap-3">
                                    <span className="mt-0.5 flex-shrink-0" style={{ color: C.gray }}><Mail className="w-3.5 h-3.5" /></span>
                                    <div>
                                        <p className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: C.gray }}>{t('admin.users.panel.loginMethod')}</p>
                                        <div className="mt-0.5"><AuthBadge provider={user.authProvider} /></div>
                                    </div>
                                </div>
                            </div>

                            {/* Wallet detail */}
                            {user.userWallet && (
                                <div className="px-5 py-4 border-b" style={{ borderColor: C.border }}>
                                    <p className="text-[10px] font-semibold tracking-wider uppercase mb-3" style={{ color: C.gray }}>{t('admin.users.panel.walletSection')}</p>
                                    <div className="rounded-xl p-4 border" style={{ borderColor: C.border, background: C.bg }}>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs" style={{ color: C.gray }}>{t('admin.users.panel.available')}</span>
                                            <span className="text-sm font-bold" style={{ color: C.green }}>{user.userWallet.availableBalance.toLocaleString(loc)}₫</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs" style={{ color: C.gray }}>{t('admin.users.panel.pending')}</span>
                                            <span className="text-sm font-semibold" style={{ color: C.yellow }}>{user.userWallet.pendingBalance.toLocaleString(loc)}₫</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Recent requests */}
                            {user.role === 'PROVIDER' && user.assignedRequests && user.assignedRequests.length > 0 && (
                                <div className="px-5 py-4 border-b" style={{ borderColor: C.border }}>
                                    <p className="text-[10px] font-semibold tracking-wider uppercase mb-3" style={{ color: C.gray }}>{t('admin.users.panel.recentJobsProvider')}</p>
                                    <div className="space-y-2">
                                        {user.assignedRequests.map(r => {
                                            const st = requestStatusBadge(t, r.status);
                                            return (
                                                <div key={r.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl border" style={{ borderColor: C.border }}>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-semibold truncate" style={{ color: C.navy }}>
                                                            {incidentTypeLabel(t, r.incidentType)}
                                                            {r.orderCode && (
                                                                <span className="ml-1 font-mono font-normal" style={{ color: C.gray }}>
                                                                    #{displayOrderCode(r.orderCode, r.id)}
                                                                </span>
                                                            )}
                                                        </p>
                                                        <p className="text-[10px]" style={{ color: C.gray }}>
                                                            {new Date(r.createdAt).toLocaleDateString(loc)}
                                                            {r.payment && ` · ${r.payment.totalAmount.toLocaleString(loc)}₫`}
                                                        </p>
                                                    </div>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: st.bg, color: st.color }}>
                                                        {st.label}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {user.role === 'USER' && user.rescueRequests && user.rescueRequests.length > 0 && (
                                <div className="px-5 py-4 border-b" style={{ borderColor: C.border }}>
                                    <p className="text-[10px] font-semibold tracking-wider uppercase mb-3" style={{ color: C.gray }}>{t('admin.users.panel.recentRequestsUser')}</p>
                                    <div className="space-y-2">
                                        {user.rescueRequests.map(r => {
                                            const st = requestStatusBadge(t, r.status);
                                            return (
                                                <div key={r.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl border" style={{ borderColor: C.border }}>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-semibold truncate" style={{ color: C.navy }}>
                                                            {incidentTypeLabel(t, r.incidentType)}
                                                            {r.orderCode && (
                                                                <span className="ml-1 font-mono font-normal" style={{ color: C.gray }}>
                                                                    #{displayOrderCode(r.orderCode, r.id)}
                                                                </span>
                                                            )}
                                                        </p>
                                                        <p className="text-[10px]" style={{ color: C.gray }}>
                                                            {new Date(r.createdAt).toLocaleDateString(loc)}
                                                            {r.payment && ` · ${r.payment.totalAmount.toLocaleString(loc)}₫`}
                                                        </p>
                                                    </div>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: st.bg, color: st.color }}>
                                                        {st.label}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* ── Action Footer ── */}
                {user && !loading && (
                    <div className="px-5 py-4 border-t flex-shrink-0 space-y-2" style={{ borderColor: C.border }}>
                        <p className="text-[10px] font-semibold tracking-wider uppercase mb-3" style={{ color: C.gray }}>{t('admin.users.panel.actions')}</p>

                        {/* Row 1: Suspend/Activate + View Wallet */}
                        <div className="grid grid-cols-2 gap-2">
                            {isBanned ? (
                                <button
                                    onClick={handleUnban}
                                    disabled={!!actionLoading}
                                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                                    style={{ background: C.greenLight, color: C.green }}
                                >
                                    {actionLoading === 'unban' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                                    {t('admin.users.panel.unban')}
                                </button>
                            ) : (
                                <button
                                    onClick={handleBanOpen}
                                    disabled={!!actionLoading}
                                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                                    style={{ background: C.yellowLight, color: C.yellow }}
                                >
                                    <ShieldOff className="w-4 h-4" />
                                    {t('admin.users.panel.ban')}
                                </button>
                            )}
                            <button
                                onClick={handleViewWallet}
                                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                                style={{ background: C.blueLight, color: C.blue }}
                            >
                                <ExternalLink className="w-4 h-4" />
                                {t('admin.users.panel.viewWallet')}
                            </button>
                        </div>

                        {/* Row 2: Delete (full width, danger) */}
                        <button
                            onClick={handleDelete}
                            disabled={!!actionLoading}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                            style={{ background: C.redLight, color: C.red }}
                        >
                            {actionLoading === 'delete' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            {t('admin.users.panel.deleteAccount')}
                        </button>
                    </div>
                )}
            </div>

            {/* ── Ban Reason Modal (fixed overlay, outside panel) ── */}
            {showBanModal && (
                <div className="fixed inset-0 z-[60] flex items-end justify-end">
                    <div className="absolute inset-0" onClick={() => setShowBanModal(false)} />
                    <div className="relative bg-white w-full max-w-md rounded-t-2xl p-5 shadow-2xl m-0 mr-0" style={{ right: 0 }}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-base" style={{ color: C.navy }}>{t('admin.users.panel.banModalTitle')}</h3>
                            <button onClick={() => setShowBanModal(false)} className="p-1 rounded-lg hover:bg-gray-100" style={{ color: C.gray }}>
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.gray }}>
                            {t('admin.users.panel.banReasonLabel')} <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={banReasonInput}
                            onChange={e => setBanReasonInput(e.target.value)}
                            rows={3}
                            placeholder={t('admin.users.panel.banReasonPlaceholder')}
                            className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none resize-none"
                            style={{ borderColor: C.border, color: C.navy, fontFamily: 'Lexend, sans-serif' }}
                            autoFocus
                        />
                        <p className="text-[10px] mt-1.5 mb-4" style={{ color: C.gray }}>
                            {t('admin.users.panel.banReasonHint')}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowBanModal(false); setBanReasonInput(''); }}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 hover:bg-gray-200 transition-colors"
                                style={{ color: C.navy }}
                            >
                                {t('admin.users.panel.cancel')}
                            </button>
                            <button
                                onClick={handleBanConfirm}
                                disabled={!banReasonInput.trim() || actionLoading === 'ban'}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50"
                                style={{ background: C.red }}
                            >
                                {actionLoading === 'ban' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />}
                                {t('admin.users.panel.confirmBan')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* ── Unban Confirm Modal ── */}
            {showUnbanModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setShowUnbanModal(false)} />
                    <div className="relative bg-white w-full max-w-md rounded-2xl p-5 shadow-2xl" style={{ border: `1px solid ${C.border}` }}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-base" style={{ color: C.navy }}>{t('admin.users.panel.unbanModalTitle')}</h3>
                            <button onClick={() => setShowUnbanModal(false)} className="p-1 rounded-lg hover:bg-gray-100" style={{ color: C.gray }}>
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-sm" style={{ color: C.gray }}>
                            {t('admin.users.panel.unbanConfirmBody', { name: user?.fullName || user?.email || '' })}
                        </p>
                        {error && (
                            <div className="mt-3 p-3 rounded-xl text-sm" style={{ background: C.redLight, color: C.red }}>
                                {error}
                            </div>
                        )}
                        <div className="flex gap-3 mt-5">
                            <button
                                onClick={() => { setShowUnbanModal(false); setError(''); }}
                                disabled={actionLoading === 'unban'}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 hover:bg-gray-200 transition-colors"
                                style={{ color: C.navy }}
                            >
                                {t('admin.users.panel.cancel')}
                            </button>
                            <button
                                onClick={handleUnbanConfirm}
                                disabled={actionLoading === 'unban'}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50"
                                style={{ background: C.greenLight, color: C.green }}
                            >
                                {actionLoading === 'unban' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                                {t('admin.users.panel.confirmUnban')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete Confirm Modal ── */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setShowDeleteModal(false)} />
                    <div className="relative bg-white w-full max-w-md rounded-2xl p-5 shadow-2xl" style={{ border: `1px solid ${C.border}` }}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-base" style={{ color: C.navy }}>{t('admin.users.panel.deleteModalTitle')}</h3>
                            <button onClick={() => setShowDeleteModal(false)} className="p-1 rounded-lg hover:bg-gray-100" style={{ color: C.gray }}>
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-sm" style={{ color: C.gray }}>
                            {t('admin.users.panel.deleteConfirmBody', { name: user?.fullName || user?.email || '' })}
                            <span className="block mt-1" style={{ color: C.red, fontWeight: 600 }}>
                                {t('admin.users.panel.deleteIrreversible')}
                            </span>
                        </p>
                        {error && (
                            <div className="mt-3 p-3 rounded-xl text-sm" style={{ background: C.redLight, color: C.red }}>
                                {error}
                            </div>
                        )}
                        <div className="flex gap-3 mt-5">
                            <button
                                onClick={() => { setShowDeleteModal(false); setError(''); }}
                                disabled={actionLoading === 'delete'}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 hover:bg-gray-200 transition-colors"
                                style={{ color: C.navy }}
                            >
                                {t('admin.users.panel.cancel')}
                            </button>
                            <button
                                onClick={handleDeleteConfirm}
                                disabled={actionLoading === 'delete'}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50"
                                style={{ background: C.red, color: '#fff' }}
                            >
                                {actionLoading === 'delete' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                {t('admin.users.panel.confirmDelete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function AdminUsersPage() {
    const { isReady } = useAdminGuard();
    const { t, locale } = useLanguage();
    const loc = localeTag(locale);

    const tabGroups = useMemo(
        () =>
            [
                {
                    groupLabel: t('admin.users.groupProfile'),
                    tabs: [
                        { key: 'ALL' as const, label: t('admin.users.tabAll') },
                        { key: 'ACTIVE' as const, label: t('admin.users.tabProfileComplete') },
                        { key: 'INACTIVE' as const, label: t('admin.users.tabProfileIncomplete') },
                    ],
                },
                {
                    groupLabel: t('admin.users.groupRole'),
                    tabs: [
                        { key: 'ROLE_USER' as const, label: t('admin.users.tabRoleUser') },
                        { key: 'ROLE_PROVIDER' as const, label: t('admin.users.tabRoleProvider') },
                        { key: 'ROLE_ADMIN' as const, label: t('admin.users.tabRoleAdmin') },
                    ],
                },
                {
                    groupLabel: t('admin.users.groupAccount'),
                    tabs: [
                        { key: 'ACCOUNT_ACTIVE' as const, label: t('admin.users.tabAccountActive') },
                        { key: 'ACCOUNT_BANNED' as const, label: t('admin.users.tabAccountBanned') },
                    ],
                },
            ] as { groupLabel: string; tabs: { key: TabType; label: string }[] }[],
        [t],
    );

    const [tab, setTab] = useState<TabType>('ALL');
    const [items, setItems] = useState<UserItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, newThisMonth: 0 });

    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('NEWEST');
    const [dateFilter, setDateFilter] = useState('');
    const [page, setPage] = useState(1);

    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    // Chart data
    const [chartTopUsersReqs, setChartTopUsersReqs] = useState<{ rank: number; label: string; sublabel?: string; value: number }[]>([]);
    const [chartTopUsersSpend, setChartTopUsersSpend] = useState<{ rank: number; label: string; sublabel?: string; value: number; displayValue: string }[]>([]);
    const [chartsLoading, setChartsLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [res, statsData] = await Promise.all([
                adminApi.getUsers({ skip: 0, take: 1000 }),
                adminApi.getUserStats(),
            ]);
            setItems((res.items as UserItem[]) ?? []);
            setStats(statsData);
            setPage(1);
        } catch {
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isReady) {
            load();
            adminApi.getTopUsersByRequests().then(setChartTopUsersReqs).catch(() => {});
            adminApi.getTopUsersBySpending().then(setChartTopUsersSpend).catch(() => {}).finally(() => setChartsLoading(false));
        }
    }, [isReady, load]);

    const filtered = items.filter(u => {
        // Tab filter
        if (tab === 'ACTIVE' && !u.profileCompleted) return false;
        if (tab === 'INACTIVE' && u.profileCompleted) return false;
        if (tab === 'ROLE_USER' && u.role !== 'USER') return false;
        if (tab === 'ROLE_PROVIDER' && u.role !== 'PROVIDER') return false;
        if (tab === 'ROLE_ADMIN' && u.role !== 'ADMIN') return false;
        if (tab === 'ACCOUNT_ACTIVE' && !!u.bannedAt) return false;
        if (tab === 'ACCOUNT_BANNED' && !u.bannedAt) return false;
        // Date filter
        if (dateFilter) {
            const d = new Date(u.createdAt);
            const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (s !== dateFilter) return false;
        }
        // Search
        const q = search.toLowerCase();
        if (!q) return true;
        return u.fullName?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.phoneNumber?.includes(q) ?? false);
    });

    const sorted = [...filtered].sort((a, b) => {
        if (sortBy === 'NEWEST') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (sortBy === 'OLDEST') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (sortBy === 'BALANCE_DESC') return (b.userWallet?.availableBalance ?? 0) - (a.userWallet?.availableBalance ?? 0);
        if (sortBy === 'REQUESTS_DESC') return b._count.rescueRequests - a._count.rescueRequests;
        return 0;
    });

    const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const statCards = useMemo(() => {
        const vr = stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0;
        const gp = stats.total > 0 ? Math.round((stats.newThisMonth / stats.total) * 100) : 0;
        return [
            { label: t('admin.users.statTotal'), value: stats.total, sub: null as string | null, color: C.navy, icon: <Users className="w-4 h-4" /> },
            {
                label: t('admin.users.statCompleted'),
                value: stats.active,
                sub: t('admin.users.statCompletedSub', { rate: vr }),
                color: C.green,
                icon: <CheckCircle className="w-4 h-4" />,
            },
            {
                label: t('admin.users.statProfileIncomplete'),
                value: stats.inactive,
                sub: t('admin.users.statProfileIncompleteSub', { rate: 100 - vr }),
                color: C.yellow,
                icon: <AlertTriangle className="w-4 h-4" />,
            },
            {
                label: t('admin.users.statNewMonth'),
                value: stats.newThisMonth,
                sub: t('admin.users.statMonthGrowth', { rate: gp }),
                color: C.blue,
                icon: <Clock className="w-4 h-4" />,
            },
        ];
    }, [stats, t]);

    const tableHeaders = useMemo(
        () => [
            t('admin.users.colUser'),
            t('admin.users.colPhone'),
            t('admin.users.colAuth'),
            t('admin.users.colWallet'),
            tab === 'ROLE_PROVIDER' ? t('admin.users.colJobsDone') : t('admin.users.colRequests'),
            t('admin.users.colJoined'),
            t('admin.users.colProfile'),
            t('admin.users.colAccount'),
            '',
        ],
        [t, tab],
    );

    return (
        <AdminLayout activeTab="/admin/users">
            <div className="p-6 min-h-screen" style={{ background: C.bg }}>

                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold mb-1" style={{ color: C.navy }}>{t('admin.users.listTitle')}</h1>
                    <p className="text-sm" style={{ color: C.gray }}>{t('admin.users.listSubtitle')}</p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {statCards.map(stat => (
                        <div key={stat.label} className="bg-white rounded-2xl border p-4" style={{ borderColor: C.border }}>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: C.gray }}>{stat.label}</p>
                                <span style={{ color: stat.color, opacity: 0.6 }}>{stat.icon}</span>
                            </div>
                            <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                            {stat.sub && <p className="text-[10px] mt-1 font-medium" style={{ color: C.gray }}>{stat.sub}</p>}
                        </div>
                    ))}
                </div>

                {/* ─── Chart Row ─── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                    <ChartCard
                        title={t('admin.users.chartTopByRequests')}
                        icon={<BarChart2 className="w-3.5 h-3.5" />}
                        iconBg="#eff6ff" iconColor="#2563eb"
                    >
                        <HorizontalBarChart
                            loading={chartsLoading}
                            items={chartTopUsersReqs}
                            color="#2563eb"
                            suffix={t('admin.users.chartBarSuffix')}
                        />
                    </ChartCard>
                    <ChartCard
                        title={t('admin.users.chartTopBySpend')}
                        icon={<BarChart2 className="w-3.5 h-3.5" />}
                        iconBg="#f0fdf4" iconColor="#16a34a"
                    >
                        <HorizontalBarChart
                            loading={chartsLoading}
                            items={chartTopUsersSpend}
                            color="#16a34a"
                        />
                    </ChartCard>
                </div>

                {/* Main Card */}
                <div className="bg-white rounded-2xl border mb-5" style={{ borderColor: C.border }}>

                    {/* Tabs — grouped with separators */}
                    <div className="flex items-center px-5 border-b overflow-x-auto" style={{ borderColor: C.border }}>
                        {tabGroups.map((group, gi) => (
                            <React.Fragment key={group.groupLabel}>
                                {gi > 0 && (
                                    <div className="mx-2 h-4 w-px flex-shrink-0" style={{ background: C.border }} />
                                )}
                                {group.tabs.map(tabItem => (
                                    <button
                                        key={tabItem.key}
                                        type="button"
                                        onClick={() => { setTab(tabItem.key); setPage(1); }}
                                        className="px-3.5 py-4 text-sm font-medium relative transition-colors whitespace-nowrap"
                                        style={{
                                            color: tab === tabItem.key ? C.orange : C.gray,
                                            borderBottom: tab === tabItem.key ? `2px solid ${C.orange}` : '2px solid transparent',
                                            marginBottom: '-1px',
                                        }}
                                    >
                                        {tabItem.label}
                                    </button>
                                ))}
                            </React.Fragment>
                        ))}
                    </div>

                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-3 p-4 border-b" style={{ borderColor: C.border }}>
                        <div className="flex-1 min-w-[200px] relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.gray }} />
                            <input
                                type="text"
                                value={search}
                                onChange={e => { setSearch(e.target.value); setPage(1); }}
                                placeholder={t('admin.users.searchPlaceholder')}
                                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border focus:outline-none"
                                style={{ borderColor: C.border, color: C.navy, fontFamily: 'Lexend, sans-serif' }}
                            />
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm" style={{ borderColor: C.border }}>
                            <Filter className="w-3.5 h-3.5" style={{ color: C.gray }} />
                            <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1); }} className="bg-transparent text-sm focus:outline-none cursor-pointer" style={{ color: C.navy, fontFamily: 'Lexend, sans-serif' }}>
                                <option value="NEWEST">{t('admin.users.sortNewest')}</option>
                                <option value="OLDEST">{t('admin.users.sortOldest')}</option>
                                <option value="BALANCE_DESC">{t('admin.users.sortBalanceDesc')}</option>
                                <option value="REQUESTS_DESC">{t('admin.users.sortRequestsDesc')}</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm relative" style={{ borderColor: C.border }}>
                            <Calendar className="w-3.5 h-3.5" style={{ color: C.gray }} />
                            <input
                                type="date"
                                value={dateFilter}
                                onClick={e => { try { (e.target as HTMLInputElement).showPicker(); } catch {} }}
                                onChange={e => { setDateFilter(e.target.value); setPage(1); }}
                                className="bg-transparent text-sm focus:outline-none cursor-pointer"
                                style={{ color: dateFilter ? C.navy : C.gray, fontFamily: 'Lexend, sans-serif' }}
                            />
                            {dateFilter && (
                                <button onClick={() => { setDateFilter(''); setPage(1); }} className="absolute -right-1.5 -top-1.5 bg-gray-200 hover:bg-gray-300 rounded-full p-0.5">
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Table */}
                    {loading ? (
                        <div className="p-12 text-center">
                            <div className="w-8 h-8 rounded-full border-[3px] animate-spin mx-auto" style={{ borderColor: C.orange, borderTopColor: 'transparent' }} />
                        </div>
                    ) : paginated.length === 0 ? (
                        <div className="p-12 text-center flex flex-col items-center gap-2">
                            <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke={C.border} strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span style={{ color: C.gray }}>{t('admin.users.emptyList')}</span>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead style={{ background: C.bg }}>
                                    <tr>
                                        {tableHeaders.map((h, hi) => (
                                            <th key={`${h}-${hi}`} className="text-left text-[10px] font-semibold tracking-wider px-4 py-3" style={{ color: C.gray }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginated.map(user => (
                                        <tr
                                            key={user.id}
                                            className="border-t hover:bg-slate-50/80 transition-colors"
                                            style={{ borderColor: C.border }}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <AvatarImage name={user.fullName || user.email} avatar={user.avatar} className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" fallbackBackground={C.blue} initialsCount={1} />
                                                    <div>
                                                        <p className="text-sm font-semibold" style={{ color: C.navy }}>{user.fullName || <span style={{ color: C.gray }}>{t('admin.users.nameNotSet')}</span>}</p>
                                                        <p className="text-xs" style={{ color: C.gray }}>{user.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-xs font-mono" style={{ color: C.navy }}>{user.phoneNumber || <span style={{ color: C.gray }}>—</span>}</td>
                                            <td className="px-4 py-3"><AuthBadge provider={user.authProvider} /></td>
                                            <td className="px-4 py-3 text-sm font-semibold" style={{ color: C.navy }}>
                                                {user.userWallet
                                                    ? `${user.userWallet.availableBalance.toLocaleString(loc)}₫`
                                                    : user.providerWallet
                                                        ? `${user.providerWallet.availableBalance.toLocaleString(loc)}₫`
                                                        : <span className="text-xs" style={{ color: C.gray }}>—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-semibold" style={{ color: C.navy }}>
                                                {user.role === 'PROVIDER' ? (user._count.assignedRequests || 0) : user._count.rescueRequests}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-xs font-medium" style={{ color: C.navy }}>{new Date(user.createdAt).toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                                    {user.lastLogin && (
                                                        <span className="text-[10px]" style={{ color: C.gray }}>
                                                            {t('admin.users.loginShort', {
                                                                date: new Date(user.lastLogin).toLocaleDateString(loc, { day: '2-digit', month: '2-digit' }),
                                                            })}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            {/* Dual status columns */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <RoleBadge role={user.role} />
                                                    <ProfileBadge completed={user.profileCompleted} />
                                                </div>
                                            </td>
                                            <td className="px-4 py-3"><AccountBadge banned={!!user.bannedAt} /></td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => setSelectedUserId(user.id)}
                                                    className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                                                    style={{ color: C.blue }}
                                                    title={t('admin.users.viewDetails')}
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {!loading && sorted.length > 0 && (
                        <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: C.border }}>
                            <p className="text-xs" style={{ color: C.gray }}>
                                {t('admin.users.paginationLine', {
                                    from: (page - 1) * PAGE_SIZE + 1,
                                    to: Math.min(page * PAGE_SIZE, sorted.length),
                                    total: sorted.length,
                                })}
                            </p>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed" style={{ color: C.gray }}>
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let start = Math.max(1, page - 2);
                                    const end = Math.min(totalPages, start + 4);
                                    if (end - start < 4) start = Math.max(1, end - 4);
                                    return start + i;
                                }).filter(p => p <= totalPages).map(p => (
                                    <button key={p} onClick={() => setPage(p)} className="w-7 h-7 rounded-lg text-xs font-semibold" style={{ background: page === p ? C.orange : 'transparent', color: page === p ? '#fff' : C.gray }}>
                                        {p}
                                    </button>
                                ))}
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed" style={{ color: C.gray }}>
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Slide-Over Panel */}
            {selectedUserId && (
                <UserDetailPanel
                    userId={selectedUserId}
                    onClose={() => setSelectedUserId(null)}
                    onUpdated={load}
                    onDeleted={() => { setSelectedUserId(null); load(); }}
                />
            )}
        </AdminLayout>
    );
}
