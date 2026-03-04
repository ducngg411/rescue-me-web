'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import type { Locale } from '@/lib/i18n';

const locales: Locale[] = ['vi', 'en'];

interface LanguageSwitcherProps {
    /** Style variant for different contexts */
    variant?: 'pill' | 'text';
    className?: string;
}

export default function LanguageSwitcher({ variant = 'pill', className = '' }: LanguageSwitcherProps) {
    const { locale, setLocale } = useLanguage();

    if (variant === 'text') {
        return (
            <div className={`flex items-center gap-1 ${className}`}>
                {locales.map((l, i) => (
                    <span key={l} className="flex items-center">
                        <button
                            onClick={() => setLocale(l)}
                            className="text-xs font-semibold transition-colors"
                            style={{
                                color: locale === l ? '#f97316' : '#94a3b8',
                                textDecoration: locale === l ? 'underline' : 'none',
                            }}
                        >
                            {l.toUpperCase()}
                        </button>
                        {i < locales.length - 1 && (
                            <span className="text-xs mx-1" style={{ color: '#d1d5db' }}>|</span>
                        )}
                    </span>
                ))}
            </div>
        );
    }

    return (
        <div
            className={`flex items-center gap-0.5 p-0.5 rounded-lg ${className}`}
            style={{ background: '#f1f5f9' }}
        >
            {locales.map((l) => (
                <button
                    key={l}
                    onClick={() => setLocale(l)}
                    className="px-2.5 py-1 rounded-md text-xs font-semibold transition-all"
                    style={{
                        background: locale === l ? '#ffffff' : 'transparent',
                        color: locale === l ? '#f97316' : '#94a3b8',
                        boxShadow: locale === l ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    }}
                >
                    {l.toUpperCase()}
                </button>
            ))}
        </div>
    );
}
