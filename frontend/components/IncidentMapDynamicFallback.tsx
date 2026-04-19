'use client';

import { useLanguage } from '@/contexts/LanguageContext';

/** Used as `next/dynamic` loading UI so copy follows locale (hooks not allowed in inline `loading`). */
export function IncidentMapDynamicFallback() {
    const { t } = useLanguage();
    return (
        <div className="flex-1 flex items-center justify-center" style={{ background: '#f4f6f9' }}>
            <div className="text-center">
                <div
                    className="w-10 h-10 rounded-full border-[3px] animate-spin mx-auto mb-3"
                    style={{ borderColor: '#f97316', borderTopColor: 'transparent' }}
                />
                <p className="text-sm" style={{ color: '#6b7280' }}>
                    {t('user.incidentMap.loadingMap')}
                </p>
            </div>
        </div>
    );
}
