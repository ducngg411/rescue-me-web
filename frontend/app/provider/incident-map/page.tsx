'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useProviderGuard } from '@/lib/guards';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import ProviderLayout from '@/components/ProviderLayout';
import RescueMeLogo from '@/components/RescueMeLogo';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import AvatarImage from '@/components/AvatarImage';
import dynamic from 'next/dynamic';
import { IncidentMapDynamicFallback } from '@/components/IncidentMapDynamicFallback';

const IncidentMap = dynamic(() => import('@/components/IncidentMap'), {
    ssr: false,
    loading: () => <IncidentMapDynamicFallback />,
});

const C = {
    orange: '#f97316',
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#e2e8f0',
    bg: '#f4f6f9',
};

export default function ProviderIncidentMapPage() {
    const router = useRouter();
    const { isReady } = useProviderGuard();
    const { user } = useAuth();
    const { t } = useLanguage();

    const displayName = user?.name?.split(' ').slice(-1)[0] || user?.email?.split('@')[0] || 'Provider';

    if (!isReady) {
        return (
            <ProviderLayout activeTab="/provider/incident-map">
                <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
                    <div
                        className="w-10 h-10 rounded-full border-[3px] animate-spin"
                        style={{ borderColor: C.orange, borderTopColor: 'transparent' }}
                    />
                </div>
            </ProviderLayout>
        );
    }

    return (
        <ProviderLayout activeTab="/provider/incident-map">
            <div className="flex flex-col" style={{ height: 'calc(100dvh - 60px)' }}>
                <header
                    className="flex items-center justify-between px-4 py-3 flex-shrink-0 sticky top-0 z-20"
                    style={{ background: '#ffffff', borderBottom: `1px solid ${C.border}` }}
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            type="button"
                            onClick={() => router.push('/provider/active')}
                            className="flex md:hidden items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
                            style={{ color: C.navy }}
                            aria-label={t('common.back')}
                        >
                            <ArrowLeft style={{ width: 18, height: 18 }} />
                        </button>
                        <div className="flex md:hidden items-center gap-2 flex-shrink-0">
                            <RescueMeLogo size={24} textClass="hidden" />
                        </div>
                        <h2 className="hidden md:block text-base font-semibold truncate" style={{ color: C.navy }}>
                            {t('provider.nav.incidentMap')}
                        </h2>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="hidden sm:flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
                            <span className="text-xs font-medium" style={{ color: '#64748b' }}>
                                {t('common.systemOperational')}
                            </span>
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
                        className="flex-1 min-h-0"
                        compactToolbar
                    />
                </div>
            </div>
        </ProviderLayout>
    );
}
