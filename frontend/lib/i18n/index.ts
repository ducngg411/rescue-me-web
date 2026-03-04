import vi from './vi';
import en from './en';

export type Locale = 'vi' | 'en';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const translations: Record<Locale, any> = {
    vi,
    en,
};

export type TranslationKeys = typeof vi;

export const defaultLocale: Locale = 'vi';

export const localeLabels: Record<Locale, string> = {
    vi: 'VI',
    en: 'EN',
};
