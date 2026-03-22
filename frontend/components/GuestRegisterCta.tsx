'use client';

import Link from 'next/link';
import { UserPlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface GuestRegisterCtaProps {
    compact?: boolean;
}

export default function GuestRegisterCta({ compact = false }: GuestRegisterCtaProps) {
    const { t } = useLanguage();
    const [dismissed, setDismissed] = useState(false);

    // Mini persistent footer strip (replaces full disappear on dismiss)
    if (dismissed) {
        return (
            <div className="flex items-center justify-center gap-1.5 py-1.5 px-3" style={{ borderTop: '1px solid #fde68a', background: '#fffbeb' }}>
                <UserPlusIcon className="h-3 w-3 flex-shrink-0" style={{ color: '#d97706' }} />
                <Link
                    href="/auth/register"
                    className="text-[11px] font-semibold underline"
                    style={{ color: '#b45309' }}
                >
                    {t('guest.cta.registerLink')} →
                </Link>
            </div>
        );
    }

    if (compact) {
        return (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <UserPlusIcon className="h-4 w-4 text-amber-600 flex-shrink-0" />
                    <span className="text-sm text-amber-800 truncate">
                        {t('guest.cta.banner')}{' '}
                        <Link href="/auth/register" className="font-semibold underline">
                            {t('guest.cta.registerLink')}
                        </Link>
                    </span>
                </div>
                <button
                    onClick={() => setDismissed(true)}
                    className="text-amber-600 hover:text-amber-800 flex-shrink-0"
                >
                    <XMarkIcon className="h-4 w-4" />
                </button>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <div className="bg-amber-100 rounded-full p-2 flex-shrink-0">
                <UserPlusIcon className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm text-amber-900 font-medium">{t('guest.cta.bannerFull')}</p>
                <div className="mt-2 flex items-center gap-3">
                    <Link
                        href="/auth/register"
                        className="text-sm bg-amber-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-amber-700 transition-colors"
                    >
                        {t('guest.cta.registerLink')}
                    </Link>
                </div>
            </div>
            <button
                onClick={() => setDismissed(true)}
                className="text-amber-400 hover:text-amber-600 flex-shrink-0 mt-0.5"
            >
                <XMarkIcon className="h-4 w-4" />
            </button>
        </div>
    );
}
