'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import RescueMeLogo from '@/components/RescueMeLogo';
import api from '@/lib/api';

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

interface AdminLayoutProps {
    children: ReactNode;
    activeTab?: string;
}

const navGroups = [
    {
        label: null,
        items: [
            {
                label: 'Dashboard',
                href: '/admin/dashboard',
                icon: (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <rect x="3" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
                        <rect x="14" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
                        <rect x="3" y="14" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
                        <rect x="14" y="14" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                ),
            },
            {
                label: 'Provider Approval',
                href: '/admin/providers',
                icon: (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                ),
            },
            {
                label: 'Disputes',
                href: '/admin/disputes',
                icon: (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                ),
            },
            {
                label: 'Service Requests',
                href: '/admin/requests',
                icon: (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                ),
            },
            {
                label: 'Users',
                href: '/admin/users',
                icon: (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                ),
            },
        ],
    },
    {
        label: 'MANAGEMENT',
        items: [
            {
                label: 'Transactions',
                href: '/admin/transactions',
                icon: (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                ),
            },
            {
                label: 'Withdrawals',
                href: '/admin/withdrawals',
                icon: (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                ),
            },
            {
                label: 'Settings',
                href: '/admin/settings',
                icon: (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                ),
            },
        ],
    },
];

export default function AdminLayout({ children, activeTab }: AdminLayoutProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const [disputeBadge, setDisputeBadge] = useState(0);
    const [latestDisputeTotal, setLatestDisputeTotal] = useState(0);

    const currentActiveTab = activeTab || pathname;

    function isActive(href: string) {
        return currentActiveTab === href || currentActiveTab.startsWith(href + '/');
    }

    const displayName = user?.name || user?.email?.split('@')[0] || 'Admin';
    const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

    useEffect(() => {
        let active = true;

        const LS_SEEN_TOTAL_KEY = 'admin.disputes.seenTotal';
        const LS_BADGE_KEY = 'admin.disputes.badgeCount';

        const toInt = (value: string | null, fallback = 0) => {
            const parsed = Number.parseInt(value ?? '', 10);
            return Number.isFinite(parsed) ? parsed : fallback;
        };

        const checkDisputeTotal = async () => {
            try {
                const res = await api.get('/admin/disputes', { params: { take: 1, skip: 0 } });
                if (!active) return;
                const totalFromApi = Number(res.data?.total ?? 0);
                setLatestDisputeTotal(totalFromApi);

                const onDisputesPage = pathname.startsWith('/admin/disputes');
                const seenTotal = toInt(localStorage.getItem(LS_SEEN_TOTAL_KEY), totalFromApi);
                const currentBadge = toInt(localStorage.getItem(LS_BADGE_KEY), 0);

                if (onDisputesPage) {
                    localStorage.setItem(LS_SEEN_TOTAL_KEY, String(totalFromApi));
                    localStorage.setItem(LS_BADGE_KEY, '0');
                    setDisputeBadge(0);
                    return;
                }

                if (totalFromApi < seenTotal) {
                    // Keep values sane when old cases are archived/deleted.
                    localStorage.setItem(LS_SEEN_TOTAL_KEY, String(totalFromApi));
                    setDisputeBadge(currentBadge);
                    return;
                }

                const delta = Math.max(0, totalFromApi - seenTotal);
                const nextBadge = currentBadge + delta;
                localStorage.setItem(LS_BADGE_KEY, String(nextBadge));
                localStorage.setItem(LS_SEEN_TOTAL_KEY, String(totalFromApi));
                setDisputeBadge(nextBadge);
            } catch {
                if (active) setDisputeBadge(0);
            }
        };

        void checkDisputeTotal();
        const id = window.setInterval(() => {
            void checkDisputeTotal();
        }, 30000);

        return () => {
            active = false;
            window.clearInterval(id);
        };
    }, [pathname]);

    return (
        <div className="h-screen overflow-hidden flex" style={{ fontFamily: 'Lexend, sans-serif', background: C.bg }}>
            {/* Sidebar */}
            <aside
                className="hidden md:flex flex-col flex-shrink-0"
                style={{ width: '220px', background: '#ffffff', borderRight: `1px solid ${C.border}` }}
            >
                <div className="flex-1 py-6 px-4">
                    {/* Logo */}
                    <div className="flex flex-col items-start gap-1 mb-8 px-2">
                        <RescueMeLogo size={32} textClass="text-sm" />
                        <p className="text-[10px] font-bold uppercase tracking-widest pl-[40px]" style={{ color: C.orange }}>Admin Panel</p>
                    </div>

                    {/* Nav Groups */}
                    <nav className="space-y-4">
                        {navGroups.map((group, gi) => (
                            <div key={gi}>
                                {group.label && (
                                    <p
                                        className="text-xs font-semibold tracking-wider mb-2 px-3"
                                        style={{ color: C.gray }}
                                    >
                                        {group.label}
                                    </p>
                                )}
                                <div className="space-y-1">
                                    {group.items.map((item) => {
                                        const active = isActive(item.href);
                                        return (
                                            <button
                                                key={item.href}
                                                onClick={() => {
                                                    if (item.href === '/admin/disputes') {
                                                        localStorage.setItem('admin.disputes.badgeCount', '0');
                                                        localStorage.setItem('admin.disputes.seenTotal', String(latestDisputeTotal));
                                                        setDisputeBadge(0);
                                                    }
                                                    router.push(item.href);
                                                }}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                                                style={{
                                                    background: active ? C.orangeLight : 'transparent',
                                                    color: active ? C.orange : '#64748b',
                                                }}
                                                onMouseEnter={e => {
                                                    if (!active) (e.currentTarget as HTMLElement).style.background = C.bg;
                                                }}
                                                onMouseLeave={e => {
                                                    if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
                                                }}
                                            >
                                                {item.icon}
                                                {item.label}
                                                {item.href === '/admin/disputes' && disputeBadge > 0 && !active && (
                                                    <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#fee2e2', color: '#dc2626' }}>
                                                        {disputeBadge}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </nav>
                </div>

                {/* Admin Profile + Logout */}
                <div className="px-4 py-4" style={{ borderTop: `1px solid ${C.border}` }}>
                    <div className="flex items-center gap-3 px-2 mb-3">
                        <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 bg-cover bg-center"
                            style={{ background: user?.avatar ? `url(${user.avatar}) center/cover` : C.orange }}
                        >
                            {!user?.avatar && initials}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate" style={{ color: C.navy }}>{displayName}</p>
                            <p className="text-xs" style={{ color: C.gray }}>Super Admin</p>
                        </div>
                        <button
                            onClick={logout}
                            className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
                            style={{ color: C.gray }}
                            title="Đăng xuất"
                        >
                            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <div className="flex-1 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
}
