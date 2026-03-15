'use client';

import React, { useState, useEffect } from 'react';
import { Shield, User, AlertTriangle, CheckCircle, XCircle, Clock, Edit, Wallet, Power, Send } from 'lucide-react';
import api from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import { useProviderGuard } from '@/lib/guards';
import ProviderLayout from '@/components/ProviderLayout';
import toast from 'react-hot-toast';

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

const SERVICE_LABELS: Record<string, string> = {
    TOWING: 'Kéo xe', BATTERY_JUMP: 'Cứu bình', TIRE_CHANGE: 'Thay lốp',
    FUEL_DELIVERY: 'Tiếp nhiên liệu', LOCKOUT: 'Mở khóa xe', BREAKDOWN_REPAIR: 'Sửa tại chỗ',
};
const VEHICLE_LABELS: Record<string, string> = { CAR: 'Ô tô', MOTORCYCLE: 'Xe máy' };

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl border p-5 mb-4" style={{ borderColor: C.border }}>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b" style={{ borderColor: C.border }}>
                <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: C.orange }} />
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

export default function ProviderDashboard() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const verification = searchParams.get('verification');
    const isEdit = searchParams.get('edit') === 'true';
    const { isReady } = useProviderGuard();
    const [profile, setProfile] = useState<ProviderProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [walletBalance, setWalletBalance] = useState<number | null>(null);

    const MIN_DEPOSIT = 100_000;

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
                toast.success('Hồ sơ đã được cập nhật! Admin sẽ xét duyệt lại trong 24–48h.', {
                    duration: 6000,
                    id: 'provider-verification-submitted-edit',
                });
            } else {
                toast.success('Hồ sơ đã được gửi thành công! Admin sẽ xét duyệt trong 24–48h.', {
                    duration: 6000,
                    id: 'provider-verification-submitted',
                });
            }
            window.history.replaceState({}, '', '/provider/dashboard');
        }
    }, [verification, isEdit]);

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
                <p className="text-sm" style={{ color: C.gray }}>Không tìm thấy thông tin nhà cung cấp</p>
            </div>
        );
    }

    const status = profile.verificationStatus;

    return (
        <ProviderLayout activeTab="/provider/dashboard">
            <div className="min-h-screen py-8 px-4" style={{ background: C.bg, fontFamily: 'Poppins, sans-serif' }}>
                <div className="max-w-2xl mx-auto">
                    <h1 className="text-xl font-bold mb-6" style={{ color: C.navy }}>Hồ sơ &amp; Xác minh</h1>

                    {/* ── PENDING banner ── */}
                    {status === 'PENDING' && (
                        <div className="bg-white rounded-2xl border-2 p-5 mb-4 flex items-start gap-4" style={{ borderColor: '#fde68a', background: '#fffbeb' }}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#fef3c7' }}>
                                <Clock className="w-5 h-5" style={{ color: '#d97706' }} />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold mb-1" style={{ color: '#92400e' }}>Hồ sơ đang chờ xét duyệt</p>
                                <p className="text-xs leading-relaxed" style={{ color: '#b45309' }}>
                                    Chúng tôi đã nhận được hồ sơ của bạn và đang xem xét. Kết quả sẽ được thông báo qua email trong <strong>24–48 giờ</strong> làm việc.
                                </p>
                                {profile.submittedAt && (
                                    <p className="text-xs mt-2" style={{ color: '#b45309', opacity: 0.7 }}>
                                        Gửi lúc: {new Date(profile.submittedAt).toLocaleString('vi-VN')}
                                    </p>
                                )}
                                <div className="flex gap-2 mt-3">
                                    <button
                                        onClick={() => router.push('/provider/onboarding')}
                                        className="flex-1 py-2 rounded-xl text-xs font-semibold text-white"
                                        style={{ background: '#d97706' }}
                                    >
                                        Chỉnh sửa hồ sơ
                                    </button>
                                    <button
                                        onClick={() => window.open('mailto:support@rescueme.vn', '_blank')}
                                        className="flex-1 py-2 rounded-xl text-xs font-semibold border"
                                        style={{ color: '#92400e', borderColor: '#fde68a', background: 'white' }}
                                    >
                                        Liên hệ hỗ trợ
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── DRAFT banner ── */}
                    {status === 'DRAFT' && (
                        <div className="bg-white rounded-2xl border p-5 mb-4 flex items-start gap-4" style={{ borderColor: C.border }}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: C.orangeLight }}>
                                <Send className="w-5 h-5" style={{ color: C.orange }} />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold mb-1" style={{ color: C.navy }}>Hoàn thiện hồ sơ của bạn</p>
                                <p className="text-xs mb-3" style={{ color: C.gray }}>Hồ sơ chưa được gửi. Hoàn thành các bước để được xét duyệt và bắt đầu nhận yêu cầu cứu hộ.</p>
                                <button onClick={() => router.push('/provider/onboarding')}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all"
                                    style={{ background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})` }}>
                                    Tiếp tục hoàn thiện →
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── APPROVED banner ── */}
                    {status === 'APPROVED' && (
                        <div className="bg-white rounded-2xl border p-5 mb-4 flex items-start gap-4" style={{ borderColor: '#bbf7d0', background: '#f0fdf4' }}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#dcfce7' }}>
                                <CheckCircle className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm font-bold mb-0.5 text-green-800">Tài khoản đã được xác minh</p>
                                <p className="text-xs text-green-700">Bạn có thể bắt đầu nhận yêu cầu cứu hộ từ khách hàng.</p>
                            </div>
                        </div>
                    )}

                    {/* ── REJECTED banner ── */}
                    {status === 'REJECTED' && (
                        <div className="bg-white rounded-2xl border-2 p-5 mb-4" style={{ borderColor: '#fca5a5', background: '#fff5f5' }}>
                            <div className="flex items-start gap-3 mb-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#fee2e2' }}>
                                    <XCircle className="w-5 h-5" style={{ color: C.red }} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold mb-0.5" style={{ color: '#7f1d1d' }}>Hồ sơ bị từ chối</p>
                                    <p className="text-xs" style={{ color: '#991b1b' }}>Vui lòng xem lý do và cập nhật lại hồ sơ.</p>
                                </div>
                            </div>
                            {profile.rejectReasonCode && (
                                <div className="rounded-xl p-3 mb-3" style={{ background: '#fee2e280' }}>
                                    <p className="text-xs font-semibold mb-0.5" style={{ color: '#7f1d1d' }}>Lý do: {profile.rejectReasonCode}</p>
                                    {profile.rejectReasonDetail && <p className="text-xs" style={{ color: '#991b1b' }}>{profile.rejectReasonDetail}</p>}
                                    {profile.rejectedAt && <p className="text-[10px] mt-1" style={{ color: '#b91c1c', opacity: 0.7 }}>Từ chối lúc: {new Date(profile.rejectedAt).toLocaleString('vi-VN')}</p>}
                                </div>
                            )}
                            <button onClick={() => router.push('/provider/onboarding')}
                                className="w-full py-2 rounded-xl text-xs font-semibold text-white"
                                style={{ background: C.red }}>
                                <Edit className="w-3.5 h-3.5 inline mr-1.5" />Sửa và gửi lại hồ sơ
                            </button>
                        </div>
                    )}

                    {/* ── Provider info ── */}
                    <SectionCard title="Thông tin nhà cung cấp">
                        <Row label="Họ và tên" value={profile.fullName || 'Chưa cập nhật'} />
                        <Row label="Email" value={profile.email} />
                        <Row label="Số điện thoại" value={profile.phoneNumber || 'Chưa cập nhật'} />
                        <Row label="Loại nhà cung cấp" value={profile.providerType === 'INDIVIDUAL' ? 'Cá nhân' : 'Doanh nghiệp'} />
                        <Row label="Dịch vụ" value={profile.serviceTypes?.map(s => SERVICE_LABELS[s] || s).join(', ') || 'Chưa cập nhật'} />
                        <Row label="Phương tiện hỗ trợ" value={profile.supportedVehicleTypes?.map(v => VEHICLE_LABELS[v] || v).join(', ') || 'Chưa cập nhật'} />
                    </SectionCard>

                    {/* ── Wallet quick link (only for APPROVED) ── */}
                    {status === 'APPROVED' && (
                        <div className="bg-white rounded-2xl border p-4 mb-4 flex items-center gap-3 cursor-pointer hover:border-orange-300 transition-all"
                            style={{ borderColor: C.border }}
                            onClick={() => router.push('/provider/wallet')}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: C.orangeLight }}>
                                <Wallet className="w-5 h-5" style={{ color: C.orange }} />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-semibold" style={{ color: C.navy }}>Ví của tôi</p>
                                <p className="text-xs" style={{ color: C.gray }}>Xem số dư và lịch sử giao dịch</p>
                            </div>
                            <span className="text-xs font-semibold" style={{ color: C.orange }}>Xem →</span>
                        </div>
                    )}

                    {/* ── Deposit reminder (APPROVED + balance < 100k) ── */}
                    {status === 'APPROVED' && walletBalance !== null && walletBalance < MIN_DEPOSIT && (
                        <div
                            className="rounded-2xl p-4 mb-4 flex items-start gap-3"
                            style={{ background: '#fffbeb', border: '1.5px solid #fde68a' }}
                        >
                            <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ background: '#fef3c7' }}
                            >
                                <Wallet className="w-4 h-4" style={{ color: '#d97706' }} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold mb-0.5" style={{ color: '#92400e' }}>
                                    Nạp tiền để bắt đầu nhận việc
                                </p>
                                <p className="text-xs" style={{ color: '#b45309' }}>
                                    Cần ít nhất <strong>100.000 ₫</strong> trong ví
                                    {walletBalance > 0 && <> · Hiện có: <strong>{new Intl.NumberFormat('vi-VN').format(walletBalance)}₫</strong></>}
                                </p>
                            </div>
                            <button
                                onClick={() => router.push('/provider/wallet')}
                                className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold text-white"
                                style={{ background: '#d97706' }}
                            >
                                Nạp ngay →
                            </button>
                        </div>
                    )}

                    {/* ── Online/Offline toggle (only APPROVED) ── */}

                    <div className="bg-white rounded-2xl border p-5 mb-4" style={{ borderColor: C.border }}>
                        <div className="flex items-center gap-2 mb-4 pb-3 border-b" style={{ borderColor: C.border }}>
                            <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: C.orange }} />
                            <h2 className="text-sm font-bold" style={{ color: C.navy }}>Trạng thái hoạt động</h2>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium" style={{ color: C.navy }}>
                                    {status === 'APPROVED' ? (profile.isActive ? 'Đang online' : 'Đang offline') : 'Chưa được kích hoạt'}
                                </p>
                                <p className="text-xs mt-0.5" style={{ color: C.gray }}>
                                    {status === 'APPROVED' ? 'Bật để nhận yêu cầu cứu hộ từ khách' : 'Cần được xác minh trước khi có thể online'}
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
