'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { TruckIcon, PhoneArrowUpRightIcon } from '@heroicons/react/24/outline';

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto" />
          <p className="mt-4 text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 to-red-800 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 text-center">
        <div className="bg-white/20 rounded-full p-5 mb-6">
          <TruckIcon className="h-14 w-14 text-white" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-2">Rescue Me</h1>
        <p className="text-red-100 text-lg mb-10">Cứu hộ khẩn cấp, nhanh chóng &amp; tin cậy</p>

        <div className="w-full max-w-sm space-y-4">
          {/* Guest CTA card */}
          <div className="bg-white rounded-2xl p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-gray-900 mb-1">{t('guest.landing.ctaTitle')}</h2>
            <p className="text-sm text-gray-500 mb-5">{t('guest.landing.ctaSubtitle')}</p>
            <Link
              href="/guest/rescue/new"
              className="flex items-center justify-center gap-2 w-full bg-red-600 text-white py-4 rounded-xl font-bold text-base hover:bg-red-700 transition-colors shadow-lg"
            >
              <PhoneArrowUpRightIcon className="h-5 w-5" />
              {t('guest.landing.ctaBtn')}
            </Link>
          </div>

          <div className="text-red-200 text-sm">{t('guest.landing.orLogin')}</div>

          <div className="flex gap-3">
            <Link
              href="/auth/login"
              className="flex-1 bg-white/20 text-white py-3 rounded-xl font-semibold hover:bg-white/30 transition-colors text-center"
            >
              Đăng nhập
            </Link>
            <Link
              href="/auth/register"
              className="flex-1 bg-white text-red-700 py-3 rounded-xl font-semibold hover:bg-red-50 transition-colors text-center"
            >
              Đăng ký
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
