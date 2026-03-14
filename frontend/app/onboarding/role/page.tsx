'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { selectRole } from '@/lib/auth';

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

export default function RoleSelectionPage() {
    const router = useRouter();
    const { user, loading, refreshUser } = useAuth();
    const [selectedRole, setSelectedRole] = useState<'USER' | 'PROVIDER' | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!loading && !user) {
            router.push('/auth/login');
            return;
        }
        if (user && user.profileCompleted) {
            router.push('/');
            return;
        }
    }, [user, loading, router]);

    const handleContinue = async () => {
        if (!selectedRole) {
            setError('Vui lòng chọn vai trò của bạn');
            return;
        }
        setIsSubmitting(true);
        setError('');
        try {
            await selectRole(selectedRole);
            await refreshUser();
            if (selectedRole === 'USER') {
                router.push('/onboarding/user-profile');
            } else {
                router.push('/provider/onboarding');
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg, fontFamily: 'Poppins, sans-serif' }}>
                <div className="text-center">
                    <div className="w-10 h-10 rounded-full border-[3px] border-t-transparent animate-spin mx-auto mb-3"
                        style={{ borderColor: C.orange, borderTopColor: 'transparent' }} />
                    <p className="text-sm" style={{ color: C.gray }}>Đang tải...</p>
                </div>
            </div>
        );
    }

    if (!user || user.profileCompleted) return null;

    return (
        <div className="min-h-screen flex" style={{ background: C.bg, fontFamily: 'Poppins, sans-serif' }}>
            {/* Left decorative panel */}
            <div
                className="hidden lg:flex flex-col justify-between p-12 w-[420px] flex-shrink-0"
                style={{ background: `linear-gradient(155deg, ${C.navy} 0%, #2d2d4e 100%)` }}
            >
                {/* Logo */}
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: C.orange }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2L4 7v10l8 5 8-5V7L12 2z" fill="white" opacity="0.9" />
                        </svg>
                    </div>
                    <span className="text-white font-bold text-lg tracking-tight">RescueMe</span>
                </div>

                {/* Illustration area */}
                <div className="space-y-6">
                    {/* User card preview */}
                    <div className="bg-white/10 backdrop-blur rounded-2xl p-5 border border-white/10">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: C.orange }}>
                                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-white text-sm font-semibold">Người Dùng</p>
                                <p className="text-white/60 text-xs">Yêu cầu cứu hộ</p>
                            </div>
                        </div>
                        <p className="text-white/70 text-xs leading-relaxed">Gọi cứu hộ trong vài giây khi xe gặp sự cố trên đường.</p>
                    </div>

                    {/* Provider card preview */}
                    <div className="bg-white/10 backdrop-blur rounded-2xl p-5 border border-white/10">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#16a34a' }}>
                                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-white text-sm font-semibold">Nhà Cung Cấp</p>
                                <p className="text-white/60 text-xs">Cung cấp dịch vụ</p>
                            </div>
                        </div>
                        <p className="text-white/70 text-xs leading-relaxed">Nhận yêu cầu, cung cấp báo giá và hoàn thành công việc cứu hộ.</p>
                    </div>
                </div>

                {/* Footer text */}
                <p className="text-white/40 text-xs">© 2024 RescueMe. All rights reserved.</p>
            </div>

            {/* Right form panel */}
            <div className="flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="flex items-center gap-2 mb-8 lg:hidden">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.orange }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path d="M12 2L4 7v10l8 5 8-5V7L12 2z" fill="white" opacity="0.9" />
                            </svg>
                        </div>
                        <span className="font-bold text-base" style={{ color: C.navy }}>RescueMe</span>
                    </div>

                    {/* Heading */}
                    <div className="mb-8">
                        <h1 className="text-2xl font-bold mb-2" style={{ color: C.navy }}>Chào mừng! 👋</h1>
                        <p className="text-sm" style={{ color: C.gray }}>Bạn muốn sử dụng RescueMe với tư cách nào?</p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-5 flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm"
                            style={{ background: '#fef2f2', color: C.red, border: `1px solid #fecaca` }}>
                            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="flex-shrink-0">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {error}
                        </div>
                    )}

                    {/* Role Cards */}
                    <div className="space-y-3 mb-8">
                        {/* USER card */}
                        <button
                            onClick={() => setSelectedRole('USER')}
                            disabled={isSubmitting}
                            className="w-full relative text-left p-5 rounded-2xl border-2 transition-all duration-200 group"
                            style={{
                                borderColor: selectedRole === 'USER' ? C.orange : C.border,
                                background: selectedRole === 'USER' ? C.orangeLight : '#ffffff',
                            }}
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                                    style={{ background: selectedRole === 'USER' ? C.orange : C.bg }}>
                                    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke={selectedRole === 'USER' ? 'white' : C.gray} strokeWidth={1.8}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold mb-0.5" style={{ color: C.navy }}>Người Dùng</p>
                                    <p className="text-xs" style={{ color: C.gray }}>Tôi cần sử dụng dịch vụ cứu hộ khi gặp sự cố</p>
                                </div>
                                {/* Selection indicator */}
                                <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                                    style={{
                                        borderColor: selectedRole === 'USER' ? C.orange : C.border,
                                        background: selectedRole === 'USER' ? C.orange : 'transparent',
                                    }}>
                                    {selectedRole === 'USER' && (
                                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                            <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    )}
                                </div>
                            </div>

                            {/* Features */}
                            {selectedRole === 'USER' && (
                                <div className="mt-4 pt-4 border-t border-orange-200 grid grid-cols-2 gap-2">
                                    {['Gọi cứu hộ tức thì', 'Theo dõi realtime', 'Thanh toán an toàn', 'Đánh giá dịch vụ'].map(f => (
                                        <div key={f} className="flex items-center gap-1.5">
                                            <svg width="12" height="12" fill={C.orange} viewBox="0 0 24 24">
                                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
                                            </svg>
                                            <span className="text-[11px]" style={{ color: C.orange }}>{f}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </button>

                        {/* PROVIDER card */}
                        <button
                            onClick={() => setSelectedRole('PROVIDER')}
                            disabled={isSubmitting}
                            className="w-full relative text-left p-5 rounded-2xl border-2 transition-all duration-200 group"
                            style={{
                                borderColor: selectedRole === 'PROVIDER' ? C.orange : C.border,
                                background: selectedRole === 'PROVIDER' ? C.orangeLight : '#ffffff',
                            }}
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                                    style={{ background: selectedRole === 'PROVIDER' ? C.orange : C.bg }}>
                                    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke={selectedRole === 'PROVIDER' ? 'white' : C.gray} strokeWidth={1.8}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold mb-0.5" style={{ color: C.navy }}>Nhà Cung Cấp Dịch Vụ</p>
                                    <p className="text-xs" style={{ color: C.gray }}>Tôi cung cấp dịch vụ cứu hộ và muốn kiếm thu nhập</p>
                                </div>
                                <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                                    style={{
                                        borderColor: selectedRole === 'PROVIDER' ? C.orange : C.border,
                                        background: selectedRole === 'PROVIDER' ? C.orange : 'transparent',
                                    }}>
                                    {selectedRole === 'PROVIDER' && (
                                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                            <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    )}
                                </div>
                            </div>

                            {/* Features */}
                            {selectedRole === 'PROVIDER' && (
                                <div className="mt-4 pt-4 border-t border-orange-200 grid grid-cols-2 gap-2">
                                    {['Nhận lệnh gần bạn', 'Báo giá linh hoạt', 'Ví điện tử tích hợp', 'Xếp hạng uy tín'].map(f => (
                                        <div key={f} className="flex items-center gap-1.5">
                                            <svg width="12" height="12" fill={C.orange} viewBox="0 0 24 24">
                                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
                                            </svg>
                                            <span className="text-[11px]" style={{ color: C.orange }}>{f}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </button>
                    </div>

                    {/* CTA Button */}
                    <button
                        onClick={handleContinue}
                        disabled={!selectedRole || isSubmitting}
                        className="w-full py-3.5 rounded-2xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all"
                        style={{
                            background: !selectedRole || isSubmitting
                                ? C.border
                                : `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)`,
                            cursor: !selectedRole || isSubmitting ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                                <span>Đang xử lý...</span>
                            </>
                        ) : (
                            <>
                                <span>Tiếp Tục</span>
                                <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>

                    <p className="text-center text-xs mt-5" style={{ color: C.gray }}>
                        Bạn có thể cập nhật thông tin chi tiết ở bước tiếp theo
                    </p>
                </div>
            </div>
        </div>
    );
}
