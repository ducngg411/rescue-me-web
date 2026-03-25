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

const getRejectReasonLabel = (code: string | undefined | null) => {
    if (!code) return '';
    const reason = REJECT_REASONS.find(r => r.code === code);
    return reason ? reason.label : code;
};

const C = {
    orange: '#f97316', orangeDark: '#ea6c0a', orangeLight: '#fff7ed',
    navy: '#1a1a2e', gray: '#6b7280', border: '#e2e8f0', bg: '#f4f6f9',
    green: '#16a34a', greenLight: '#f0fdf4',
    red: '#ef4444', redLight: '#fef2f2',
    yellow: '#ca8a04', yellowLight: '#fefce8',
    blue: '#2563eb', blueLight: '#eff6ff',
};

function StatusBadge({ status }: { status: ProviderDetail['verificationStatus'] }) {
    const configs: Record<string, { label: string; bg: string; color: string; dot: string }> = {
        PENDING: { label: 'Pending', bg: C.yellowLight, color: C.yellow, dot: '#facc15' },
        APPROVED: { label: 'Approved', bg: C.greenLight, color: C.green, dot: C.green },
        REJECTED: { label: 'Rejected', bg: C.redLight, color: C.red, dot: C.red },
        SUSPENDED: { label: 'Suspended', bg: C.orangeLight, color: C.orange, dot: C.orange },
        DRAFT: { label: 'Draft', bg: '#f8fafc', color: C.gray, dot: C.gray },
    };
    const cfg = configs[status] || configs.DRAFT;
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0" style={{ background: cfg.bg, color: cfg.color }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.dot }} />
            {cfg.label}
        </span>
    );
}

const SectionCard = ({ title, icon, children, className = "" }: { title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }) => (
    <div className={`bg-white rounded-2xl p-5 border ${className}`} style={{ borderColor: C.border }}>
        <div className="flex items-center gap-3 mb-5 border-b pb-4" style={{ borderColor: C.border }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: C.blueLight }}>
                {icon}
            </div>
            <h2 className="text-base font-bold" style={{ color: C.navy }}>{title}</h2>
        </div>
        {children}
    </div>
);

const InfoRow = ({ icon, label, value, valueNode }: { icon: React.ReactNode; label: string; value?: string; valueNode?: React.ReactNode }) => (
    <div className="flex items-start gap-3 py-1">
        <div className="mt-0.5">{icon}</div>
        <div>
            <p className="text-[10px] font-semibold mb-0.5 tracking-wider uppercase" style={{ color: C.gray }}>{label}</p>
            {valueNode || <p className="text-sm font-medium" style={{ color: C.navy }}>{value || '—'}</p>}
        </div>
    </div>
);

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
            <div className="min-h-screen p-6" style={{ background: C.bg }}>
                <div className="max-w-6xl mx-auto space-y-6">

                    {/* Header */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="w-10 h-10 rounded-full flex items-center justify-center bg-white border hover:bg-gray-50 transition-colors"
                            style={{ borderColor: C.border, color: C.gray }}
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-bold" style={{ color: C.navy }}>{provider.fullName}</h1>
                                <StatusBadge status={provider.verificationStatus} />
                            </div>
                            {provider.businessName && (
                                <p className="text-sm mt-1" style={{ color: C.gray }}>{provider.businessName}</p>
                            )}
                        </div>
                    </div>

                    {/* Error Alert */}
                    {error && (
                        <div className="p-4 rounded-xl border flex items-start gap-3" style={{ background: C.redLight, borderColor: '#fecaca' }}>
                            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: C.red }} />
                            <p className="text-sm" style={{ color: '#991b1b' }}>{error}</p>
                        </div>
                    )}

                    {/* Reject Info */}
                    {provider.verificationStatus === 'REJECTED' && provider.rejectReasonCode && (
                        <div className="p-4 rounded-xl border flex items-start gap-3" style={{ background: C.redLight, borderColor: '#fecaca' }}>
                            <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: C.red }} />
                            <div>
                                <p className="text-sm font-bold mb-1" style={{ color: '#991b1b' }}>Hồ sơ bị từ chối</p>
                                <p className="text-sm" style={{ color: '#b91c1c' }}>
                                    <span className="font-semibold">Lý do:</span> {getRejectReasonLabel(provider.rejectReasonCode)}
                                </p>
                                {provider.rejectReasonDetail && (
                                    <p className="text-sm mt-1" style={{ color: '#b91c1c' }}>
                                        <span className="font-semibold">Chi tiết:</span> {provider.rejectReasonDetail}
                                    </p>
                                )}
                                {provider.rejectedAt && (
                                    <p className="text-xs mt-2 opacity-80" style={{ color: '#b91c1c' }}>
                                        Từ chối lúc: {new Date(provider.rejectedAt).toLocaleString('vi-VN')}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* Left Column: Details & Docs */}
                        <div className="lg:col-span-2 space-y-6">
                            
                            {/* Service Info */}
                            <SectionCard title="Thông tin cá nhân & Dịch vụ" icon={<Briefcase size={16} style={{ color: C.blue }} />}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-4">
                                    <InfoRow icon={<User size={14} style={{ color: C.gray }} />} label="Họ và tên" value={provider.fullName} />
                                    <InfoRow icon={<Phone size={14} style={{ color: C.gray }} />} label="Số điện thoại" value={provider.phoneNumber} />
                                    <InfoRow icon={<Mail size={14} style={{ color: C.gray }} />} label="Email" value={provider.email} />
                                    <InfoRow icon={<Briefcase size={14} style={{ color: C.gray }} />} label="Loại hợp tác" value={provider.providerType === 'INDIVIDUAL' ? 'Cá nhân' : 'Doanh nghiệp'} />
                                    <InfoRow icon={<MapPin size={14} style={{ color: C.gray }} />} label="Địa chỉ" value={provider.providerType === 'INDIVIDUAL' ? provider.permanentAddress?.addressText : provider.businessAddress?.addressText} />
                                    <InfoRow icon={<MapPin size={14} style={{ color: C.gray }} />} label="Bán kính phục vụ" value={`${provider.serviceRadiusKm} km`} />

                                    {provider.rescueVehicles && provider.rescueVehicles.length > 0 && (
                                        <div className="md:col-span-2 mt-2">
                                            <p className="text-[10px] font-semibold mb-2 tracking-wider uppercase" style={{ color: C.gray }}>Phương tiện đăng ký</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {provider.rescueVehicles.map((vehicle, index) => (
                                                    <div key={index} className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: C.border }}>
                                                        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: C.bg }}>
                                                            {vehicle.type === 'CAR' ? <Car size={16} style={{ color: C.gray }} /> : <Bike size={16} style={{ color: C.gray }} />}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold" style={{ color: C.navy }}>{vehicle.type === 'CAR' ? 'Ô tô' : 'Xe máy'}</p>
                                                            <p className="text-xs font-mono mt-0.5" style={{ color: C.gray }}>{vehicle.plateNumber}</p>
                                                        </div>
                                                        {vehicle.isPrimary && (
                                                            <span className="ml-auto text-[10px] font-bold px-2 py-1 rounded-md" style={{ background: C.blueLight, color: C.blue }}>CHÍNH</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="md:col-span-2 mt-2">
                                        <p className="text-[10px] font-semibold mb-2 tracking-wider uppercase" style={{ color: C.gray }}>Loại xe Cứu hộ</p>
                                        <div className="flex gap-2 flex-wrap">
                                            {provider.supportedVehicleTypes.map(v => (
                                                <span key={v} className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border" style={{ borderColor: C.border, color: C.navy }}>
                                                    {v === 'CAR' ? <Car size={14} /> : <Bike size={14} />}
                                                    {v === 'CAR' ? 'Ô tô' : 'Xe máy'}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="md:col-span-2 mt-2">
                                        <p className="text-[10px] font-semibold mb-2 tracking-wider uppercase" style={{ color: C.gray }}>Dịch vụ cung cấp</p>
                                        <div className="flex gap-2 flex-wrap">
                                            {provider.serviceTypes.map(s => (
                                                <span key={s} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: C.blueLight, color: C.blue }}>
                                                    {SERVICE_TYPE_LABELS[s] || s}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </SectionCard>

                            {/* Required Documents Section */}
                            <SectionCard title="Giấy tờ đính kèm" icon={<FileText size={16} style={{ color: C.blue }} />}>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {[...requiredDocs, ...optionalDocs].map(docType => {
                                        const upload = provider.uploads.find(u => u.docType === docType);
                                        if (!upload && optionalDocs.includes(docType)) return null;

                                        return (
                                            <div key={docType} className="border rounded-xl p-3 flex flex-col" style={{ borderColor: C.border }}>
                                                <div className="flex items-center justify-between mb-3">
                                                    <p className="text-xs font-semibold" style={{ color: C.navy }}>{DOC_TYPE_LABELS[docType] || docType}</p>
                                                    {upload ? <CheckCircle size={14} style={{ color: C.green }} /> : <XCircle size={14} style={{ color: C.red }} />}
                                                </div>
                                                {upload ? (
                                                    <div 
                                                        onClick={() => setSelectedImage(upload.publicUrl)}
                                                        className="relative w-full aspect-[4/3] rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity bg-gray-100 mt-auto"
                                                    >
                                                        <img src={upload.publicUrl} alt={docType} className="w-full h-full object-cover" />
                                                    </div>
                                                ) : (
                                                    <div className="w-full aspect-[4/3] rounded-lg bg-gray-50 flex flex-col items-center justify-center mt-auto">
                                                        <ImageIcon size={20} style={{ color: '#d1d5db' }} className="mb-1" />
                                                        <p className="text-[10px] uppercase font-semibold text-gray-400">Thiếu</p>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </SectionCard>

                        </div>

                        {/* Right Column: Actions & History */}
                        <div className="space-y-6">

                            {/* Actions */}
                            <SectionCard title="Hành động" icon={<Shield size={16} style={{ color: C.blue }} />} className="bg-gray-50">
                                <div className="flex flex-col gap-3">
                                    {provider.verificationStatus === 'PENDING' && (
                                        <>
                                            <button
                                                onClick={handleApprove}
                                                disabled={actionLoading}
                                                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-white rounded-xl transition-all hover:scale-[1.02] disabled:opacity-50 disabled:scale-100"
                                                style={{ background: C.green }}
                                            >
                                                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                                                Duyệt hồ sơ ngay
                                            </button>
                                            <button
                                                onClick={() => setShowRejectModal(true)}
                                                disabled={actionLoading}
                                                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold bg-white border-2 rounded-xl transition-all hover:bg-red-50 disabled:opacity-50"
                                                style={{ borderColor: C.redLight, color: C.red }}
                                            >
                                                <XCircle size={16} />
                                                Từ chối hồ sơ
                                            </button>
                                        </>
                                    )}

                                    {provider.verificationStatus === 'APPROVED' && (
                                        <button
                                            onClick={handleSuspend}
                                            disabled={actionLoading}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold bg-white border-2 rounded-xl transition-all hover:bg-orange-50 disabled:opacity-50"
                                            style={{ borderColor: C.orangeLight, color: C.orange }}
                                        >
                                            {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <AlertTriangle size={16} />}
                                            Khóa tài khoản
                                        </button>
                                    )}

                                    {provider.verificationStatus === 'SUSPENDED' && (
                                        <button
                                            onClick={handleUnsuspend}
                                            disabled={actionLoading}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold bg-white border-2 rounded-xl transition-all hover:bg-green-50 disabled:opacity-50"
                                            style={{ borderColor: C.greenLight, color: C.green }}
                                        >
                                            {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                                            Mở khóa tài khoản
                                        </button>
                                    )}
                                </div>
                            </SectionCard>

                            {/* History Section */}
                            {history.length > 0 && (
                                <SectionCard title="Lịch sử xử lý" icon={<History size={16} style={{ color: C.blue }} />}>
                                    <div className="relative border-l-2 ml-3 pl-5 space-y-6" style={{ borderColor: C.border }}>
                                        {history.map((entry, idx) => (
                                            <div key={entry.id} className="relative">
                                                <div className="absolute w-3 h-3 rounded-full -left-[27px] top-1.5" style={{ background: C.blueLight, border: `2px solid ${C.blue}` }} />
                                                <p className="text-sm font-bold" style={{ color: C.navy }}>{entry.action}</p>
                                                <p className="text-[10px] font-semibold tracking-wider uppercase mt-1" style={{ color: C.gray }}>
                                                    {entry.fromStatus} → {entry.toStatus}
                                                </p>
                                                {entry.reason && (
                                                    <div className="mt-2 p-3 text-sm rounded-lg bg-gray-50 border" style={{ borderColor: C.border, color: C.navy }}>
                                                        <span className="font-semibold block mb-1">Căn cứ / Lý do:</span>
                                                        {getRejectReasonLabel(entry.reason)}
                                                        {entry.reasonDetail && <span className="block mt-1 opacity-80">{entry.reasonDetail}</span>}
                                                    </div>
                                                )}
                                                <div className="mt-2 text-xs flex justify-between" style={{ color: C.gray }}>
                                                    <span>Admin: <span className="font-semibold">{entry.performedBy}</span></span>
                                                    <span>{new Date(entry.performedAt).toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </SectionCard>
                            )}

                        </div>
                    </div>

                    {/* Reject Modal */}
                    {showRejectModal && (
                        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
                            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
                                <h3 className="text-xl font-bold mb-5" style={{ color: C.navy }}>Từ chối hồ sơ</h3>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.gray }}>Lý do chính <span className="text-red-500">*</span></label>
                                        <select
                                            value={rejectReason}
                                            onChange={(e) => setRejectReason(e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl border bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                            style={{ borderColor: C.border, color: C.navy }}
                                        >
                                            <option value="">-- Chọn lý do --</option>
                                            {REJECT_REASONS.map((reason) => (
                                                <option key={reason.code} value={reason.code}>{reason.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.gray }}>Chi tiết / Ghi chú <span className="text-red-500">*</span></label>
                                        <textarea
                                            value={rejectDetail}
                                            onChange={(e) => setRejectDetail(e.target.value)}
                                            rows={4}
                                            className="w-full px-4 py-3 rounded-xl border bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                            style={{ borderColor: C.border, color: C.navy }}
                                            placeholder="VD: Viết rõ ảnh CCCD bị mờ, ngày sinh không trùng khớp..."
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-8">
                                    <button
                                        onClick={() => { setShowRejectModal(false); setRejectReason(''); setRejectDetail(''); }}
                                        disabled={actionLoading}
                                        className="flex-1 px-4 py-3 text-sm font-bold bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
                                        style={{ color: C.navy }}
                                    >Hủy</button>
                                    <button
                                        onClick={handleReject}
                                        disabled={actionLoading}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-white rounded-xl transition-colors disabled:opacity-50"
                                        style={{ background: C.red }}
                                    >
                                        {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                        Xác nhận
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Image Lightbox */}
                    {selectedImage && (
                        <div
                            onClick={() => setSelectedImage(null)}
                            className="fixed inset-0 bg-black/90 flex items-center justify-center z-[110] p-4 cursor-zoom-out animate-in fade-in"
                        >
                            <img src={selectedImage} alt="Preview" className="max-w-full max-h-full object-contain pointer-events-none" />
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
