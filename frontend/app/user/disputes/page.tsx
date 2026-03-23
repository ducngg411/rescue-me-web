'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUserGuard } from '@/lib/guards';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import RescueMeLogo from '@/components/RescueMeLogo';
import AvatarImage from '@/components/AvatarImage';
import { userDisputeApi } from '@/lib/api';
import api from '@/lib/api';

const C = {
    orange: '#f97316',
    orangeDark: '#ea6c0a',
    orangeLight: '#fff7ed',
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#f1f5f9',
    bg: '#f8fafc',
    blue: '#2563eb',
    blueLight: '#eff6ff',
    yellow: '#ca8a04',
    yellowLight: '#fefce8',
    green: '#16a34a',
    greenLight: '#f0fdf4',
    red: '#ef4444',
    redLight: '#fef2f2',
    purple: '#7c3aed',
    purpleLight: '#faf5ff',
};

interface DisputeItem {
    id: string;
    status: string;
    createdAt: string;
    slaDueAt: string | null;
    userReason?: string;
    payment: {
        requestId: string;
        totalAmount: number;
        paymentMethod: string;
    };
    request?: {
        id: string;
        incidentType: string;
        status: string;
    };
}

function statusStyle(status: string): { bg: string; color: string } {
    switch (status) {
        case 'WAITING_FOR_PROVIDER': return { bg: '#eff6ff', color: '#2563eb' };
        case 'WAITING_FOR_CUSTOMER': return { bg: '#fefce8', color: '#ca8a04' };
        case 'INVESTIGATING':        return { bg: '#faf5ff', color: '#7c3aed' };
        case 'RESOLVED':             return { bg: C.greenLight, color: C.green };
        case 'REJECTED':             return { bg: C.redLight, color: C.red };
        default: return { bg: '#f8fafc', color: C.gray };
    }
}


export default function UserDisputesPage() {
    const router = useRouter();
    const { isReady, user } = useUserGuard();
    const { logout } = useAuth();
    const { t, locale } = useLanguage();
    const [disputes, setDisputes] = useState<DisputeItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const displayName = user?.name || user?.email?.split('@')[0] || '';

    const load = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            // Try the dedicated endpoint first; fall back to fetching requests
            const res = await userDisputeApi.getMyDisputes();
            setDisputes((res.items as DisputeItem[]) ?? []);
        } catch {
            // Fallback: filter rescue-requests that have payment.disputedAt
            try {
                const res2 = await api.get('/rescue-requests');
                const requests: any[] = res2.data ?? [];
                const withDisputes = requests
                    .filter((r: any) => r.payment?.disputedAt)
                    .map((r: any) => ({
                        id: r.payment.disputeId ?? r.id,
                        status: r.payment.disputeStatus ?? 'IN_REVIEW',
                        createdAt: r.payment.disputedAt ?? r.createdAt,
                        slaDueAt: null,
                        userReason: r.payment.disputeReason ?? '',
                        payment: {
                            requestId: r.id,
                            totalAmount: r.payment.totalAmount ?? 0,
                            paymentMethod: r.payment.paymentMethod ?? 'CASH',
                        },
                        request: {
                            id: r.id,
                            incidentType: r.incidentType,
                            status: r.status,
                        },
                    }));
                setDisputes(withDisputes);
            } catch {
                setError(true);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isReady) load();
    }, [isReady, load]);

    const navItems = [
        { label: t('user.nav.home'), href: '/user', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
        { label: t('user.nav.history'), href: '/user/requests', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
        { label: t('user.nav.wallet'), href: '/user/wallet', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg> },
        { label: t('user.nav.disputes'), href: '/user/disputes', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> },
        { label: t('user.nav.settings'), href: '/user/settings', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
    ];

    const statusLabel = (status: string) => {
        const map: Record<string, string> = {
            WAITING_FOR_PROVIDER:  t('user.disputes.status.WAITING_FOR_PROVIDER'),
            WAITING_FOR_CUSTOMER:  t('user.disputes.status.WAITING_FOR_CUSTOMER'),
            INVESTIGATING:         t('user.disputes.status.INVESTIGATING'),
            RESOLVED:              t('user.disputes.status.RESOLVED'),
            REJECTED:              t('user.disputes.status.REJECTED'),
        };
        return map[status] ?? status;
    };


    if (!isReady) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: C.orange }} />
            </div>
        );
    }

    return (
        <div className="h-screen overflow-hidden flex" style={{ fontFamily: 'Lexend, sans-serif', background: C.bg }}>

            {/* Desktop Sidebar */}
            <aside
                className="hidden md:flex flex-col justify-between py-6 px-4 flex-shrink-0"
                style={{ width: '220px', background: '#ffffff', borderRight: `1px solid ${C.border}` }}
            >
                <div>
                    <div className="flex items-center gap-2 mb-8 px-2">
                        <RescueMeLogo size={28} textClass="text-base" />
                    </div>
                    <nav className="space-y-1">
                        {navItems.map(item => {
                            const active = item.href === '/user/disputes';
                            return (
                                <button
                                    key={item.href}
                                    onClick={() => router.push(item.href)}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                                    style={{ background: active ? C.orangeLight : 'transparent', color: active ? C.orange : '#64748b' }}
                                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = C.bg; }}
                                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                >
                                    {item.icon}{item.label}
                                </button>
                            );
                        })}
                    </nav>
                </div>
                <div className="flex items-center gap-3 px-2 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
                    <AvatarImage name={displayName} avatar={user?.avatar} className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" fallbackBackground={C.orange} initialsCount={1} />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate" style={{ color: C.navy }}>{displayName}</p>
                        <p className="text-xs" style={{ color: C.gray }}>{t('user.dashboard.customer')}</p>
                    </div>
                    <button onClick={logout} title="Đăng xuất" className="flex-shrink-0 p-1.5 rounded-lg transition-colors hover:bg-red-50" style={{ color: '#ef4444' }}>
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    </button>
                </div>
            </aside>

            {/* Main Area */}
            <div className="flex-1 flex flex-col min-w-0" style={{ paddingBottom: '64px' }}>
                {/* Top Bar */}
                <header
                    className="flex items-center justify-between px-4 py-3 flex-shrink-0 sticky top-0 z-20"
                    style={{ background: '#ffffff', borderBottom: `1px solid ${C.border}` }}
                >
                    {/* Mobile: back arrow + RescueMe | Desktop: page title */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/user')}
                            className="flex md:hidden items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-50 transition-colors"
                            style={{ color: C.navy }}
                        >
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="flex md:hidden items-center gap-2">
                            <RescueMeLogo size={24} textClass="hidden" />
                        </div>
                        <div className="flex-1 min-w-0 md:hidden">
                            <h1 className="font-bold text-base leading-tight" style={{ color: C.navy }}>{t('user.disputes.title')}</h1>
                            <p className="text-[10px] leading-tight mt-0.5 truncate" style={{ color: C.gray }}>{t('user.disputes.subtitle')}</p>
                        </div>
                        <h2 className="hidden md:block text-base font-semibold" style={{ color: C.navy }}>{t('user.disputes.title')}</h2>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
                            <span className="text-xs font-medium" style={{ color: '#64748b' }}>{t('common.systemOperational')}</span>
                        </div>
                        <LanguageSwitcher />
                        <AvatarImage
                            name={displayName}
                            avatar={user?.avatar}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            fallbackBackground={C.orange}
                            initialsCount={1}
                        />
                    </div>
                </header>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
                        {/* Dispute Form Info Card */}
                        <div
                            className="rounded-2xl border p-4"
                            style={{ background: C.orangeLight, borderColor: '#fed7aa' }}
                        >
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.orange }}>
                                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold" style={{ color: C.navy }}>{t('user.tracking.dispute.title')}</p>
                                    <p className="text-xs mt-0.5" style={{ color: C.gray }}>{t('user.tracking.dispute.desc')}</p>
                                    <p className="text-xs mt-2 font-medium" style={{ color: C.orange }}>
                                        {t('user.disputes.emptySub')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* List */}
                        <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: C.border }}>
                            {loading ? (
                                <div className="p-8 flex flex-col gap-3">
                                    {[0, 1, 2].map(i => (
                                        <div key={i} className="rounded-xl animate-pulse p-4" style={{ background: C.bg }}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg" style={{ background: '#e2e8f0' }} />
                                                <div className="flex-1 space-y-2">
                                                    <div className="h-3 rounded" style={{ background: '#e2e8f0', width: '60%' }} />
                                                    <div className="h-2.5 rounded" style={{ background: '#e2e8f0', width: '40%' }} />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : error ? (
                                <div className="p-10 text-center" style={{ color: C.gray }}>
                                    <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} className="mx-auto mb-3 opacity-40"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    <p className="text-sm font-medium">{t('user.disputes.loadError')}</p>
                                </div>
                            ) : disputes.length === 0 ? (
                                <div className="p-10 flex flex-col items-center text-center gap-3">
                                    <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: C.purpleLight }}>
                                        <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke={C.purple} strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-base" style={{ color: C.navy }}>{t('user.disputes.empty')}</p>
                                        <p className="text-sm mt-1" style={{ color: C.gray }}>{t('user.disputes.emptySub')}</p>
                                    </div>
                                    <button
                                        onClick={() => router.push('/user/requests')}
                                        className="mt-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
                                        style={{ background: C.orange, color: 'white' }}
                                    >
                                        {t('user.requests.title')}
                                    </button>
                                </div>
                            ) : (
                                <ul className="divide-y" style={{ borderColor: C.border }}>
                                    {disputes.map((d) => {
                                        const st = statusStyle(d.status);
                                        const date = new Date(d.createdAt);
                                        const dateStr = date.toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                        const requestId = d.payment?.requestId ?? d.request?.id ?? d.id;
                                        return (
                                            <li
                                                key={d.id}
                                                className="flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                                                onClick={() => router.push(`/user/disputes/${d.id}`)}
                                            >
                                                {/* Icon */}
                                                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: C.purpleLight }}>
                                                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={C.purple} strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                    </svg>
                                                </div>
                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-xs font-mono font-bold" style={{ color: C.navy }}>
                                                            #{requestId.slice(0, 8).toUpperCase()}
                                                        </span>
                                                        <span
                                                            className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold"
                                                            style={{ background: st.bg, color: st.color }}
                                                        >
                                                            {statusLabel(d.status)}
                                                        </span>
                                                    </div>
                                                    {d.userReason && (
                                                        <p className="text-sm mt-1 line-clamp-2" style={{ color: C.gray }}>
                                                            {d.userReason}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                                        <span className="text-xs" style={{ color: C.gray }}>
                                                            {t('user.disputes.filedAt')}: {dateStr}
                                                        </span>
                                                        {d.payment?.totalAmount > 0 && (
                                                            <span className="text-xs font-semibold" style={{ color: C.navy }}>
                                                                {d.payment.totalAmount.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')}₫
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                {/* Chevron */}
                                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={C.gray} strokeWidth={2} className="flex-shrink-0 mt-1">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                                </svg>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Bottom Nav */}
            <nav
                className="fixed bottom-0 left-0 right-0 md:hidden z-30 flex items-stretch shadow-[0_-2px_10px_rgba(0,0,0,0.05)]"
                style={{ background: '#ffffff', borderTop: `1px solid ${C.border}`, height: '60px' }}
            >
                {navItems.map(item => {
                    const active = item.href === '/user/disputes';
                    return (
                        <button
                            key={item.href}
                            onClick={() => router.push(item.href)}
                            className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
                            style={{ color: active ? C.orange : '#94a3b8' }}
                        >
                            <span style={{ color: active ? C.orange : '#94a3b8' }}>{item.icon}</span>
                            <span className="text-[9px] font-medium">{item.label}</span>
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}
