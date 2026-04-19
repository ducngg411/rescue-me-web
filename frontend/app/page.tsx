'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import RescueMeLogo from '@/components/RescueMeLogo';

const orange = '#f97316';
const orangeDark = '#ea6c0a';
const navy = '#1a1a2e';
const gray = '#6b7280';

export default function HomePage() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'PROVIDER') {
        router.push('/provider');
      } else if (user.role === 'ADMIN') {
        router.push('/admin/dashboard');
      } else {
        router.push('/user');
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8fafc' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: orange }} />
          <p className="mt-4" style={{ color: gray }}>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f8fafc', fontFamily: 'Lexend, sans-serif' }}>
      {/* Language switcher */}
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <RescueMeLogo size={48} textClass="text-2xl" />
        </div>

        <p className="text-base mb-10 text-center" style={{ color: gray }}>
          {t('guest.landing.tagline')}
        </p>

        <div className="w-full max-w-sm space-y-4">
          {/* Guest CTA card */}
          <div
            className="bg-white rounded-2xl p-6"
            style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #f1f5f9' }}
          >
            <h2 className="text-lg font-bold mb-1" style={{ color: navy }}>
              {t('guest.landing.ctaTitle')}
            </h2>
            <p className="text-sm mb-5" style={{ color: gray }}>
              {t('guest.landing.ctaSubtitle')}
            </p>
            <Link
              href="/guest/rescue/new"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-base text-white transition-all active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${orange} 0%, ${orangeDark} 100%)` }}
              onMouseEnter={e => (e.currentTarget.style.background = `linear-gradient(135deg, ${orangeDark} 0%, #d4600a 100%)`)}
              onMouseLeave={e => (e.currentTarget.style.background = `linear-gradient(135deg, ${orange} 0%, ${orangeDark} 100%)`)}
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              {t('guest.landing.ctaBtn')}
            </Link>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: '#e5e7eb' }} />
            <span className="text-xs font-medium" style={{ color: '#9ca3af' }}>{t('guest.landing.orLogin')}</span>
            <div className="flex-1 h-px" style={{ background: '#e5e7eb' }} />
          </div>

          {/* Auth buttons */}
          <div className="flex gap-3">
            <Link
              href="/auth/login"
              className="flex-1 py-3 rounded-xl font-semibold text-center text-sm transition-all"
              style={{
                border: `1.5px solid ${navy}`,
                color: navy,
                background: 'white',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = navy;
                (e.currentTarget as HTMLAnchorElement).style.color = 'white';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = 'white';
                (e.currentTarget as HTMLAnchorElement).style.color = navy;
              }}
            >
              {t('auth.login.loginButton') || 'Đăng nhập'}
            </Link>
            <Link
              href="/auth/register"
              className="flex-1 py-3 rounded-xl font-semibold text-center text-sm text-white transition-all"
              style={{ background: navy }}
              onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = '#2d2d4e')}
              onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = navy)}
            >
              {t('auth.register.registerButton') || 'Đăng ký'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
