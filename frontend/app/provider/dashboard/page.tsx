'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useProviderGuard } from '@/lib/guards';

interface ProviderProfile {
    id: string;
    fullName: string;
    email: string;
    phoneNumber: string;
    providerType: string;
    verificationStatus: string;
    submittedAt: string | null;
    rejectedAt: string | null;
    rejectReasonCode: string | null;
    rejectReasonDetail: string | null;
    isActive: boolean;
    serviceTypes: string[];
    supportedVehicleTypes: string[];
}

const STATUS_INFO = {
    DRAFT: {
        label: 'Bản nháp',
        color: 'gray',
        description: 'Hồ sơ chưa được gửi. Vui lòng hoàn thành và gửi hồ sơ xác minh.',
        action: 'Tiếp tục onboarding',
        actionLink: '/provider/onboarding',
    },
    PENDING: {
        label: 'Đang chờ xác minh',
        color: 'yellow',
        description: 'Hồ sơ của bạn đang được xem xét. Vui lòng đợi trong 1-3 ngày làm việc.',
        action: null,
        actionLink: null,
    },
    APPROVED: {
        label: 'Đã xác minh',
        color: 'green',
        description: 'Tài khoản của bạn đã được xác minh. Bạn có thể bắt đầu nhận yêu cầu cứu hộ.',
        action: null,
        actionLink: null,
    },
    REJECTED: {
        label: 'Bị từ chối',
        color: 'red',
        description: 'Hồ sơ của bạn đã bị từ chối. Vui lòng cập nhật thông tin và gửi lại.',
        action: 'Sửa và Gửi lại',
        actionLink: '/provider/onboarding',
    },
    SUSPENDED: {
        label: 'Tạm ngưng',
        color: 'red',
        description: 'Tài khoản của bạn đã bị tạm ngưng. Vui lòng liên hệ hỗ trợ.',
        action: null,
        actionLink: null,
    },
};

export default function ProviderDashboard() {
    const router = useRouter();
    const { isReady, status } = useProviderGuard();
    const [profile, setProfile] = useState<ProviderProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isReady) {
            loadProfile();
        }
    }, [isReady]);

    const loadProfile = async () => {
        try {
            const res = await api.get('/me/provider/profile');
            setProfile(res.data);
        } catch (err) {
            console.error('Failed to load profile:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleActive = async () => {
        if (!profile) return;

        // Only allow toggle if APPROVED
        if (profile.verificationStatus !== 'APPROVED') {
            alert('Bạn cần được xác minh trước khi có thể online/offline');
            return;
        }

        try {
            // TODO: Implement toggle active endpoint
            alert('Chức năng online/offline sẽ được triển khai sau');
        } catch (err) {
            console.error('Failed to toggle active:', err);
        }
    };

    if (!isReady || loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Đang tải...</p>
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-600">Không tìm thấy thông tin nhà cung cấp</p>
                </div>
            </div>
        );
    }

    const statusInfo = STATUS_INFO[profile.verificationStatus as keyof typeof STATUS_INFO] || STATUS_INFO.DRAFT;

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                <h1 className="text-3xl font-bold mb-8">Provider Dashboard</h1>

                {/* Verification Status Card */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold">Trạng thái xác minh</h2>
                        <span
                            className={`px-4 py-2 rounded-full text-sm font-medium ${statusInfo.color === 'green'
                                ? 'bg-green-100 text-green-700'
                                : statusInfo.color === 'yellow'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : statusInfo.color === 'red'
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-gray-100 text-gray-700'
                                }`}
                        >
                            {statusInfo.label}
                        </span>
                    </div>

                    <p className="text-gray-600 mb-4">{statusInfo.description}</p>

                    {/* Show rejection details if REJECTED */}
                    {profile.verificationStatus === 'REJECTED' && profile.rejectReasonCode && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                            <p className="font-medium text-red-800 mb-1">Lý do từ chối:</p>
                            <p className="text-sm text-red-700">
                                <strong>Mã:</strong> {profile.rejectReasonCode}
                            </p>
                            {profile.rejectReasonDetail && (
                                <p className="text-sm text-red-700 mt-1">
                                    <strong>Chi tiết:</strong> {profile.rejectReasonDetail}
                                </p>
                            )}
                            {profile.rejectedAt && (
                                <p className="text-xs text-red-600 mt-2">
                                    Từ chối lúc: {new Date(profile.rejectedAt).toLocaleString('vi-VN')}
                                </p>
                            )}
                        </div>
                    )}

                    {profile.submittedAt && (
                        <p className="text-sm text-gray-500 mb-4">
                            Gửi hồ sơ: {new Date(profile.submittedAt).toLocaleString('vi-VN')}
                        </p>
                    )}

                    {statusInfo.action && statusInfo.actionLink && (
                        <button
                            onClick={() => router.push(statusInfo.actionLink)}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            {statusInfo.action}
                        </button>
                    )}
                </div>

                {/* Profile Info Card */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-xl font-semibold mb-4">Thông tin nhà cung cấp</h2>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-gray-500">Họ và tên</p>
                            <p className="font-medium">{profile.fullName || 'Chưa cập nhật'}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Email</p>
                            <p className="font-medium">{profile.email}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Số điện thoại</p>
                            <p className="font-medium">{profile.phoneNumber || 'Chưa cập nhật'}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Loại nhà cung cấp</p>
                            <p className="font-medium">
                                {profile.providerType === 'INDIVIDUAL' ? 'Cá nhân' : 'Doanh nghiệp'}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Dịch vụ cung cấp</p>
                            <p className="font-medium">{profile.serviceTypes?.join(', ') || 'Chưa cập nhật'}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Phương tiện hỗ trợ</p>
                            <p className="font-medium">
                                {profile.supportedVehicleTypes?.join(', ') || 'Chưa cập nhật'}
                            </p>
                        </div>
                    </div>

                    {/* Only show edit button for REJECTED status */}
                    {profile.verificationStatus === 'REJECTED' && (
                        <button
                            onClick={() => router.push('/provider/onboarding')}
                            className="mt-4 px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                            Chỉnh sửa hồ sơ
                        </button>
                    )}
                </div>

                {/* Online/Offline Toggle */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-semibold mb-2">Trạng thái hoạt động</h2>
                            <p className="text-gray-600">
                                {profile.verificationStatus === 'APPROVED'
                                    ? 'Bật/tắt để nhận yêu cầu cứu hộ'
                                    : 'Bạn cần được xác minh trước khi có thể online'}
                            </p>
                        </div>
                        <button
                            onClick={handleToggleActive}
                            disabled={profile.verificationStatus !== 'APPROVED'}
                            className={`relative inline-flex h-12 w-24 items-center rounded-full transition-colors ${profile.isActive && profile.verificationStatus === 'APPROVED'
                                ? 'bg-green-600'
                                : 'bg-gray-300'
                                } ${profile.verificationStatus !== 'APPROVED' ? 'cursor-not-allowed opacity-50' : ''
                                }`}
                        >
                            <span
                                className={`inline-block h-10 w-10 transform rounded-full bg-white transition-transform ${profile.isActive ? 'translate-x-12' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
