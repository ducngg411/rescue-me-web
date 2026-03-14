'use client';

import React, { ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

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

    const currentActiveTab = activeTab || pathname;

    function isActive(href: string) {
        return currentActiveTab === href || currentActiveTab.startsWith(href + '/');
    }

    const displayName = user?.name || user?.email?.split('@')[0] || 'Admin';
    const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

    return (
        <div className="h-screen overflow-hidden flex" style={{ fontFamily: 'Poppins, sans-serif', background: C.bg }}>
            {/* Sidebar */}
            <aside
                className="hidden md:flex flex-col flex-shrink-0"
                style={{ width: '220px', background: '#ffffff', borderRight: `1px solid ${C.border}` }}
            >
                <div className="flex-1 py-6 px-4">
                    {/* Logo */}
                    <div className="flex items-center gap-2 mb-8 px-2">
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: C.orange }}
                        >
                            {/* Asterisk star icon */}
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                            </svg>
                        </div>
                        <div>
                            <p className="font-bold text-sm leading-tight" style={{ color: C.navy }}>RescueMe</p>
                            <p className="text-xs" style={{ color: C.gray }}>Admin Panel</p>
                        </div>
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
                                                onClick={() => router.push(item.href)}
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
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ background: C.orange }}
                        >
                            {initials}
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
