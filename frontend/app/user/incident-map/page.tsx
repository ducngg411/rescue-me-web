'use client';

import { useUserGuard } from '@/lib/guards';
import dynamic from 'next/dynamic';
import { useRouter, usePathname } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import RescueMeLogo from '@/components/RescueMeLogo';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import AvatarImage from '@/components/AvatarImage';
import { useUserDisputeNavBadge } from '@/contexts/UserDisputeNavBadgeContext';
import { IncidentMapDynamicFallback } from '@/components/IncidentMapDynamicFallback';

const IncidentMap = dynamic(() => import('@/components/IncidentMap'), {
    ssr: false,
    loading: () => <IncidentMapDynamicFallback />,
});

const C = {
    orange: '#f97316',
    orangeLight: '#fff7ed',
    border: '#f1f5f9',
    navy: '#1a1a2e',
    gray: '#6b7280',
    bg: '#f8fafc',
};

export default function UserIncidentMapPage() {
    const { isReady, user } = useUserGuard();
    const router = useRouter();
    const pathname = usePathname();
    const { t } = useLanguage();
    const { logout } = useAuth();
    const { disputeNavBadge, resetDisputeNavBadge } = useUserDisputeNavBadge();

    const displayName = user?.name || user?.email?.split('@')[0] || t('common.appName');

    const navItems = [
        {
            label: t('user.nav.home'), href: '/user',
            icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
        },
        {
            label: t('user.nav.history'), href: '/user/requests',
            icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        },
        {
            label: t('user.nav.wallet'), href: '/user/wallet',
            icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
        },
        {
            label: t('user.nav.disputes'), href: '/user/disputes',
            icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
        },
        {
            label: t('user.nav.map'), href: '/user/incident-map',
            icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.242-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
        },
        {
            label: t('user.nav.settings'), href: '/user/settings',
            icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
        },
    ];

    function isActive(href: string) {
        return pathname === href || pathname.startsWith(href + '/');
    }

    const nav = (href: string) => {
        if (href === '/user/disputes') resetDisputeNavBadge();
        router.push(href);
    };

    if (!isReady) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: '#f4f6f9' }}>
                <div className="w-10 h-10 rounded-full border-[3px] animate-spin"
                    style={{ borderColor: '#f97316', borderTopColor: 'transparent' }} />
            </div>
        );
    }

    return (
        <div className="h-screen overflow-hidden flex" style={{ fontFamily: 'Lexend, sans-serif', background: C.bg }}>

            {/* ═══ DESKTOP Sidebar ═══ */}
            <aside
                className="hidden md:flex flex-col py-6 px-4 flex-shrink-0 sticky top-0 h-screen"
                style={{ width: '220px', background: '#ffffff', borderRight: `1px solid ${C.border}` }}
            >
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-8 px-2">
                        <RescueMeLogo size={28} textClass="text-base" />
                    </div>
                    <nav className="space-y-1">
                        {navItems.map(item => {
                            const active = isActive(item.href);
                            return (
                                <button
                                    key={item.label}
                                    type="button"
                                    onClick={() => nav(item.href)}
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
                <div className="px-2 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
                    <button
                        type="button"
                        onClick={logout}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold transition-all hover:bg-red-50"
                        style={{ color: '#ef4444' }}
                    >
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        {t('common.logout')}
                    </button>
                </div>
            </aside>

            {/* ═══ Main Content ═══ */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ paddingBottom: '64px' }}>
                <header
                    className="flex items-center justify-between px-4 py-3 flex-shrink-0 sticky top-0 z-20"
                    style={{ background: '#ffffff', borderBottom: `1px solid ${C.border}` }}
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            type="button"
                            onClick={() => router.push('/user')}
                            className="flex md:hidden items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-50 transition-colors flex-shrink-0"
                            style={{ color: C.navy }}
                            aria-label={t('common.back')}
                        >
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="flex md:hidden items-center gap-2 flex-shrink-0">
                            <RescueMeLogo size={24} textClass="hidden" />
                        </div>
                        <div className="flex-1 min-w-0 md:hidden">
                            <h1 className="font-bold text-base leading-tight" style={{ color: C.navy }}>{t('user.nav.map')}</h1>
                            <p className="text-[10px] leading-tight mt-0.5 truncate" style={{ color: C.gray }}>{t('user.incidentMap.headerSubtitle')}</p>
                        </div>
                        <h2 className="hidden md:block text-base font-semibold truncate" style={{ color: C.navy }}>{t('user.nav.map')}</h2>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
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

                <div className="flex-1 min-h-0 flex flex-col">
                    <IncidentMap
                        apiEndpoint="/rescue-requests/incident-map"
                        className="flex-1 min-h-0 w-full"
                        compactToolbar
                    />
                </div>
            </div>

            {/* ═══ MOBILE Bottom Navigation ═══ */}
            <nav
                className="fixed bottom-0 left-0 right-0 md:hidden z-30 flex items-stretch shadow-[0_-2px_10px_rgba(0,0,0,0.05)]"
                style={{ background: '#ffffff', borderTop: `1px solid ${C.border}`, height: '60px' }}
            >
                {navItems.map(item => {
                    const active = isActive(item.href);
                    return (
                        <button
                            key={item.label}
                            type="button"
                            onClick={() => nav(item.href)}
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
        </div>
    );
}
