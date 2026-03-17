'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AvatarImage from '@/components/AvatarImage';

export default function HomePage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Rescue Me</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <AvatarImage
                name={user.name || user.email}
                avatar={user.avatar}
                className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                fallbackBackground="#f97316"
                initialsCount={1}
              />
              <span className="text-sm font-medium text-gray-700">
                {user.name || user.email}
              </span>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Chào mừng đến với Rescue Me!
          </h2>

          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <p className="text-sm text-gray-600">Thông tin tài khoản:</p>
              <p className="text-lg font-medium">{user.name}</p>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>

            {user.profileCompleted ? (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <p className="text-sm text-green-800">
                  ✓ Hồ sơ của bạn đã hoàn tất
                </p>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <p className="text-sm text-yellow-800">
                  ⚠ Vui lòng hoàn thiện hồ sơ của bạn
                </p>
                <button
                  onClick={() => router.push('/auth/complete-profile')}
                  className="mt-2 px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700"
                >
                  Hoàn thiện ngay
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="border rounded-lg p-4 hover:shadow-md transition">
                <h3 className="font-semibold text-gray-900">Yêu cầu cứu hộ</h3>
                <p className="text-sm text-gray-600 mt-2">
                  Gửi yêu cầu cứu hộ khẩn cấp
                </p>
              </div>

              <div className="border rounded-lg p-4 hover:shadow-md transition">
                <h3 className="font-semibold text-gray-900">Lịch sử</h3>
                <p className="text-sm text-gray-600 mt-2">
                  Xem lịch sử yêu cầu cứu hộ
                </p>
              </div>

              <div className="border rounded-lg p-4 hover:shadow-md transition">
                <h3 className="font-semibold text-gray-900">Cài đặt</h3>
                <p className="text-sm text-gray-600 mt-2">
                  Quản lý thông tin cá nhân
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
