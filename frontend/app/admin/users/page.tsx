'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminGuard } from '@/lib/guards';
import { adminApi } from '@/lib/api';
import AdminLayout from '@/components/AdminLayout';
import AvatarImage from '@/components/AvatarImage';
import { displayOrderCode } from '@/lib/reconciliation';
import {
    Search, ChevronLeft, ChevronRight, Filter, Calendar, Eye,
    X, Mail, Phone, Wallet, Car, Star, Clock, ShieldOff, ShieldCheck,
    AlertTriangle, Loader2, Trash2, ExternalLink, Users, CheckCircle, Lock
} from 'lucide-react';

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
    _count: { rescueRequests: number };
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
    _count: { rescueRequests: number; reviewsGiven: number };
    rescueRequests: Array<{
        id: string;
        orderCode: string | null;
        incidentType: string;
        status: string;
        createdAt: string;
        payment: { totalAmount: number } | null;
    }>;
}

type TabType = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'ROLE_USER' | 'ROLE_PROVIDER' | 'ROLE_ADMIN' | 'ACCOUNT_ACTIVE' | 'ACCOUNT_BANNED';

const TAB_GROUPS: { groupLabel: string; tabs: { key: TabType; label: string }[] }[] = [
    {
        groupLabel: 'Hồ sơ',
        tabs: [
            { key: 'ALL', label: 'Tất cả' },
            { key: 'ACTIVE', label: 'Đã hoàn thiện' },
            { key: 'INACTIVE', label: 'Chưa hoàn thiện' },
        ],
    },
    {
        groupLabel: 'Vai trò',
        tabs: [
            { key: 'ROLE_USER', label: 'Customer' },
            { key: 'ROLE_PROVIDER', label: 'Provider' },
            { key: 'ROLE_ADMIN', label: 'Admin' },
        ],
    },
    {
        groupLabel: 'Tài khoản',
        tabs: [
            { key: 'ACCOUNT_ACTIVE', label: 'Hoạt động' },
            { key: 'ACCOUNT_BANNED', label: 'Bị khóa' },
        ],
    },
];

const ALL_TABS = TAB_GROUPS.flatMap(g => g.tabs);

const INCIDENT_LABELS: Record<string, string> = {
    BREAKDOWN: 'Hỏng xe', ACCIDENT: 'Tai nạn', FLAT_TIRE: 'Xì lốp',
    BATTERY_DEAD: 'Hết pin', OUT_OF_FUEL: 'Hết xăng', LOCKED_OUT: 'Khóa xe', OTHER: 'Khác',
};
const REQUEST_STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    COMPLETED: { label: 'Hoàn thành', color: C.green, bg: C.greenLight },
    CANCELLED: { label: 'Đã hủy', color: C.red, bg: C.redLight },
    PAID: { label: 'Đã thanh toán', color: C.green, bg: C.greenLight },
    IN_PROGRESS: { label: 'Đang làm', color: C.blue, bg: C.blueLight },
};

const PAGE_SIZE = 10;

function RoleBadge({ role }: { role: UserItem['role'] }) {
    const map: Record<UserItem['role'], { label: string; bg: string; color: string }> = {
        USER: { label: 'Customer', bg: '#eff6ff', color: '#2563eb' },
        PROVIDER: { label: 'Provider', bg: '#f0fdf4', color: '#16a34a' },
        ADMIN: { label: 'Admin', bg: '#fefce8', color: '#ca8a04' },
    };
    const c = map[role];
    return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: c.bg, color: c.color }}>
            {c.label}
        </span>
    );
}

/** Profile Status: Hoàn thiện / Chưa hoàn thiện */
function ProfileBadge({ completed }: { completed: boolean }) {
    return completed ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: C.greenLight, color: C.green }}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            Đã hoàn thiện
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: C.yellowLight, color: C.yellow }}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            Chưa hoàn thiện
        </span>
    );
}

/** Account Status: Hoạt động / Bị khóa */
function AccountBadge({ banned }: { banned: boolean }) {
    return banned ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: C.redLight, color: C.red }}>
            <ShieldOff className="w-2.5 h-2.5" />
            Bị khóa
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: C.blueLight, color: C.blue }}>
            <ShieldCheck className="w-2.5 h-2.5" />
            Hoạt động
        </span>
    );
}

function AuthBadge({ provider }: { provider: 'EMAIL' | 'GOOGLE' }) {
    if (provider === 'GOOGLE') return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: C.blueLight, color: C.blue }}>
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Google
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: C.greenLight, color: C.green }}>
            <Mail className="w-3 h-3" />
            Email
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
            setError('Không thể tải thông tin người dùng.');
        } finally {
            setLoading(false);
        }
    }, [userId]);

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
            setError('Có lỗi xảy ra khi khóa tài khoản.');
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
            setError('Có lỗi xảy ra khi mở khóa tài khoản.');
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
            setError('Có lỗi xảy ra khi xóa tài khoản.');
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
                    <h2 className="text-base font-bold" style={{ color: C.navy }}>Chi tiết người dùng</h2>
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
                        <div className="p-6 text-center text-sm" style={{ color: C.red }}>{error || 'Không tìm thấy.'}</div>
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
                                        <p className="text-xs font-bold" style={{ color: C.red }}>Tài khoản đang bị khóa</p>
                                        <p className="text-xs mt-0.5" style={{ color: '#991b1b' }}>Lý do: {user.banReason}</p>
                                        <p className="text-[10px] mt-0.5 opacity-70" style={{ color: '#991b1b' }}>
                                            Khóa lúc: {new Date(user.bannedAt!).toLocaleString('vi-VN')}
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
                                            {user.fullName || '(Chưa cập nhật tên)'}
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
                                                label: 'Số dư ví',
                                                value: user.userWallet
                                                    ? `${user.userWallet.availableBalance.toLocaleString('vi-VN')}₫`
                                                    : user.providerWallet
                                                        ? `${user.providerWallet.availableBalance.toLocaleString('vi-VN')}₫`
                                                        : '—',
                                                icon: <Wallet className="w-3.5 h-3.5" />,
                                            },
                                    { label: 'Yêu cầu', value: String(user._count.rescueRequests), icon: <Car className="w-3.5 h-3.5" /> },
                                    { label: 'Đánh giá', value: String(user._count.reviewsGiven), icon: <Star className="w-3.5 h-3.5" /> },
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
                                <p className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: C.gray }}>Thông tin liên hệ</p>
                                {[
                                    { icon: <Phone className="w-3.5 h-3.5" />, label: 'Số điện thoại', value: user.phoneNumber || '—' },
                                    { icon: <Mail className="w-3.5 h-3.5" />, label: 'Email', value: user.email },
                                    { icon: <Car className="w-3.5 h-3.5" />, label: 'Biển số xe', value: user.licensePlate ? `${user.licensePlate}${user.vehicleColor ? ` · ${user.vehicleColor}` : ''}` : '—' },
                                    { icon: <Clock className="w-3.5 h-3.5" />, label: 'Tham gia', value: new Date(user.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) },
                                    { icon: <Clock className="w-3.5 h-3.5" />, label: 'Đăng nhập gần nhất', value: user.lastLogin ? new Date(user.lastLogin).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' } as Intl.DateTimeFormatOptions) : '—' },
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
                                        <p className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: C.gray }}>Phương thức đăng nhập</p>
                                        <div className="mt-0.5"><AuthBadge provider={user.authProvider} /></div>
                                    </div>
                                </div>
                            </div>

                            {/* Wallet detail */}
                            {user.userWallet && (
                                <div className="px-5 py-4 border-b" style={{ borderColor: C.border }}>
                                    <p className="text-[10px] font-semibold tracking-wider uppercase mb-3" style={{ color: C.gray }}>Ví điện tử</p>
                                    <div className="rounded-xl p-4 border" style={{ borderColor: C.border, background: C.bg }}>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs" style={{ color: C.gray }}>Số dư khả dụng</span>
                                            <span className="text-sm font-bold" style={{ color: C.green }}>{user.userWallet.availableBalance.toLocaleString('vi-VN')}₫</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs" style={{ color: C.gray }}>Đang chờ</span>
                                            <span className="text-sm font-semibold" style={{ color: C.yellow }}>{user.userWallet.pendingBalance.toLocaleString('vi-VN')}₫</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Recent requests */}
                            {user.rescueRequests.length > 0 && (
                                <div className="px-5 py-4 border-b" style={{ borderColor: C.border }}>
                                    <p className="text-[10px] font-semibold tracking-wider uppercase mb-3" style={{ color: C.gray }}>5 yêu cầu gần nhất</p>
                                    <div className="space-y-2">
                                        {user.rescueRequests.map(r => {
                                            const st = REQUEST_STATUS_LABELS[r.status] || { label: r.status, color: C.gray, bg: C.bg };
                                            return (
                                                <div key={r.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl border" style={{ borderColor: C.border }}>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-semibold truncate" style={{ color: C.navy }}>
                                                            {INCIDENT_LABELS[r.incidentType] || r.incidentType}
                                                            {r.orderCode && (
                                                                <span className="ml-1 font-mono font-normal" style={{ color: C.gray }}>
                                                                    #{displayOrderCode(r.orderCode, r.id)}
                                                                </span>
                                                            )}
                                                        </p>
                                                        <p className="text-[10px]" style={{ color: C.gray }}>
                                                            {new Date(r.createdAt).toLocaleDateString('vi-VN')}
                                                            {r.payment && ` · ${r.payment.totalAmount.toLocaleString('vi-VN')}₫`}
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
                        <p className="text-[10px] font-semibold tracking-wider uppercase mb-3" style={{ color: C.gray }}>Hành động</p>

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
                                    Mở khóa
                                </button>
                            ) : (
                                <button
                                    onClick={handleBanOpen}
                                    disabled={!!actionLoading}
                                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                                    style={{ background: C.yellowLight, color: C.yellow }}
                                >
                                    <ShieldOff className="w-4 h-4" />
                                    Khóa TK
                                </button>
                            )}
                            <button
                                onClick={handleViewWallet}
                                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                                style={{ background: C.blueLight, color: C.blue }}
                            >
                                <ExternalLink className="w-4 h-4" />
                                Xem ví
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
                            Xóa tài khoản
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
                            <h3 className="font-bold text-base" style={{ color: C.navy }}>Khóa tài khoản</h3>
                            <button onClick={() => setShowBanModal(false)} className="p-1 rounded-lg hover:bg-gray-100" style={{ color: C.gray }}>
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.gray }}>
                            Lý do khóa <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={banReasonInput}
                            onChange={e => setBanReasonInput(e.target.value)}
                            rows={3}
                            placeholder="VD: Spam, vi phạm điều khoản, hành vi gian lận..."
                            className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none resize-none"
                            style={{ borderColor: C.border, color: C.navy, fontFamily: 'Lexend, sans-serif' }}
                            autoFocus
                        />
                        <p className="text-[10px] mt-1.5 mb-4" style={{ color: C.gray }}>
                            Lý do này sẽ hiển thị cho người dùng khi họ cố đăng nhập.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowBanModal(false); setBanReasonInput(''); }}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 hover:bg-gray-200 transition-colors"
                                style={{ color: C.navy }}
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleBanConfirm}
                                disabled={!banReasonInput.trim() || actionLoading === 'ban'}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50"
                                style={{ background: C.red }}
                            >
                                {actionLoading === 'ban' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />}
                                Xác nhận khóa
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
                            <h3 className="font-bold text-base" style={{ color: C.navy }}>Xác nhận mở khóa</h3>
                            <button onClick={() => setShowUnbanModal(false)} className="p-1 rounded-lg hover:bg-gray-100" style={{ color: C.gray }}>
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-sm" style={{ color: C.gray }}>
                            Bạn chắc chắn muốn mở khóa tài khoản <span className="font-semibold" style={{ color: C.navy }}>{user?.fullName || user?.email}</span>?
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
                                Hủy
                            </button>
                            <button
                                onClick={handleUnbanConfirm}
                                disabled={actionLoading === 'unban'}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50"
                                style={{ background: C.greenLight, color: C.green }}
                            >
                                {actionLoading === 'unban' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                                Mở khóa
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
                            <h3 className="font-bold text-base" style={{ color: C.navy }}>Xác nhận xóa tài khoản</h3>
                            <button onClick={() => setShowDeleteModal(false)} className="p-1 rounded-lg hover:bg-gray-100" style={{ color: C.gray }}>
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-sm" style={{ color: C.gray }}>
                            Xóa vĩnh viễn tài khoản <span className="font-semibold" style={{ color: C.navy }}>{user?.fullName || user?.email}</span>.
                            <span className="block mt-1" style={{ color: C.red, fontWeight: 600 }}>
                                Hành động này không thể hoàn tác.
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
                                Hủy
                            </button>
                            <button
                                onClick={handleDeleteConfirm}
                                disabled={actionLoading === 'delete'}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50"
                                style={{ background: C.red, color: '#fff' }}
                            >
                                {actionLoading === 'delete' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                Xóa tài khoản
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

    const [tab, setTab] = useState<TabType>('ALL');
    const [items, setItems] = useState<UserItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, newThisMonth: 0 });

    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('NEWEST');
    const [dateFilter, setDateFilter] = useState('');
    const [page, setPage] = useState(1);

    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

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

    useEffect(() => { if (isReady) load(); }, [isReady, load]);

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

    const verificationRate = stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0;
    const growthPct = stats.total > 0 ? Math.round((stats.newThisMonth / stats.total) * 100) : 0;

    return (
        <AdminLayout activeTab="/admin/users">
            <div className="p-6 min-h-screen" style={{ background: C.bg }}>

                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold mb-1" style={{ color: C.navy }}>Quản lý Người dùng</h1>
                    <p className="text-sm" style={{ color: C.gray }}>Xem và quản lý tất cả tài khoản người dùng trên hệ thống.</p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {[
                        { label: 'TỔNG NGƯỜI DÙNG', value: stats.total, sub: null, color: C.navy, icon: <Users className="w-4 h-4" /> },
                        { label: 'ĐÃ HOÀN THIỆN', value: stats.active, sub: `${verificationRate}% tổng số`, color: C.green, icon: <CheckCircle className="w-4 h-4" /> },
                        { label: 'CHƯA HOÀN THIỆN', value: stats.inactive, sub: `${100 - verificationRate}% tổng số`, color: C.yellow, icon: <AlertTriangle className="w-4 h-4" /> },
                        { label: 'THÁNG NÀY', value: stats.newThisMonth, sub: `+${growthPct}% tăng trưởng`, color: C.blue, icon: <Clock className="w-4 h-4" /> },
                    ].map(stat => (
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

                {/* Main Card */}
                <div className="bg-white rounded-2xl border mb-5" style={{ borderColor: C.border }}>

                    {/* Tabs — grouped with separators */}
                    <div className="flex items-center px-5 border-b overflow-x-auto" style={{ borderColor: C.border }}>
                        {TAB_GROUPS.map((group, gi) => (
                            <React.Fragment key={group.groupLabel}>
                                {gi > 0 && (
                                    <div className="mx-2 h-4 w-px flex-shrink-0" style={{ background: C.border }} />
                                )}
                                {group.tabs.map(t => (
                                    <button
                                        key={t.key}
                                        type="button"
                                        onClick={() => { setTab(t.key); setPage(1); }}
                                        className="px-3.5 py-4 text-sm font-medium relative transition-colors whitespace-nowrap"
                                        style={{
                                            color: tab === t.key ? C.orange : C.gray,
                                            borderBottom: tab === t.key ? `2px solid ${C.orange}` : '2px solid transparent',
                                            marginBottom: '-1px',
                                        }}
                                    >
                                        {t.label}
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
                                placeholder="Tìm theo tên, email hoặc SĐT..."
                                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border focus:outline-none"
                                style={{ borderColor: C.border, color: C.navy, fontFamily: 'Lexend, sans-serif' }}
                            />
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm" style={{ borderColor: C.border }}>
                            <Filter className="w-3.5 h-3.5" style={{ color: C.gray }} />
                            <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1); }} className="bg-transparent text-sm focus:outline-none cursor-pointer" style={{ color: C.navy, fontFamily: 'Lexend, sans-serif' }}>
                                <option value="NEWEST">Mới nhất</option>
                                <option value="OLDEST">Cũ nhất</option>
                                <option value="BALANCE_DESC">Số dư: Cao → Thấp</option>
                                <option value="REQUESTS_DESC">Yêu cầu: Nhiều nhất</option>
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
                            <span style={{ color: C.gray }}>Không tìm thấy người dùng nào.</span>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead style={{ background: C.bg }}>
                                    <tr>
                                        {['NGƯỜI DÙNG', 'SĐT', 'ĐĂNG NHẬP', 'SỐ DƯ VÍ', 'YÊU CẦU', 'NGÀY THAM GIA', 'HỒ SƠ', 'TÀI KHOẢN', ''].map(h => (
                                            <th key={h} className="text-left text-[10px] font-semibold tracking-wider px-4 py-3" style={{ color: C.gray }}>{h}</th>
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
                                                        <p className="text-sm font-semibold" style={{ color: C.navy }}>{user.fullName || <span style={{ color: C.gray }}>(Chưa cập nhật)</span>}</p>
                                                        <p className="text-xs" style={{ color: C.gray }}>{user.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-xs font-mono" style={{ color: C.navy }}>{user.phoneNumber || <span style={{ color: C.gray }}>—</span>}</td>
                                            <td className="px-4 py-3"><AuthBadge provider={user.authProvider} /></td>
                                            <td className="px-4 py-3 text-sm font-semibold" style={{ color: C.navy }}>
                                                {user.userWallet
                                                    ? `${user.userWallet.availableBalance.toLocaleString('vi-VN')}₫`
                                                    : user.providerWallet
                                                        ? `${user.providerWallet.availableBalance.toLocaleString('vi-VN')}₫`
                                                        : <span className="text-xs" style={{ color: C.gray }}>—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-semibold" style={{ color: C.navy }}>{user._count.rescueRequests}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-xs font-medium" style={{ color: C.navy }}>{new Date(user.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                                    {user.lastLogin && <span className="text-[10px]" style={{ color: C.gray }}>Login {new Date(user.lastLogin).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</span>}
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
                                                    title="Xem chi tiết"
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
                                Showing <span className="font-semibold" style={{ color: C.navy }}>{(page - 1) * PAGE_SIZE + 1}</span> to <span className="font-semibold" style={{ color: C.navy }}>{Math.min(page * PAGE_SIZE, sorted.length)}</span> of <span className="font-semibold" style={{ color: C.navy }}>{sorted.length}</span> users
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
