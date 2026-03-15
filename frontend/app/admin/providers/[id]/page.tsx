'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft, User, Phone, Mail, MapPin, Briefcase, Car, Bike, FileText,
    Image as ImageIcon, CheckCircle, XCircle, AlertTriangle, Loader2, Shield,
    History, Save
} from 'lucide-react';
import { useAdminGuard } from '@/lib/guards';
import { adminApi } from '@/lib/api';
import AdminLayout from '@/components/AdminLayout';
import toast from 'react-hot-toast';

interface ProviderDetail {
    id: string;
    fullName: string;
    phoneNumber: string;
    email: string;
    providerType: 'INDIVIDUAL' | 'BUSINESS';
    businessName?: string;
    serviceTypes: string[];
    supportedVehicleTypes: string[];
    serviceRadiusKm: number;
    permanentAddress?: {
        addressText: string;
        lat: number;
        lng: number;
    };
    businessAddress?: {
        addressText: string;
        lat: number;
        lng: number;
    };
    rescueVehicles?: Array<{
        type: 'CAR' | 'MOTORCYCLE';
        plateNumber: string;
        isPrimary: boolean;
    }>;
    verificationStatus: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
    submittedAt: string | null;
    rejectedAt: string | null;
    rejectReasonCode: string | null;
    rejectReasonDetail: string | null;
    uploads: Array<{
        id: string;
        docType: string;
        publicUrl: string;
        uploadedAt: string;
    }>;
}

interface HistoryEntry {
    id: string;
    action: string;
    performedBy: string;
    performedAt: string;
    fromStatus: string;
    toStatus: string;
    reason?: string;
    reasonDetail?: string;
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
    TOWING: 'Kéo xe',
    BATTERY_JUMP: 'Cứu hộ bình điện',
    TIRE_CHANGE: 'Thay lốp xe',
    FUEL_DELIVERY: 'Tiếp nhiên liệu',
    LOCKOUT: 'Mở khóa xe',
    BREAKDOWN_REPAIR: 'Sửa chữa tại chỗ',
};

const DOC_TYPE_LABELS: Record<string, string> = {
    CITIZEN_ID_FRONT: 'CCCD mặt trước',
    CITIZEN_ID_BACK: 'CCCD mặt sau',
    SELFIE: 'Ảnh selfie với CCCD',
    CAR_PHOTO: 'Ảnh xe ô tô',
    MOTORBIKE_PHOTO: 'Ảnh xe máy',
    DRIVER_LICENSE: 'Bằng lái xe',
    BUSINESS_REGISTRATION: 'Giấy phép kinh doanh',
};

const REJECT_REASONS = [
    { code: 'INVALID_ID', label: 'CCCD không hợp lệ' },
    { code: 'BLURRY_PHOTO', label: 'Ảnh mờ, không rõ' },
    { code: 'MISSING_DOCS', label: 'Thiếu giấy tờ' },
    { code: 'INVALID_PLATE', label: 'Biển số không rõ/không hợp lệ' },
    { code: 'INVALID_LICENSE', label: 'Bằng lái/Giấy phép không hợp lệ' },
    { code: 'OTHER', label: 'Lý do khác' },
];

export default function ProviderDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { isReady } = useAdminGuard();
    const [providerId, setProviderId] = useState<string>('');
    const [provider, setProvider] = useState<ProviderDetail | null>(null);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');

    // Reject modal state
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [rejectDetail, setRejectDetail] = useState('');
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    useEffect(() => {
        params.then(p => setProviderId(p.id));
    }, [params]);

    useEffect(() => {
        if (isReady && providerId) {
            loadProvider();
            loadHistory();
        }
    }, [isReady, providerId]);

    const loadProvider = async () => {
        try {
            setLoading(true);
            const data = await adminApi.getProviderDetail(providerId);
            setProvider(data);
        } catch (err: any) {
            console.error('Failed to load provider:', err);
            setError('Không thể tải thông tin nhà cung cấp');
        } finally {
            setLoading(false);
        }
    };

    const loadHistory = async () => {
        try {
            const data = await adminApi.getProviderHistory(providerId);
            setHistory(data);
        } catch (err) {
            console.error('Failed to load history:', err);
        }
    };

    const handleApprove = async () => {
        if (!window.confirm('Xác nhận duyệt hồ sơ này?')) return;

        try {
            setActionLoading(true);
            setError('');
            await adminApi.approveProvider(providerId);
            await loadProvider();
            await loadHistory();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Có lỗi xảy ra khi duyệt hồ sơ');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!rejectReason) {
            toast.error('Vui lòng chọn lý do từ chối');
            return;
        }
        if (!rejectDetail.trim()) {
            toast.error('Vui lòng nhập mô tả chi tiết');
            return;
        }

        try {
            setActionLoading(true);
            setError('');
            await adminApi.rejectProvider(providerId, {
                rejectReasonCode: rejectReason,
                rejectReasonDetail: rejectDetail,
            });
            setShowRejectModal(false);
            setRejectReason('');
            setRejectDetail('');
            await loadProvider();
            await loadHistory();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Có lỗi xảy ra khi từ chối hồ sơ');
        } finally {
            setActionLoading(false);
        }
    };

    const handleSuspend = async () => {
        const reason = window.prompt('Nhập lý do khóa tài khoản:');
        if (!reason) return;

        try {
            setActionLoading(true);
            setError('');
            await adminApi.suspendProvider(providerId, reason);
            await loadProvider();
            await loadHistory();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Có lỗi xảy ra khi khóa tài khoản');
        } finally {
            setActionLoading(false);
        }
    };

    const handleUnsuspend = async () => {
        if (!window.confirm('Xác nhận mở khóa tài khoản này?')) return;

        try {
            setActionLoading(true);
            setError('');
            await adminApi.unsuspendProvider(providerId);
            await loadProvider();
            await loadHistory();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Có lỗi xảy ra khi mở khóa tài khoản');
        } finally {
            setActionLoading(false);
        }
    };

    if (!isReady || loading) {
        return (
            <AdminLayout activeTab="/admin/providers">
                <div className="min-h-screen flex items-center justify-center" style={{ background: '#f4f6f9' }}>
                    <div className="text-center">
                        <div className="w-10 h-10 rounded-full border-[3px] border-t-transparent animate-spin mx-auto mb-3" style={{ borderColor: '#f97316', borderTopColor: 'transparent' }} />
                        <p className="mt-4 text-sm text-gray-600">Đang tải...</p>
                    </div>
                </div>
            </AdminLayout>
        );
    }

    if (error && !provider) {
        return (
            <AdminLayout activeTab="/admin/providers">
                <div className="min-h-screen flex items-center justify-center" style={{ background: '#f4f6f9' }}>
                    <div className="text-center">
                        <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-3" />
                        <p className="text-gray-900">{error}</p>
                        <button
                            onClick={() => router.back()}
                            className="mt-4 px-4 py-2 text-sm font-medium hover:underline" style={{ color: '#f97316' }}
                        >
                            Quay lại
                        </button>
                    </div>
                </div>
            </AdminLayout>
        );
    }

    if (!provider) return null;

    const requiredDocs = ['CITIZEN_ID_FRONT', 'CITIZEN_ID_BACK', 'SELFIE'];
    if (provider.supportedVehicleTypes.includes('CAR')) requiredDocs.push('CAR_PHOTO');
    if (provider.supportedVehicleTypes.includes('MOTORCYCLE')) requiredDocs.push('MOTORBIKE_PHOTO');

    const optionalDocs = ['DRIVER_LICENSE', 'BUSINESS_REGISTRATION'];

    return (
        <AdminLayout activeTab="/admin/providers">
            <div className="min-h-screen py-8" style={{ background: '#f4f6f9' }}>
                <div className="max-w-5xl mx-auto px-4">
                    {/* Header */}
                    <div className="mb-6">
                        <button
                            onClick={() => router.back()}
                            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Quay lại danh sách
                        </button>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h1 className="text-3xl font-semibold text-gray-900">{provider.fullName}</h1>
                                {provider.businessName && (
                                    <p className="text-lg text-gray-600 mt-1">{provider.businessName}</p>
                                )}
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                {provider.verificationStatus === 'PENDING' && (
                                    <span className="flex items-center gap-1.5 px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg text-sm font-medium">
                                        <AlertTriangle className="w-4 h-4" />
                                        Chờ duyệt
                                    </span>
                                )}
                                {provider.verificationStatus === 'APPROVED' && (
                                    <span className="flex items-center gap-1.5 px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                                        <CheckCircle className="w-4 h-4" />
                                        Đã duyệt
                                    </span>
                                )}
                                {provider.verificationStatus === 'REJECTED' && (
                                    <span className="flex items-center gap-1.5 px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium">
                                        <XCircle className="w-4 h-4" />
                                        Bị từ chối
                                    </span>
                                )}
                                {provider.verificationStatus === 'SUSPENDED' && (
                                    <span className="flex items-center gap-1.5 px-4 py-2 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium">
                                        <AlertTriangle className="w-4 h-4" />
                                        Bị khóa
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Error Alert */}
                    {error && (
                        <div className="mb-6 border-l-4 border-red-500 bg-red-50 rounded-r-lg p-4">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Service Info Section */}
                    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                        <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-blue-600">
                            <Briefcase className="w-5 h-5 text-blue-600" />
                            <h2 className="text-lg font-semibold text-gray-900">Thông tin dịch vụ</h2>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="font-medium text-gray-900">Họ và tên</p>
                                <p className="text-gray-700 mt-1">{provider.fullName}</p>
                            </div>
                            <div>
                                <p className="font-medium text-gray-900">Số điện thoại</p>
                                <p className="text-gray-700 mt-1">{provider.phoneNumber}</p>
                            </div>
                            <div>
                                <p className="font-medium text-gray-900">Email</p>
                                <p className="text-gray-700 mt-1">{provider.email}</p>
                            </div>
                            <div>
                                <p className="font-medium text-gray-900">Loại nhà cung cấp</p>
                                <p className="text-gray-700 mt-1">
                                    {provider.providerType === 'INDIVIDUAL' ? 'Cá nhân' : 'Doanh nghiệp'}
                                </p>
                            </div>
                            {provider.businessName && (
                                <div>
                                    <p className="font-medium text-gray-900">Tên doanh nghiệp</p>
                                    <p className="text-gray-700 mt-1">{provider.businessName}</p>
                                </div>
                            )}
                            <div>
                                <p className="font-medium text-gray-900">Bán kính phục vụ</p>
                                <p className="text-gray-700 mt-1">{provider.serviceRadiusKm} km</p>
                            </div>
                            <div className="md:col-span-2">
                                <p className="font-medium text-gray-900">Địa chỉ</p>
                                <div className="flex items-start gap-2 mt-1">
                                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                    <p className="text-gray-700">
                                        {provider.providerType === 'INDIVIDUAL'
                                            ? provider.permanentAddress?.addressText
                                            : provider.businessAddress?.addressText}
                                    </p>
                                </div>
                            </div>
                            {provider.rescueVehicles && provider.rescueVehicles.length > 0 && (
                                <div className="md:col-span-2">
                                    <p className="font-medium text-gray-900 mb-2">Phương tiện cứu hộ</p>
                                    <div className="space-y-2">
                                        {provider.rescueVehicles.map((vehicle, index) => (
                                            <div key={index} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg">
                                                {vehicle.type === 'CAR' ? <Car className="w-4 h-4 text-gray-600" /> : <Bike className="w-4 h-4 text-gray-600" />}
                                                <span className="text-sm font-medium text-gray-700">
                                                    {vehicle.type === 'CAR' ? 'Ô tô' : 'Xe máy'}:
                                                </span>
                                                <span className="text-sm text-gray-900 font-mono">{vehicle.plateNumber}</span>
                                                {vehicle.isPrimary && (
                                                    <span className="ml-auto text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">Chính</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="md:col-span-2">
                                <p className="font-medium text-gray-900 mb-2">Dịch vụ cung cấp</p>
                                <div className="flex flex-wrap gap-2">
                                    {provider.serviceTypes.map((service) => (
                                        <span key={service} className="px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-lg">
                                            {SERVICE_TYPE_LABELS[service]}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <p className="font-medium text-gray-900 mb-2">Phương tiện hỗ trợ</p>
                                <div className="flex flex-wrap gap-2">
                                    {provider.supportedVehicleTypes.map((vehicle) => (
                                        <span key={vehicle} className="px-3 py-1 bg-green-50 text-green-700 text-sm rounded-lg flex items-center gap-1.5">
                                            {vehicle === 'CAR' ? <Car className="w-4 h-4" /> : <Bike className="w-4 h-4" />}
                                            {vehicle === 'CAR' ? 'Ô tô' : 'Xe máy'}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Required Documents Section */}
                    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                        <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-blue-600">
                            <FileText className="w-5 h-5 text-blue-600" />
                            <h2 className="text-lg font-semibold text-gray-900">Giấy tờ bắt buộc</h2>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            {requiredDocs.map((docType) => {
                                const upload = provider.uploads.find(u => u.docType === docType);
                                return (
                                    <div key={docType} className="border border-gray-200 rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-sm font-medium text-gray-900">{DOC_TYPE_LABELS[docType]}</p>
                                            {upload ? (
                                                <CheckCircle className="w-5 h-5 text-green-600" />
                                            ) : (
                                                <XCircle className="w-5 h-5 text-red-600" />
                                            )}
                                        </div>
                                        {upload ? (
                                            <div
                                                onClick={() => setSelectedImage(upload.publicUrl)}
                                                className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-90"
                                            >
                                                <img
                                                    src={upload.publicUrl}
                                                    alt={DOC_TYPE_LABELS[docType]}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        ) : (
                                            <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                                                <div className="text-center">
                                                    <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                                                    <p className="text-xs text-gray-500">Chưa tải lên</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Optional Documents Section */}
                    {provider.uploads.some(u => optionalDocs.includes(u.docType)) && (
                        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                            <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-blue-600">
                                <FileText className="w-5 h-5 text-blue-600" />
                                <h2 className="text-lg font-semibold text-gray-900">Giấy tờ bổ sung</h2>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                {optionalDocs.map((docType) => {
                                    const upload = provider.uploads.find(u => u.docType === docType);
                                    if (!upload) return null;

                                    return (
                                        <div key={docType} className="border border-gray-200 rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-sm font-medium text-gray-900">{DOC_TYPE_LABELS[docType]}</p>
                                                <CheckCircle className="w-5 h-5 text-green-600" />
                                            </div>
                                            <div
                                                onClick={() => setSelectedImage(upload.publicUrl)}
                                                className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-90"
                                            >
                                                <img
                                                    src={upload.publicUrl}
                                                    alt={DOC_TYPE_LABELS[docType]}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Rejection Info (if rejected) */}
                    {provider.verificationStatus === 'REJECTED' && provider.rejectReasonCode && (
                        <div className="border-l-4 border-red-500 bg-red-50 rounded-r-lg p-4 mb-6">
                            <div className="flex items-start gap-3">
                                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-red-900 mb-1">Lý do từ chối</p>
                                    <p className="text-sm text-red-700">
                                        <span className="font-medium">Mã:</span> {provider.rejectReasonCode}
                                    </p>
                                    {provider.rejectReasonDetail && (
                                        <p className="text-sm text-red-700 mt-1">
                                            <span className="font-medium">Chi tiết:</span> {provider.rejectReasonDetail}
                                        </p>
                                    )}
                                    {provider.rejectedAt && (
                                        <p className="text-xs text-red-600 mt-2">
                                            Từ chối lúc: {new Date(provider.rejectedAt).toLocaleString('vi-VN')}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* History Section */}
                    {history.length > 0 && (
                        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                            <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-blue-600">
                                <History className="w-5 h-5 text-blue-600" />
                                <h2 className="text-lg font-semibold text-gray-900">Lịch sử xử lý</h2>
                            </div>

                            <div className="space-y-3">
                                {history.map((entry) => (
                                    <div key={entry.id} className="border-l-2 border-gray-300 pl-4 py-2">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{entry.action}</p>
                                                <p className="text-xs text-gray-600 mt-0.5">
                                                    {entry.fromStatus} → {entry.toStatus}
                                                </p>
                                                {entry.reason && (
                                                    <p className="text-xs text-gray-700 mt-1">
                                                        <span className="font-medium">Lý do:</span> {entry.reason}
                                                    </p>
                                                )}
                                                {entry.reasonDetail && (
                                                    <p className="text-xs text-gray-700">
                                                        <span className="font-medium">Chi tiết:</span> {entry.reasonDetail}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-gray-600">{entry.performedBy}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    {new Date(entry.performedAt).toLocaleString('vi-VN')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-blue-600">
                            <Shield className="w-5 h-5 text-blue-600" />
                            <h2 className="text-lg font-semibold text-gray-900">Hành động</h2>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            {provider.verificationStatus === 'PENDING' && (
                                <>
                                    <button
                                        onClick={handleApprove}
                                        disabled={actionLoading}
                                        className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-green-600 border-2 border-green-600 rounded-lg hover:bg-green-700 hover:border-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {actionLoading ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <CheckCircle className="w-4 h-4" />
                                        )}
                                        Duyệt hồ sơ
                                    </button>
                                    <button
                                        onClick={() => setShowRejectModal(true)}
                                        disabled={actionLoading}
                                        className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-red-600 border-2 border-red-600 rounded-lg hover:bg-red-700 hover:border-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <XCircle className="w-4 h-4" />
                                        Từ chối hồ sơ
                                    </button>
                                </>
                            )}

                            {provider.verificationStatus === 'APPROVED' && (
                                <button
                                    onClick={handleSuspend}
                                    disabled={actionLoading}
                                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-orange-600 border-2 border-orange-600 rounded-lg hover:bg-orange-700 hover:border-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {actionLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <AlertTriangle className="w-4 h-4" />
                                    )}
                                    Khóa tài khoản
                                </button>
                            )}

                            {provider.verificationStatus === 'SUSPENDED' && (
                                <button
                                    onClick={handleUnsuspend}
                                    disabled={actionLoading}
                                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 border-2 border-blue-600 rounded-lg hover:bg-blue-700 hover:border-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {actionLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <CheckCircle className="w-4 h-4" />
                                    )}
                                    Mở khóa tài khoản
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Reject Modal */}
                {showRejectModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg max-w-md w-full p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Từ chối hồ sơ</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-900 mb-2">
                                        Lý do từ chối <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Chọn lý do...</option>
                                        {REJECT_REASONS.map((reason) => (
                                            <option key={reason.code} value={reason.code}>{reason.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-900 mb-2">
                                        Mô tả chi tiết <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        value={rejectDetail}
                                        onChange={(e) => setRejectDetail(e.target.value)}
                                        rows={4}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="VD: Ảnh CCCD mặt trước bị mờ, không nhìn rõ số CCCD..."
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => {
                                        setShowRejectModal(false);
                                        setRejectReason('');
                                        setRejectDetail('');
                                    }}
                                    disabled={actionLoading}
                                    className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 transition-colors"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleReject}
                                    disabled={actionLoading}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-red-600 border-2 border-red-600 rounded-lg hover:bg-red-700 hover:border-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {actionLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Đang xử lý...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            <span>Xác nhận từ chối</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Image Lightbox */}
                {selectedImage && (
                    <div
                        onClick={() => setSelectedImage(null)}
                        className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
                    >
                        <img
                            src={selectedImage}
                            alt="Preview"
                            className="max-w-full max-h-full object-contain"
                        />
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
