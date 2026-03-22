'use client';

import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import RescueMeLogo from '@/components/RescueMeLogo';

const C = {
    orange: '#f97316', orangeDark: '#ea6c0a', orangeLight: '#fff7ed',
    navy: '#1a1a2e', gray: '#6b7280', bg: '#f8fafc',
};

export default function PendingVerificationScreen() {
    const router = useRouter();
    const { t } = useLanguage();

    const bullets = [
        t('components.pendingVerification.bullets.waitingAdmin'),
        t('components.pendingVerification.bullets.emailNotice'),
        t('components.pendingVerification.bullets.startReceiving'),
    ];

    return (
        <div
            className="min-h-screen flex items-center justify-center p-4"
            style={{ background: C.bg, fontFamily: 'Lexend, sans-serif' }}
        >
            <div
                className="bg-white rounded-2xl p-8 max-w-sm w-full text-center"
                style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}
            >
                {/* Logo icon */}
                <div className="flex justify-center mb-5">
                    <RescueMeLogo size={56} showText={false} />
                </div>

                <h2 className="text-xl font-bold mb-2" style={{ color: C.navy }}>
                    {t('components.pendingVerification.title')}
                </h2>
                <p className="text-sm mb-1" style={{ color: C.gray }}>
                    {t('components.pendingVerification.message')}
                </p>
                <p className="text-sm font-bold mb-5" style={{ color: C.orange }}>
                    {t('components.pendingVerification.timeRange')}
                </p>

                {/* Bullet list */}
                <div className="space-y-2 mb-6 text-left">
                    {bullets.map(s => (
                        <div
                            key={s}
                            className="flex items-center gap-3 px-3 py-2 rounded-xl"
                            style={{ background: '#f8fafc' }}
                        >
                            <div
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ background: C.orange }}
                            />
                            <p className="text-xs" style={{ color: C.gray }}>{s}</p>
                        </div>
                    ))}
                </div>

                {/* Action */}
                <div className="flex flex-col gap-2">
                    <button
                        onClick={() => router.push('/provider/dashboard')}
                        className="w-full py-2.5 rounded-xl text-white text-sm font-semibold"
                        style={{ background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})` }}
                    >
                        {t('components.pendingVerification.viewStatus')}
                    </button>
                </div>
            </div>
        </div>
    );
}
