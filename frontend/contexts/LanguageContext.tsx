'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations, defaultLocale, type Locale } from '@/lib/i18n';
import type { TranslationKeys } from '@/lib/i18n/vi';

const STORAGE_KEY = 'rescue-me-locale';

// ── Nested key accessor ────────────────────────────────────────────────────────
// Allows calling t('auth.login.title') to get nested values
type PathsToLeaves<T> = T extends string
    ? []
    : {
        [K in keyof T]: [K, ...PathsToLeaves<T[K]>];
    }[keyof T];

type Join<T extends unknown[]> = T extends []
    ? never
    : T extends [infer F]
    ? F
    : T extends [infer F, ...infer R]
    ? F extends string
    ? `${F}.${Join<R> extends string ? Join<R> : never}`
    : never
    : string;

export type TranslationPath = Join<PathsToLeaves<TranslationKeys>>;

function getNestedValue(obj: any, path: string): string {
    return path.split('.').reduce((acc, key) => acc?.[key], obj) ?? path;
}

// ── Context ────────────────────────────────────────────────────────────────────
interface LanguageContextValue {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: (path: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────────
export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>(() => {
        // Initialize synchronously from localStorage so language is consistent
        // across all pages from the very first render (no flash)
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
            if (saved === 'vi' || saved === 'en') return saved;
        }
        return defaultLocale;
    });

    // Update <html lang> whenever locale changes
    useEffect(() => {
        if (typeof document !== 'undefined') {
            document.documentElement.lang = locale;
        }
    }, [locale]);

    const setLocale = useCallback((next: Locale) => {
        setLocaleState(next);
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, next);
        }
    }, []);

    const t = useCallback(
        (path: string, params?: Record<string, string | number>): string => {
            let str = getNestedValue(translations[locale], path);
            if (params && typeof str === 'string') {
                Object.entries(params).forEach(([key, value]) => {
                    str = str.replace(new RegExp(`{${key}}`, 'g'), String(value));
                });
            }
            return str;
        },
        [locale],
    );

    return (
        <LanguageContext.Provider value={{ locale, setLocale, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useLanguage() {
    const ctx = useContext(LanguageContext);
    if (!ctx) throw new Error('useLanguage must be used inside <LanguageProvider>');
    return ctx;
}
