'use client';

import React, { ReactNode, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useProviderStatus } from '@/lib/hooks/useProviderStatus';

const C = {
    orange: '#f97316',
    orangeDark: '#ea6c0a',
    orangeLight: '#fff7ed',
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#e2e8f0',
    bg: '#f4f6f9',
    red: '#ef4444',
};

interface ProviderLayoutProps {
    children: ReactNode;
    // activeTab affects which nav item is highlighted. E.g. '/provider/active', '/provider/wallet', '/provider/settings'
    activeTab?: string;
}

export default function ProviderLayout({ children, activeTab }: ProviderLayoutProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { t } = useLanguage();
    const { user, setUser, logout } = useAuth();
    const { isOnline, isLoading: statusLoading, toggleOnlineStatus, setIsOnline } = useProviderStatus();

    useEffect(() => {
        if (user?.isOnline !== undefined) setIsOnline(user.isOnline);
    }, [user?.isOnline]);

    const handleToggle = async () => {
        if (statusLoading) return;
        const newStatus = !isOnline;
        const result = await toggleOnlineStatus(newStatus);
        if (result?.success && user) {
            setUser({ ...user, isOnline: newStatus });
        }
    };

    const displayName = user?.name?.split(' ').slice(-1)[0] || user?.email?.split('@')[0] || 'Provider';

    const currentActiveTab = activeTab || pathname;

    const navItems = [
        {
            label: t('provider.nav.dashboard'), href: '/provider/active',
            icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
        },
        {
            label: t('provider.nav.history'), href: '/provider/history',
            icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        },
        {
            label: t('provider.nav.wallet'), href: '/provider/wallet',
            icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
        },
        {
            label: t('provider.nav.settings'), href: '/provider/settings',
            icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
        },
    ];

    function isActive(item: any) {
        return currentActiveTab === item.href || currentActiveTab.startsWith(item.href + '/');
    }


    return (
        <div className="h-screen overflow-hidden flex" style={{ fontFamily: 'Lexend, sans-serif', background: C.bg }}>
            {/* ═══ DESKTOP Sidebar ═══ */}
            <aside
                className="hidden md:flex flex-col py-6 px-4 flex-shrink-0"
                style={{ width: '220px', background: '#ffffff', borderRight: `1px solid ${C.border}` }}
            >
                <div className="flex-1">
                    {/* Logo */}
                    <div className="flex items-center gap-2 mb-8 px-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.orange }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 7v10l8 5 8-5V7L12 2z" fill="white" opacity="0.9" /></svg>
                        </div>
                        <span className="font-bold text-base" style={{ color: C.navy }}>RescueMe</span>
                    </div>
                    {/* Nav */}
                    <nav className="space-y-1">
                        {navItems.map(item => {
                            const active = isActive(item);
                            return (
                                <button
                                    key={item.label}
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
                {/* Online Toggle */}
                <div>
                    <div className="flex items-center gap-2 px-2 mb-3 pb-3" style={{ borderBottom: `1px solid ${C.border}` }}>
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <span className="flex-1 text-xs font-medium" style={{ color: C.gray }}>
                            {isOnline ? t('provider.dashboard.online') : t('provider.dashboard.offline')}
                        </span>
                        <button
                            onClick={handleToggle}
                            disabled={statusLoading}
                            aria-label="Toggle online status"
                            className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${isOnline ? 'bg-green-500' : 'bg-gray-300'} ${statusLoading ? 'opacity-50' : ''}`}
                        >
                            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${isOnline ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>
                    </div>
                    <div className="flex items-center gap-3 px-2 pt-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 bg-cover bg-center" style={{ background: user?.avatar ? `url(${user.avatar}) center/cover` : C.orange }}>
                            {!user?.avatar && displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: C.navy }}>{displayName}</p>
                            <p className="text-xs" style={{ color: C.gray }}>{t('provider.dashboard.providerRole')}</p>
                        </div>
                    </div>
                    {/* Logout Button */}
                    <div className="px-2 mt-4 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
                        <button
                            onClick={logout}
                            disabled={statusLoading}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold transition-all hover:bg-red-50"
                            style={{ color: C.red }}
                        >
                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Đăng xuất
                        </button>
                    </div>
                </div>
            </aside>

            {/* ═══ Main Area ═══ */}
            <div className="flex-1 flex flex-col min-w-0" style={{ paddingBottom: '60px' }}>
                {/* Mobile Online Toggle Strip */}
                <div
                    className="flex md:hidden items-center gap-3 px-4 py-2.5 sticky top-0 z-20"
                    style={{ background: isOnline ? '#f0fdf4' : '#f8fafc', borderBottom: `1px solid ${isOnline ? '#bbf7d0' : C.border}` }}
                >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <span className="flex-1 text-sm font-medium" style={{ color: isOnline ? '#16a34a' : C.gray }}>
                        {isOnline ? t('provider.dashboard.online') : t('provider.dashboard.offline')}
                    </span>
                    <button
                        onClick={handleToggle}
                        disabled={statusLoading}
                        aria-label="Toggle online status"
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${isOnline ? 'bg-green-500' : 'bg-gray-300'} ${statusLoading ? 'opacity-50' : ''}`}
                    >
                        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform ${isOnline ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {children}
                </div>
            </div>

            {/* ═══ Mobile Bottom Nav ═══ */}
            <nav
                className="fixed bottom-0 left-0 right-0 md:hidden z-30 flex items-stretch shadow-[0_-2px_10px_rgba(0,0,0,0.05)]"
                style={{ background: '#ffffff', borderTop: `1px solid ${C.border}`, height: '60px' }}
            >
                {navItems.map(item => {
                    const active = isActive(item);
                    return (
                        <button
                            key={item.label}
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
