'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, AlertTriangle, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';

const C = { orange: '#f97316', orangeDark: '#ea6c0a', orangeLight: '#fff7ed', navy: '#1a1a2e', gray: '#6b7280', border: '#e2e8f0', bg: '#f4f6f9', green: '#16a34a', red: '#ef4444' };

const SERVICE_LABELS: Record<string, string> = { TOWING: 'Kéo xe', BATTERY_JUMP: 'Cứu hộ bình điện', TIRE_CHANGE: 'Thay lốp xe', FUEL_DELIVERY: 'Tiếp nhiên liệu', LOCKOUT: 'Mở khóa xe', BREAKDOWN_REPAIR: 'Sửa tại chỗ' };
const VEHICLE_LABELS: Record<string, string> = { CAR: 'Ô tô', MOTORCYCLE: 'Xe máy' };

const SectionCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="bg-white rounded-2xl border p-5 mb-4" style={{ borderColor: C.border }}>
        <div className="flex items-center gap-2 mb-4 pb-3 border-b" style={{ borderColor: C.border }}>
            <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: C.orange }} />
            <h2 className="text-sm font-bold" style={{ color: C.navy }}>{title}</h2>
        </div>
        {children}
    </div>
);

const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex py-1.5 border-b last:border-b-0" style={{ borderColor: C.border }}>
        <span className="text-xs w-40 flex-shrink-0" style={{ color: C.gray }}>{label}</span>
        <span className="text-xs font-medium" style={{ color: C.navy }}>{value}</span>
    </div>
);

const UploadStatus = ({ uploaded, label }: { uploaded: boolean; label: string }) => (
    <div className="flex items-center justify-between py-1.5 border-b last:border-b-0" style={{ borderColor: C.border }}>
        <span className="text-xs" style={{ color: C.navy }}>{label}</span>
        {uploaded
            ? <div className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" style={{ color: C.green }} /><span className="text-xs" style={{ color: C.green }}>Đã upload</span></div>
            : <div className="flex items-center gap-1"><XCircle className="w-3.5 h-3.5" style={{ color: C.red }} /><span className="text-xs" style={{ color: C.red }}>Chưa upload</span></div>}
    </div>
);

interface ReviewSubmitStepProps {
    serviceInfo: any;
    requiredDocs: any;
    optionalDocs: any;
    onBack: () => void;
    isShell?: boolean;
    isSubmitting?: boolean;
    isEditMode?: boolean;
}

export default function ReviewSubmitStep({ serviceInfo, requiredDocs, optionalDocs, onBack, isShell, isSubmitting: parentSubmitting, isEditMode }: ReviewSubmitStepProps) {
    const router = useRouter();
    const { refreshUser } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const submitting = parentSubmitting || isSubmitting;

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError('');
        try {
            const uploadIds = [
                requiredDocs.citizenIdFront?.id, requiredDocs.citizenIdBack?.id,
                requiredDocs.selfie?.id, requiredDocs.carPhoto?.id, requiredDocs.motorbikePhoto?.id,
                optionalDocs?.driverLicense?.id, optionalDocs?.businessLicense?.id,
            ].filter(Boolean);
            await api.post('/me/provider/submit-verification', { uploadIds });
            await refreshUser();
            // Toast is handled by dashboard/page.tsx when it detects ?verification=submitted
            const dest = isEditMode
                ? '/provider/dashboard?verification=submitted&edit=true'
                : '/provider/dashboard?verification=submitted';
            router.push(dest);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Có lỗi xảy ra khi gửi hồ sơ');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div>
            {/* Service info summary */}
            <SectionCard title="Thông tin dịch vụ">
                <div>
                    <Row label="Loại nhà cung cấp" value={serviceInfo?.providerType === 'INDIVIDUAL' ? 'Cá nhân' : 'Doanh nghiệp'} />
                    <Row label="Họ tên" value={serviceInfo?.fullName || '—'} />
                    <Row label="Số điện thoại" value={serviceInfo?.phoneNumber || '—'} />
                    {serviceInfo?.businessName && <Row label="Tên doanh nghiệp" value={serviceInfo.businessName} />}
                    <Row label="Dịch vụ" value={(serviceInfo?.serviceTypes || []).map((t: string) => SERVICE_LABELS[t]).join(', ') || '—'} />
                    <Row label="Phương tiện hỗ trợ" value={(serviceInfo?.supportedVehicleTypes || []).map((t: string) => VEHICLE_LABELS[t]).join(', ') || '—'} />
                    <Row label="Bán kính" value={serviceInfo?.serviceRadiusKm ? `${serviceInfo.serviceRadiusKm} km` : '—'} />
                    <Row label="Địa chỉ" value={serviceInfo?.providerType === 'INDIVIDUAL' ? serviceInfo?.permanentAddress?.addressText : serviceInfo?.businessAddress?.addressText || '—'} />
                    {serviceInfo?.rescueVehicles?.length > 0 && (
                        <div className="flex py-1.5">
                            <span className="text-xs w-40 flex-shrink-0" style={{ color: C.gray }}>Phương tiện cứu hộ</span>
                            <div className="flex flex-wrap gap-1.5">
                                {serviceInfo.rescueVehicles.map((v: any, i: number) => (
                                    <span key={i} className="text-xs px-2 py-0.5 rounded-lg font-mono" style={{ background: C.bg, color: C.navy }}>
                                        {v.type === 'CAR' ? '' : ''} {v.plateNumber}
                                        {v.isPrimary && <span className="ml-1" style={{ color: C.orange }}>✓</span>}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </SectionCard>

            {/* Documents summary */}
            <SectionCard title="Trạng thái tài liệu">
                <div>
                    <UploadStatus uploaded={!!requiredDocs.citizenIdFront} label="CCCD mặt trước" />
                    <UploadStatus uploaded={!!requiredDocs.citizenIdBack} label="CCCD mặt sau" />
                    <UploadStatus uploaded={!!requiredDocs.selfie} label="Ảnh selfie cầm CCCD" />
                    {serviceInfo?.rescueVehicles?.some((v: any) => v.type === 'CAR') && <UploadStatus uploaded={!!requiredDocs.carPhoto} label="Ảnh ô tô cứu hộ" />}
                    {serviceInfo?.rescueVehicles?.some((v: any) => v.type === 'MOTORCYCLE') && <UploadStatus uploaded={!!requiredDocs.motorbikePhoto} label="Ảnh xe máy cứu hộ" />}
                    {optionalDocs?.driverLicense && <UploadStatus uploaded label="Bằng lái xe (tùy chọn)" />}
                    {optionalDocs?.businessLicense && <UploadStatus uploaded label="Giấy phép kinh doanh (tùy chọn)" />}
                </div>
            </SectionCard>

            {/* Warning */}
            <div className="flex items-start gap-3 p-4 rounded-2xl mb-4" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#d97706' }} />
                <p className="text-xs leading-relaxed" style={{ color: '#92400e' }}>
                    Sau khi gửi, hồ sơ chuyển sang trạng thái <strong>Chờ duyệt</strong>. Bạn không thể chỉnh sửa cho đến khi admin xử lý.
                </p>
            </div>

            {error && (
                <div className="flex items-start gap-3 p-4 rounded-2xl mb-4" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                    <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: C.red }} />
                    <p className="text-xs" style={{ color: C.red }}>{error}</p>
                </div>
            )}

            {/* Actions */}
            <div className="flex justify-between items-center pt-2">
                <button onClick={onBack} disabled={submitting} className="px-5 py-2.5 rounded-xl border text-sm font-medium transition-colors hover:bg-gray-50 disabled:opacity-50" style={{ borderColor: C.border, color: C.gray }}>Quay lại</button>
                <button onClick={handleSubmit} disabled={submitting}
                    className="px-6 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center gap-2 transition-all disabled:opacity-70"
                    style={{ background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)` }}>
                    {submitting ? (
                        <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /><span>Đang gửi...</span></>
                    ) : (
                        <><Send className="w-4 h-4" /><span>Gửi hồ sơ xét duyệt</span></>
                    )}
                </button>
            </div>
        </div>
    );
}
