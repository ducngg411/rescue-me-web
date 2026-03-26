'use client';

import { useRouter } from 'next/navigation';

const C = {
    orange: '#f97316', orangeDark: '#ea6c0a', orangeLight: '#fff7ed',
    navy: '#1a1a2e', gray: '#6b7280', bg: '#f8fafc', green: '#16a34a',
};

const MIN_DEPOSIT = 100_000;

function fmtVnd(n: number) {
    return new Intl.NumberFormat('vi-VN').format(n) + ' ₫';
}

interface DepositGateScreenProps {
    currentBalance: number;
}

export default function DepositGateScreen({ currentBalance }: DepositGateScreenProps) {
    const router = useRouter();
    const needed = Math.max(0, MIN_DEPOSIT - currentBalance);
    const commissionRatePct = Math.round((Number(process.env.NEXT_PUBLIC_COMMISSION_RATE) || 0.2) * 100);

    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center p-4"
            style={{ background: C.bg, fontFamily: 'Lexend, sans-serif' }}
        >
            {/* Card */}
            <div
                className="bg-white rounded-3xl w-full max-w-sm"
                style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.10)' }}
            >
                {/* Hero */}
                <div
                    className="rounded-t-3xl px-6 pt-8 pb-6 text-center"
                    style={{ background: `linear-gradient(145deg, ${C.navy} 0%, #2d2d4e 100%)` }}
                >
                    {/* Checkmark badge */}
                    <div
                        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                        style={{ background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.4)' }}
                    >
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                            <path d="M20 6L9 17l-5-5" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <span
                        className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-3"
                        style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}
                    >
                        Hồ sơ đã được duyệt ✓
                    </span>
                    <h1 className="text-xl font-bold text-white mb-1">Chỉ còn 1 bước nữa!</h1>
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                        Tài khoản của bạn đã được xác minh thành công
                    </p>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">

                    {/* Policy card */}
                    <div
                        className="rounded-2xl p-4"
                        style={{ background: C.orangeLight, border: `1.5px solid #fed7aa` }}
                    >
                        <p className="text-xs font-bold mb-2" style={{ color: '#9a3412' }}>
                            Chính sách ký quỹ hoạt động
                        </p>
                        <div className="space-y-1.5">
                            {[
                                `Mỗi đơn hoàn thành, hệ thống trừ ${commissionRatePct}% hoa hồng từ ví`,
                                'Số dư tối thiểu đảm bảo bạn có thể nhận đơn liên tục',
                                'Khi số dư xuống thấp, bạn sẽ được nhắc nạp thêm',
                            ].map(s => (
                                <div key={s} className="flex items-start gap-2">
                                    <div
                                        className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                                        style={{ background: C.orange }}
                                    />
                                    <p className="text-xs leading-relaxed" style={{ color: '#92400e' }}>{s}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Amount required */}
                    <div
                        className="rounded-2xl p-4 flex items-center justify-between"
                        style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0' }}
                    >
                        <div>
                            <p className="text-xs" style={{ color: C.gray }}>Số dư tối thiểu yêu cầu</p>
                            <p className="text-xl font-bold" style={{ color: C.navy }}>{fmtVnd(MIN_DEPOSIT)}</p>
                        </div>
                        {currentBalance > 0 && (
                            <div className="text-right">
                                <p className="text-xs" style={{ color: C.gray }}>Số dư hiện tại</p>
                                <p className="text-sm font-semibold" style={{ color: C.orange }}>{fmtVnd(currentBalance)}</p>
                                <p className="text-[10px] mt-0.5" style={{ color: '#ef4444' }}>
                                    Cần thêm {fmtVnd(needed)}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* CTAs */}
                    <button
                        onClick={() => router.push('/provider/wallet')}
                        className="w-full py-3.5 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                        style={{
                            background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`,
                            boxShadow: `0 6px 20px ${C.orange}50`,
                        }}
                    >
                        Nạp tiền vào ví ngay
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M5 12h14M12 5l7 7-7 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>

                    <a
                        href="https://rescueme.vn/chinh-sach-hoa-hong"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-center text-xs py-1"
                        style={{ color: C.gray }}
                    >
                        Tìm hiểu thêm về chính sách hoa hồng →
                    </a>
                </div>
            </div>

            {/* Bottom note */}
            <p className="mt-6 text-xs text-center max-w-xs" style={{ color: '#94a3b8' }}>

            </p>
        </div>
    );
}
