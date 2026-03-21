'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserGuard } from '@/lib/guards';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import api from '@/lib/api';
import AvatarImage from '@/components/AvatarImage';
import { Search, ArrowUpDown } from 'lucide-react';

interface RescueRequest {
    id: string;
    incidentType: string;
    vehicleType: string;
    status: string;
    pickupLocation: {
        addressText: string;
        lat: number;
        lng: number;
    };
    dropoffLocation?: {
        addressText: string;
        lat: number;
        lng: number;
    };
    description?: string;
    createdAt: string;
    media: any[];
    assignedProvider?: {
        id: string;
        name: string;
        avatar?: string;
    };
    payment?: {
        id: string;
        amount: number;
        paymentMethod: string;
    };
}

const C = {
    orange: '#f97316',
    orangeDark: '#ea6c0a',
    orangeLight: '#fff7ed',
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#f1f5f9',
    bg: '#f8fafc',
    white: '#ffffff',
};

const STATUS_LABELS: Record<string, string> = {
    CREATED: 'Đã tạo',
    MATCHING: 'Đang tìm',
    SEARCHING: 'Đang tìm',
    MATCHED: 'Đã ghép đôi',
    ASSIGNED: 'Có provider',
    ACCEPTED: 'Đã chấp nhận',
    IN_PROGRESS: 'Đang thực hiện',
    COMPLETED: 'Hoàn thành',
    CANCELLED: 'Đã hủy',
    REJECTED: 'Bị từ chối',
    EXPIRED: 'Hết hạn',
};

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
    CREATED: { bg: '#eff6ff', text: '#2563eb', dot: '#3b82f6' },
    MATCHING: { bg: C.orangeLight, text: C.orange, dot: C.orange },
    SEARCHING: { bg: C.orangeLight, text: C.orange, dot: C.orange },
    MATCHED: { bg: '#f5f3ff', text: '#7c3aed', dot: '#8b5cf6' },
    ASSIGNED: { bg: '#f0fdf4', text: '#16a34a', dot: '#22c55e' },
    ACCEPTED: { bg: '#f0fdf4', text: '#16a34a', dot: '#22c55e' },
    IN_PROGRESS: { bg: '#eff6ff', text: '#2563eb', dot: '#3b82f6' },
    COMPLETED: { bg: '#f0fdf4', text: '#16a34a', dot: '#22c55e' },
    CANCELLED: { bg: '#fef2f2', text: '#dc2626', dot: '#ef4444' },
    REJECTED: { bg: '#fef2f2', text: '#dc2626', dot: '#ef4444' },
    EXPIRED: { bg: '#fefce8', text: '#ca8a04', dot: '#eab308' },
};

const INCIDENT_LABELS: Record<string, string> = {
    BREAKDOWN: 'Hỏng xe',
    ACCIDENT: 'Tai nạn',
    FLAT_TIRE: 'Lốp xe hỏng',
    BATTERY_DEAD: 'Hết bình điện',
    OUT_OF_FUEL: 'Hết nhiên liệu',
    LOCKED_OUT: 'Khóa xe',
    OTHER: 'Khác',
};

const INCIDENT_ICONS: Record<string, React.ReactNode> = {
    BREAKDOWN: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    ACCIDENT: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
    FLAT_TIRE: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /></svg>,
    BATTERY_DEAD: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="2" y="7" width="18" height="10" rx="2" /><path d="M22 11v2" strokeLinecap="round" /></svg>,
    OUT_OF_FUEL: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    LOCKED_OUT: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
    OTHER: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
};

const ACTIVE_STATUSES = ['CREATED', 'MATCHING', 'SEARCHING', 'MATCHED', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'];
const DONE_STATUSES = ['COMPLETED'];
const FAILED_STATUSES = ['CANCELLED', 'REJECTED', 'EXPIRED'];

// TAB_FILTERS and STATUS/INCIDENT_LABELS are now built inside component to use t()

const navItems_static = [
    { label: 'Home', href: '/user', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
    { label: 'History', href: '/user/requests', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { label: 'Wallet', href: '/user/wallet', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg> },
    { label: 'Settings', href: '#', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
];

function formatDate(dateString: string, t: any) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) {
        return t('user.requests.time.today') + ', ' + date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
        return t('user.requests.time.yesterday') + ', ' + date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
        return t('user.requests.time.daysAgo').replace('{days}', String(diffDays));
    }
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function UserRequestsPage() {
    const router = useRouter();
    const { isReady, user } = useUserGuard();
    const { t } = useLanguage();
    const [requests, setRequests] = useState<RescueRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

    const STATUS_LABELS: Record<string, string> = {
        CREATED: t('user.requests.status.created'),
        MATCHING: t('user.requests.status.matching'),
        SEARCHING: t('user.requests.status.matching'),
        MATCHED: t('user.requests.status.matched'),
        ASSIGNED: t('user.requests.status.assigned'),
        ACCEPTED: t('user.requests.status.accepted'),
        IN_PROGRESS: t('user.requests.status.inProgress'),
        COMPLETED: t('user.requests.status.completed'),
        CANCELLED: t('user.requests.status.cancelled'),
        REJECTED: t('user.requests.status.rejected'),
        EXPIRED: t('user.requests.status.expired'),
    };

    const INCIDENT_LABELS: Record<string, string> = {
        BREAKDOWN: t('provider.incidents.BREAKDOWN'),
        ACCIDENT: t('provider.incidents.ACCIDENT'),
        FLAT_TIRE: t('provider.incidents.FLAT_TIRE'),
        BATTERY_DEAD: t('provider.incidents.BATTERY_DEAD'),
        OUT_OF_FUEL: t('provider.incidents.OUT_OF_FUEL'),
        LOCKED_OUT: t('provider.incidents.LOCKED_OUT'),
        OTHER: t('provider.incidents.OTHER'),
    };

    const TAB_FILTERS = [
        { key: 'all', label: t('user.requests.tabs.all') },
        { key: 'active', label: t('user.requests.tabs.active') },
        { key: 'done', label: t('user.requests.tabs.done') },
        { key: 'failed', label: t('user.requests.tabs.failed') },
    ];

    const navItems = [
        { label: t('user.nav.home'), href: '/user', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
        { label: t('user.nav.history'), href: '/user/requests', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
        { label: t('user.nav.wallet'), href: '/user/wallet', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg> },
        { label: t('user.nav.settings'), href: '/user/settings', icon: <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
    ];

    const historyLabel = t('user.nav.history');

    useEffect(() => {
        if (isReady) fetchRequests();
    }, [isReady]);

    const fetchRequests = async () => {
        try {
            const response = await api.get('/rescue-requests');
            setRequests(response.data);
        } catch (error) {
            console.error('Error fetching requests:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredRequests = requests.filter(r => {
        // Tab Filtering
        if (activeTab === 'active' && !ACTIVE_STATUSES.includes(r.status)) return false;
        if (activeTab === 'done' && !DONE_STATUSES.includes(r.status)) return false;
        if (activeTab === 'failed' && !FAILED_STATUSES.includes(r.status)) return false;

        // Search Filtering
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const idMatch = r.id.toLowerCase().includes(term);
            const typeMatch = (INCIDENT_LABELS[r.incidentType] || r.incidentType).toLowerCase().includes(term);
            const addressMatch = (r.pickupLocation?.addressText || '').toLowerCase().includes(term);
            if (!idMatch && !typeMatch && !addressMatch) return false;
        }

        return true;
    }).sort((a, b) => {
        // Sort explicitly by createdAt date string
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    const activeCount = requests.filter(r => ACTIVE_STATUSES.includes(r.status)).length;

    const displayName = user?.name || user?.email?.split('@')[0] || 'Bạn';

    if (!isReady || isLoading) {
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

            {/* ═══ DESKTOP Sidebar (md+) ═══ */}
            <aside
                className="hidden md:flex flex-col justify-between py-6 px-4 flex-shrink-0"
                style={{ width: '220px', background: C.white, borderRight: `1px solid ${C.border}` }}
            >
                <div>
                    {/* Logo */}
                    <div className="flex items-center gap-2 mb-8 px-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.orange }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 7v10l8 5 8-5V7L12 2z" fill="white" opacity="0.9" /></svg>
                        </div>
                        <span className="font-bold text-base" style={{ color: C.navy }}>RescueMe</span>
                    </div>
                    <nav className="space-y-1">
                        {navItems.map(item => {
                            const active = item.label === historyLabel;
                            return (
                                <button
                                    key={item.label}
                                    onClick={() => { if (item.href !== '#') router.push(item.href); }}
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
                {/* User */}
                <div className="flex items-center gap-3 px-2 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
                    <AvatarImage
                        name={displayName}
                        avatar={user?.avatar}
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                        fallbackBackground={C.orange}
                        initialsCount={1}
                    />
                    <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: C.navy }}>{displayName}</p>
                        <p className="text-xs" style={{ color: C.gray }}>{t('user.dashboard.basicPlan')}</p>
                    </div>
                </div>
            </aside>

            {/* ═══ Main Area ═══ */}
            <div className="flex-1 flex flex-col min-w-0" style={{ paddingBottom: '64px' }}>

                {/* ── Sticky Header ── */}
                <header
                    className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 flex-shrink-0"
                    style={{ background: C.white, borderBottom: `1px solid ${C.border}` }}
                >
                    {/* Mobile: back to home */}
                    <button
                        onClick={() => router.push('/user')}
                        className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: C.bg, color: C.navy }}
                    >
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>

                    {/* Mobile logo (desktop hides) */}
                    <div className="md:hidden flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: C.orange }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 7v10l8 5 8-5V7L12 2z" fill="white" opacity="0.9" /></svg>
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <h1 className="font-bold text-sm leading-tight" style={{ color: C.navy }}>{t('user.requests.title')}</h1>
                        <p className="text-xs" style={{ color: C.gray }}>
                            {requests.length > 0 ? `${requests.length} ${t('user.requests.count')}${activeCount > 0 ? ` · ${activeCount} ${t('user.requests.active')}` : ''}` : t('user.requests.empty')}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <LanguageSwitcher />
                        <button
                            onClick={() => router.push('/user/create-request')}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white flex-shrink-0 transition-all active:scale-95 hidden sm:flex"
                            style={{ background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)`, boxShadow: `0 2px 8px ${C.orange}40` }}
                        >
                            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            {t('user.requests.createNew')}
                        </button>
                        <button
                            onClick={() => router.push('/user/create-request')}
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0 transition-all active:scale-95 sm:hidden"
                            style={{ background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)`, boxShadow: `0 2px 8px ${C.orange}40` }}
                            aria-label={t('user.requests.createNew')}
                        >
                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                        <AvatarImage
                            name={displayName}
                            avatar={user?.avatar}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            fallbackBackground={C.orange}
                            initialsCount={1}
                        />
                    </div>
                </header>

                {/* ── Tab Filter ── */}
                <div
                    className="flex gap-1 px-4 py-3 overflow-x-auto flex-shrink-0"
                    style={{ background: C.white, borderBottom: `1px solid ${C.border}` }}
                >
                    {TAB_FILTERS.map(tab => {
                        const count = tab.key === 'all' ? requests.length
                            : tab.key === 'active' ? requests.filter(r => ACTIVE_STATUSES.includes(r.status)).length
                                : tab.key === 'done' ? requests.filter(r => DONE_STATUSES.includes(r.status)).length
                                    : requests.filter(r => FAILED_STATUSES.includes(r.status)).length;
                        const active = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex-shrink-0"
                                style={{
                                    background: active ? C.orange : C.bg,
                                    color: active ? 'white' : C.gray,
                                    border: active ? 'none' : `1px solid ${C.border}`,
                                }}
                            >
                                {tab.label}
                                {count > 0 && (
                                    <span
                                        className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                                        style={{ background: active ? 'rgba(255,255,255,0.3)' : C.orangeLight, color: active ? 'white' : C.orange }}
                                    >
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* ── Search & Sort ── */}
                <div className="px-4 py-3 flex items-center gap-2 flex-shrink-0" style={{ background: C.white, borderBottom: `1px solid ${C.border}` }}>
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            placeholder={t('common.search')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-xl text-sm transition-colors focus:outline-none"
                            style={{ background: C.bg, color: C.navy, border: `1px solid ${C.border}` }}
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.gray }} />
                    </div>
                    <button
                        onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors focus:outline-none"
                        style={{ background: C.bg, color: C.gray, border: `1px solid ${C.border}` }}
                        title={t('user.requests.sortTimeTooltip')}
                    >
                        <ArrowUpDown className="w-4 h-4" />
                        <span className="hidden sm:inline">{sortOrder === 'desc' ? t('user.requests.sortNewest') : t('user.requests.sortOldest')}</span>
                    </button>
                </div>

                {/* ── Request List ── */}
                <div className="flex-1 overflow-y-auto">
                    <div className="px-4 py-4 space-y-3 max-w-2xl mx-auto">

                        {filteredRequests.length === 0 ? (
                            /* ── Empty State ── */
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div
                                    className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
                                    style={{ background: C.orangeLight }}
                                >
                                    <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                </div>
                                <h3 className="text-base font-bold mb-1" style={{ color: C.navy }}>
                                    {activeTab === 'all' ? t('user.requests.emptyAll') : t('user.requests.emptyFiltered')}
                                </h3>
                                <p className="text-sm mb-6" style={{ color: C.gray }}>
                                    {activeTab === 'all' ? t('user.requests.emptyAllSub') : t('user.requests.emptyFilteredSub')}
                                </p>
                                {activeTab === 'all' && (
                                    <button
                                        onClick={() => router.push('/user/create-request')}
                                        className="px-6 py-3 rounded-xl font-semibold text-sm text-white transition-all active:scale-95"
                                        style={{ background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`, boxShadow: `0 4px 16px ${C.orange}40` }}
                                    >
                                        {t('user.requests.createCta')}
                                    </button>
                                )}
                            </div>
                        ) : (
                            filteredRequests.map((request) => {
                                const statusStyle = STATUS_STYLE[request.status] || { bg: C.bg, text: C.gray, dot: C.gray };
                                const isActive = ACTIVE_STATUSES.includes(request.status);
                                const icon = INCIDENT_ICONS[request.incidentType];

                                return (
                                    <button
                                        key={request.id}
                                        onClick={() => router.push(`/user/requests/${request.id}`)}
                                        className="w-full text-left bg-white rounded-2xl p-4 transition-all active:scale-[0.99]"
                                        style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)', border: isActive ? `1.5px solid ${C.orange}30` : `1.5px solid transparent` }}
                                    >
                                        {/* Top row */}
                                        <div className="flex items-start gap-3">
                                            {/* Icon */}
                                            <div
                                                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                                                style={{ background: statusStyle.bg, color: statusStyle.text }}
                                            >
                                                {icon}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-sm" style={{ color: C.navy }}>
                                                            {INCIDENT_LABELS[request.incidentType] || request.incidentType}
                                                        </p>
                                                        <p className="text-xs mt-0.5" style={{ color: C.gray }}>
                                                            {formatDate(request.createdAt, t)}
                                                        </p>
                                                    </div>
                                                    {/* Status chip */}
                                                    <div
                                                        className="flex items-center gap-1 px-2 py-1 rounded-full flex-shrink-0"
                                                        style={{ background: statusStyle.bg }}
                                                    >
                                                        {isActive && (
                                                            <div
                                                                className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0"
                                                                style={{ background: statusStyle.dot }}
                                                            />
                                                        )}
                                                        <span className="text-[10px] font-semibold" style={{ color: statusStyle.text }}>
                                                            {STATUS_LABELS[request.status] || request.status}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Address */}
                                                <div className="flex items-start gap-1.5 mt-2">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill={C.orange} className="flex-shrink-0 mt-0.5">
                                                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                                                    </svg>
                                                    <p className="text-xs line-clamp-1 flex-1" style={{ color: C.gray }}>
                                                        {request.pickupLocation?.addressText || t('components.incomingRequest.unknownLocation')}
                                                    </p>
                                                </div>

                                                {/* Provider & Payment Info */}
                                                {(request.assignedProvider || request.payment) && (
                                                    <div className="flex items-center gap-3 mt-3 pt-2" style={{ borderTop: `1px dashed ${C.border}` }}>
                                                        {request.assignedProvider && (
                                                            <div className="flex items-center gap-1.5 max-w-[60%]">
                                                                <span className="text-[11px] font-medium" style={{ color: C.gray }}>
                                                                    {t('user.requests.providerLabel')}
                                                                </span>
                                                                <AvatarImage
                                                                    name={request.assignedProvider.name}
                                                                    avatar={request.assignedProvider.avatar}
                                                                    className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                                                                    fallbackBackground={C.orangeLight}
                                                                    initialsCount={1}
                                                                    style={{ color: C.orange }}
                                                                />
                                                                <span className="text-[11px] font-medium truncate" style={{ color: C.navy }}>
                                                                    {request.assignedProvider.name}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {request.assignedProvider && request.payment && (
                                                            <div className="w-1 h-1 rounded-full bg-slate-200" />
                                                        )}
                                                        {request.payment && (
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium" style={{ background: '#f8fafc', border: `1px solid ${C.border}`, color: C.gray }}>
                                                                    {request.payment.paymentMethod === 'WALLET' 
                                                                        ? t('user.requests.payment.WALLET') 
                                                                        : request.payment.paymentMethod === 'CASH' 
                                                                        ? t('user.requests.payment.CASH') 
                                                                        : request.payment.paymentMethod}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Arrow */}
                                            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={C.border} strokeWidth={2.5} className="flex-shrink-0 mt-2">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>

                                        {/* ID badge */}
                                        <div
                                            className="mt-3 pt-3 flex items-center justify-between"
                                            style={{ borderTop: `1px solid ${C.border}` }}
                                        >
                                            <span className="text-[10px] font-mono" style={{ color: C.gray }}>
                                                #{request.id.slice(0, 8).toUpperCase()}
                                            </span>
                                            {request.media && request.media.length > 0 && (
                                                <span className="flex items-center gap-1 text-[10px]" style={{ color: C.gray }}>
                                                    <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                    {request.media.length} {t('common.photos')}
                                                </span>
                                            )}
                                            <span className="text-[10px] font-medium flex items-center gap-0.5" style={{ color: C.orange }}>
                                                {t('common.viewDetails')}
                                                <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                                </svg>
                                            </span>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* ═══ MOBILE Bottom Navigation ═══ */}
            <nav
                className="fixed bottom-0 left-0 right-0 md:hidden z-30 flex items-stretch"
                style={{ background: C.white, borderTop: `1px solid ${C.border}`, height: '60px' }}
            >
                {navItems.map(item => {
                    const active = item.label === historyLabel;
                    return (
                        <button
                            key={item.label}
                            onClick={() => { if (item.href !== '#') router.push(item.href); }}
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
