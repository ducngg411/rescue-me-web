'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAdminGuard } from '@/lib/guards';
import { adminApi } from '@/lib/api';
import AdminLayout from '@/components/AdminLayout';
import AvatarImage from '@/components/AvatarImage';
import { displayOrderCode } from '@/lib/reconciliation';
import {
    ArrowLeft, CheckCircle2, Clock, X, MapPin, Phone, Banknote,
    Star, Image as ImageIcon, Film, User, Wrench, Car, Calendar,
    ShieldAlert, Receipt, AlertCircle, Loader2,
} from 'lucide-react';

const C = {
    orange: '#f97316', orangeDark: '#ea6c0a', orangeLight: '#fff7ed',
    navy: '#1a1a2e', gray: '#6b7280', border: '#e2e8f0', bg: '#f8fafc',
    green: '#16a34a', greenLight: '#f0fdf4',
    red: '#ef4444', redLight: '#fef2f2',
    yellow: '#ca8a04', yellowLight: '#fefce8',
    blue: '#2563eb', blueLight: '#eff6ff',
    purple: '#7c3aed', purpleLight: '#faf5ff',
};

const INCIDENT_LABELS: Record<string, string> = {
    BREAKDOWN: 'Hỏng xe', ACCIDENT: 'Tai nạn', FLAT_TIRE: 'Xì lốp',
    BATTERY_DEAD: 'Hết pin', OUT_OF_FUEL: 'Hết xăng', LOCKED_OUT: 'Khóa xe', OTHER: 'Khác',
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
    CREATED: { label: 'Mới tạo', color: C.blue, bg: C.blueLight },
    SEARCHING: { label: 'Đang tìm', color: C.blue, bg: C.blueLight },
    MATCHING: { label: 'Đang ghép', color: C.blue, bg: C.blueLight },
    MATCHED: { label: 'Đã ghép', color: C.yellow, bg: C.yellowLight },
    ACCEPTED: { label: 'Đã nhận', color: C.yellow, bg: C.yellowLight },
    ASSIGNED: { label: 'Đã phân công', color: C.yellow, bg: C.yellowLight },
    IN_PROGRESS: { label: 'Đang thực hiện', color: C.orange, bg: C.orangeLight },
    ARRIVED: { label: 'Đã đến nơi', color: C.orange, bg: C.orangeLight },
    WORKING: { label: 'Đang làm', color: C.orange, bg: C.orangeLight },
    PAYMENT_PENDING: { label: 'Chờ thanh toán', color: C.purple, bg: C.purpleLight },
    COMPLETED: { label: 'Hoàn thành', color: C.green, bg: C.greenLight },
    PAID: { label: 'Đã thanh toán', color: C.green, bg: C.greenLight },
    CANCELLED: { label: 'Đã hủy', color: C.gray, bg: '#f3f4f6' },
    REJECTED: { label: 'Bị từ chối', color: C.red, bg: C.redLight },
    EXPIRED: { label: 'Hết hạn', color: C.gray, bg: '#f3f4f6' },
};

const PM_LABELS: Record<string, string> = { CASH: 'Tiền mặt', WALLET: 'Ví RescueMe', QR: 'QR / Chuyển khoản' };

function fmtVnd(n: number) {
    return new Intl.NumberFormat('vi-VN').format(n ?? 0) + '₫';
}
function fmtDt(iso: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    if (!value && value !== 0) return null;
    return (
        <div className="flex justify-between items-start gap-4 py-2.5 border-b border-dashed last:border-0" style={{ borderColor: C.border }}>
            <span className="text-sm flex-shrink-0" style={{ color: C.gray }}>{label}</span>
            <span className="text-sm font-semibold text-right" style={{ color: C.navy }}>{value}</span>
        </div>
    );
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl p-5 mb-4 border" style={{ borderColor: C.border }}>
            <div className="flex items-center gap-2 mb-4">
                {icon}
                <h2 className="font-bold text-sm uppercase tracking-wide" style={{ color: C.navy }}>{title}</h2>
            </div>
            {children}
        </div>
    );
}

function Stars({ rating }: { rating: number }) {
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} className="w-4 h-4" fill={i <= rating ? '#ca8a04' : 'none'} stroke={i <= rating ? '#ca8a04' : '#d1d5db'} />
            ))}
        </div>
    );
}

function ProgressTimeline({ status }: { status: string }) {
    const groups = [
        { label: 'Tạo đơn', statuses: ['CREATED'] },
        { label: 'Tìm & ghép', statuses: ['SEARCHING', 'MATCHING', 'MATCHED', 'ACCEPTED', 'ASSIGNED'] },
        { label: 'Thực hiện', statuses: ['IN_PROGRESS', 'ARRIVED', 'WORKING'] },
        { label: 'Hoàn tất', statuses: ['PAYMENT_PENDING', 'COMPLETED', 'PAID'] },
    ];
    const allStatuses = groups.flatMap(g => g.statuses);
    const currentIdx = allStatuses.indexOf(status);
    const isFailed = ['CANCELLED', 'REJECTED', 'EXPIRED'].includes(status);

    return (
        <div className="flex items-center justify-between px-6 py-8 bg-white rounded-2xl border mb-4" style={{ borderColor: C.border }}>
            {groups.map((g, i) => {
                const groupMax = g.statuses[g.statuses.length - 1];
                const groupMaxIdx = allStatuses.indexOf(groupMax);
                const done = !isFailed && currentIdx >= groupMaxIdx;
                const active = !isFailed && g.statuses.includes(status);
                return (
                    <React.Fragment key={g.label}>
                        <div className="flex flex-col items-center gap-2 relative z-10 w-24">
                            <div
                                className="w-8 h-8 rounded-full flex items-center justify-center"
                                style={{
                                    background: isFailed && i === 3 ? C.red : done || active ? C.orange : '#f1f5f9',
                                    boxShadow: active ? `0 0 0 4px ${C.orangeLight}` : isFailed && i === 3 ? `0 0 0 4px ${C.redLight}` : 'none',
                                }}
                            >
                                {done ? <CheckCircle2 size={14} className="text-white" />
                                    : active ? <Clock size={14} className="text-white animate-pulse" />
                                    : isFailed && i === 3 ? <X size={14} className="text-white" />
                                    : <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#cbd5e1' }} />}
                            </div>
                            <span className="text-[10px] font-bold text-center absolute top-10 w-24 whitespace-nowrap"
                                style={{ color: done || active ? C.navy : C.gray }}>{g.label}</span>
                        </div>
                        {i < groups.length - 1 && (
                            <div className="flex-1 h-1 relative mx-2 rounded-full overflow-hidden">
                                <div className="absolute inset-0" style={{ background: '#e2e8f0' }} />
                                <div className="absolute inset-y-0 left-0 transition-all duration-500"
                                    style={{ width: currentIdx >= allStatuses.indexOf(groups[i + 1].statuses[0]) ? '100%' : '0%', background: C.orange }} />
                            </div>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

export default function AdminRequestDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const router = useRouter();
    const { isReady } = useAdminGuard();

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'overview' | 'order'>('overview');
    const [mediaPreview, setMediaPreview] = useState<{ url: string; type: 'image' | 'video' } | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminApi.getRescueRequestDetail(id);
            setData(res);
        } catch {
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { if (isReady && id) load(); }, [isReady, id, load]);

    if (!isReady || loading) {
        return (
            <AdminLayout activeTab="/admin/requests">
                <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: C.orange }} />
                </div>
            </AdminLayout>
        );
    }

    if (!data?.req) {
        return (
            <AdminLayout activeTab="/admin/requests">
                <div className="min-h-screen flex items-center justify-center px-4" style={{ background: C.bg }}>
                    <div className="bg-white p-6 rounded-2xl text-center w-full max-w-sm border" style={{ borderColor: C.border }}>
                        <AlertCircle className="w-8 h-8 mx-auto mb-2" style={{ color: C.red }} />
                        <p className="font-semibold mb-3" style={{ color: C.navy }}>Không tìm thấy đơn</p>
                        <button onClick={() => router.push('/admin/requests')}
                            className="px-4 py-2 rounded-xl text-sm font-semibold text-white w-full"
                            style={{ background: C.orange }}>Quay lại</button>
                    </div>
                </div>
            </AdminLayout>
        );
    }

    const { req, quotes, payment } = data;
    const sm = STATUS_META[req.status] ?? { label: req.status, color: C.gray, bg: '#f3f4f6' };
    const isVideo = (url: string) => /\.(mp4|webm|mkv|mov)(\?.*)?$/i.test(url) || url.includes('/video/upload/');
    const orderCode = `#${displayOrderCode(req.orderCode, req.id)}`;

    return (
        <AdminLayout activeTab="/admin/requests">
            <div className="min-h-screen" style={{ background: C.bg }}>
                <div className="max-w-5xl mx-auto px-4 lg:px-6 pt-6 pb-12">

                    {/* Back + Header */}
                    <button
                        onClick={() => router.push('/admin/requests')}
                        className="flex items-center gap-2 text-sm mb-4 transition-colors"
                        style={{ color: C.gray }}
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Quay lại danh sách
                    </button>

                    <div className="flex items-start justify-between gap-4 mb-6">
                        <div>
                            <h1 className="text-2xl font-bold" style={{ color: C.navy }}>Chi tiết đơn cứu hộ</h1>
                            <p className="text-sm mt-1" style={{ color: C.gray }}>Mã đơn: <span className="font-mono font-bold" style={{ color: C.navy }}>{orderCode}</span></p>
                        </div>
                        <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold flex-shrink-0"
                            style={{ background: sm.bg, color: sm.color }}>
                            <span className="w-2 h-2 rounded-full bg-current" />
                            {sm.label}
                        </span>
                    </div>

                    {/* Tabs */}
                    <div className="bg-white rounded-2xl border mb-4 overflow-hidden" style={{ borderColor: C.border }}>
                        <div className="flex border-b" style={{ borderColor: C.border }}>
                            {[
                                { key: 'overview', label: 'Thông tin đơn' },
                                { key: 'order', label: 'Chi tiết dịch vụ' },
                            ].map(t => (
                                <button
                                    key={t.key}
                                    onClick={() => setTab(t.key as any)}
                                    className="flex-1 py-3.5 text-sm font-bold transition-colors"
                                    style={{
                                        color: tab === t.key ? C.orange : C.gray,
                                        borderBottom: tab === t.key ? `2px solid ${C.orange}` : '2px solid transparent',
                                        marginBottom: '-1px',
                                    }}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── TAB: Overview ── */}
                    {tab === 'overview' && (
                        <>
                            {/* Progress */}
                            <ProgressTimeline status={req.status} />

                            {/* Quick info */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                {[
                                    { label: 'Sự cố', value: INCIDENT_LABELS[req.incidentType] || req.incidentType },
                                    { label: 'Phương tiện', value: req.vehicleType === 'CAR' ? 'Ô tô' : 'Xe máy' },
                                    { label: 'Biển số', value: req.licensePlate || '—' },
                                    { label: 'Ngày tạo', value: fmtDt(req.createdAt) },
                                ].map(s => (
                                    <div key={s.label} className="bg-white rounded-xl border p-3" style={{ borderColor: C.border }}>
                                        <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: C.gray }}>{s.label}</p>
                                        <p className="text-sm font-bold" style={{ color: C.navy }}>{s.value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Customer */}
                            <SectionCard title="Khách hàng" icon={<User size={15} style={{ color: C.blue }} />}>
                                {req.user ? (
                                    <div className="flex items-center gap-4">
                                        <AvatarImage
                                            name={req.user.fullName || req.user.email}
                                            avatar={req.user.avatar}
                                            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                                            fallbackBackground={`linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`}
                                            initialsCount={1}
                                        />
                                        <div>
                                            <p className="font-bold" style={{ color: C.navy }}>{req.user.fullName || '(Khách)'}</p>
                                            <p className="text-sm mt-0.5" style={{ color: C.gray }}>{req.user.phoneNumber}</p>
                                            <p className="text-xs mt-0.5" style={{ color: C.gray }}>{req.user.email}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm" style={{ color: C.gray }}>Khách vãng lai (không có tài khoản)</p>
                                )}
                            </SectionCard>

                            {/* Provider */}
                            {req.assignedProvider && (
                                <SectionCard title="Cứu hộ viên" icon={<Wrench size={15} style={{ color: C.orange }} />}>
                                    <div className="flex items-center gap-4">
                                        <AvatarImage
                                            name={req.assignedProvider.fullName || 'P'}
                                            avatar={req.assignedProvider.avatar}
                                            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                                            fallbackBackground={`linear-gradient(135deg, ${C.blue}, #1e40af)`}
                                            initialsCount={1}
                                        />
                                        <div>
                                            <p className="font-bold" style={{ color: C.navy }}>{req.assignedProvider.fullName}</p>
                                            {req.assignedProvider.businessName && (
                                                <p className="text-sm" style={{ color: C.navy }}>{req.assignedProvider.businessName}</p>
                                            )}
                                            <p className="text-sm mt-0.5" style={{ color: C.gray }}>{req.assignedProvider.phoneNumber}</p>
                                            <p className="text-xs mt-0.5" style={{ color: C.gray }}>{req.assignedProvider.email}</p>
                                        </div>
                                    </div>
                                </SectionCard>
                            )}

                            {/* Location */}
                            <SectionCard title="Địa điểm" icon={<MapPin size={15} style={{ color: C.red }} />}>
                                <InfoRow label="Điểm đón" value={(req.pickupLocation as any)?.addressText || '—'} />
                                {(req.dropoffLocation as any)?.addressText && (
                                    <InfoRow label="Điểm đến" value={(req.dropoffLocation as any).addressText} />
                                )}
                                {req.matchedDistance && (
                                    <InfoRow label="Khoảng cách ETA" value={`${(req.matchedDistance / 1000).toFixed(1)} km · ${req.matchedEta} phút`} />
                                )}
                            </SectionCard>

                            {/* Timeline */}
                            <SectionCard title="Thời gian" icon={<Calendar size={15} style={{ color: C.purple }} />}>
                                <InfoRow label="Tạo lúc" value={fmtDt(req.createdAt)} />
                                {req.assignedAt && <InfoRow label="Phân công lúc" value={fmtDt(req.assignedAt)} />}
                                {req.completedAt && <InfoRow label="Hoàn thành lúc" value={fmtDt(req.completedAt)} />}
                            </SectionCard>

                            {/* Disputes */}
                            {req.disputeCases?.length > 0 && (
                                <SectionCard title="Khiếu nại liên quan" icon={<ShieldAlert size={15} style={{ color: C.red }} />}>
                                    {req.disputeCases.map((d: any) => (
                                        <div key={d.id} className="flex items-center justify-between p-3 rounded-xl border" style={{ borderColor: C.border }}>
                                            <div>
                                                <p className="text-xs font-semibold" style={{ color: C.navy }}>{d.reason}</p>
                                                <p className="text-[10px] mt-0.5" style={{ color: C.gray }}>{fmtDt(d.createdAt)}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold" style={{ color: C.orange }}>{fmtVnd(d.targetAmount)}</span>
                                                <button
                                                    onClick={() => router.push(`/admin/disputes/${d.id}`)}
                                                    className="text-[10px] font-bold px-2 py-1 rounded-lg"
                                                    style={{ background: C.blueLight, color: C.blue }}
                                                >
                                                    Xem
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </SectionCard>
                            )}

                            {/* Review */}
                            {req.review && (
                                <SectionCard title="Đánh giá" icon={<Star size={15} style={{ color: C.yellow }} />}>
                                    <div className="flex items-center gap-3 mb-2">
                                        <Stars rating={req.review.rating} />
                                        <span className="text-sm font-bold" style={{ color: C.navy }}>{req.review.rating}/5</span>
                                    </div>
                                    {req.review.comment && (
                                        <p className="text-sm italic" style={{ color: C.gray }}>"{req.review.comment}"</p>
                                    )}
                                </SectionCard>
                            )}
                        </>
                    )}

                    {/* ── TAB: Order Detail ── */}
                    {tab === 'order' && (
                        <>
                            {/* Rescue Details */}
                            <SectionCard title="Chi tiết cứu hộ" icon={<Wrench size={15} style={{ color: C.orange }} />}>
                                <InfoRow label="Loại sự cố" value={INCIDENT_LABELS[req.incidentType] || req.incidentType} />
                                <InfoRow label="Loại phương tiện" value={req.vehicleType === 'CAR' ? 'Ô tô' : 'Xe máy'} />
                                {req.licensePlate && <InfoRow label="Biển số xe" value={req.licensePlate} />}
                                {req.vehicleColor && <InfoRow label="Màu xe" value={req.vehicleColor} />}
                                {req.description && <InfoRow label="Mô tả sự cố" value={req.description} />}
                                <InfoRow label="Số điện thoại liên hệ" value={req.contactPhone || req.user?.phoneNumber || '—'} />
                                <InfoRow label="Số lần cố ghép" value={req.matchAttempts} />
                            </SectionCard>

                            {/* Payment */}
                            {payment && (
                                <SectionCard title="Thanh toán" icon={<Receipt size={15} style={{ color: C.green }} />}>
                                    <InfoRow label="Phương thức" value={PM_LABELS[payment.paymentMethod] || payment.paymentMethod} />
                                    <InfoRow label="Phí cơ bản" value={fmtVnd(payment.baseFee)} />
                                    {payment.distanceFee > 0 && <InfoRow label="Phí khoảng cách" value={fmtVnd(payment.distanceFee)} />}
                                    {payment.overtimeFee > 0 && <InfoRow label="Phí thêm giờ" value={fmtVnd(payment.overtimeFee)} />}
                                    {payment.otherFee > 0 && <InfoRow label="Phí khác" value={fmtVnd(payment.otherFee)} />}
                                    <div className="pt-2 mt-2 border-t" style={{ borderColor: C.border }}>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-bold" style={{ color: C.gray }}>Tổng cộng</span>
                                            <span className="text-lg font-bold" style={{ color: C.orange }}>{fmtVnd(payment.totalAmount)}</span>
                                        </div>
                                    </div>
                                    {payment.note && <InfoRow label="Ghi chú" value={payment.note} />}
                                    {payment.surchargeNote && <InfoRow label="Ghi chú phụ thu" value={payment.surchargeNote} />}
                                </SectionCard>
                            )}

                            {/* Quotes */}
                            {quotes?.length > 0 && (
                                <SectionCard title={`Báo giá (${quotes.length})`} icon={<Banknote size={15} style={{ color: C.blue }} />}>
                                    <div className="space-y-3">
                                        {quotes.map((q: any) => {
                                            const isAccepted = q.status === 'ACCEPTED';
                                            return (
                                                <div key={q.id} className="rounded-xl p-3 border"
                                                    style={{ borderColor: isAccepted ? C.green : C.border, background: isAccepted ? C.greenLight : C.bg }}>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex items-center gap-2">
                                                            <AvatarImage name={q.provider?.fullName || 'P'} avatar={q.provider?.avatar}
                                                                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                                                                fallbackBackground={C.blue} initialsCount={1} />
                                                            <span className="text-xs font-semibold" style={{ color: C.navy }}>{q.provider?.fullName}</span>
                                                        </div>
                                                        <span className="text-sm font-bold" style={{ color: isAccepted ? C.green : C.navy }}>{fmtVnd(q.price)}</span>
                                                    </div>
                                                    <p className="text-[10px]" style={{ color: C.gray }}>
                                                        ETA: {q.estimatedArrivalMinutes} phút
                                                        {isAccepted && ' · ✓ Đã được chọn'}
                                                    </p>
                                                    {q.message && <p className="text-xs mt-1 italic" style={{ color: C.gray }}>"{q.message}"</p>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </SectionCard>
                            )}

                            {/* Media */}
                            {req.media?.length > 0 && (
                                <SectionCard title="Hình ảnh / Video lúc tạo đơn" icon={<ImageIcon size={15} style={{ color: C.blue }} />}>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                        {req.media.map((m: any) => {
                                            const vid = m.mediaType === 'VIDEO' || isVideo(m.publicUrl || '');
                                            return (
                                                <button key={m.id}
                                                    onClick={() => setMediaPreview({ url: m.publicUrl, type: vid ? 'video' : 'image' })}
                                                    className="aspect-square overflow-hidden rounded-xl border relative group"
                                                    style={{ borderColor: C.border, background: '#f1f5f9' }}>
                                                    {vid ? (
                                                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-100">
                                                            <Film size={22} className="mb-1" />
                                                            <span className="text-[10px] uppercase font-bold">Video</span>
                                                        </div>
                                                    ) : (
                                                        <img src={m.publicUrl} alt="media" className="w-full h-full object-cover transition-opacity group-hover:opacity-80" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </SectionCard>
                            )}

                            {/* Payment photos */}
                            {payment?.photoUrls?.length > 0 && (
                                <SectionCard title="Ảnh xác nhận thanh toán" icon={<ImageIcon size={15} style={{ color: C.green }} />}>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                        {payment.photoUrls.map((url: string, i: number) => (
                                            <button key={i}
                                                onClick={() => setMediaPreview({ url, type: 'image' })}
                                                className="aspect-square overflow-hidden rounded-xl border"
                                                style={{ borderColor: C.border }}>
                                                <img src={url} alt="payment" className="w-full h-full object-cover" />
                                            </button>
                                        ))}
                                    </div>
                                </SectionCard>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Media Preview Lightbox */}
            {mediaPreview && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setMediaPreview(null)}>
                    <button className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30" onClick={() => setMediaPreview(null)}>
                        <X className="w-5 h-5 text-white" />
                    </button>
                    {mediaPreview.type === 'video' ? (
                        <video src={mediaPreview.url} controls className="max-w-full max-h-[80vh] rounded-xl" onClick={e => e.stopPropagation()} />
                    ) : (
                        <img src={mediaPreview.url} alt="preview" className="max-w-full max-h-[80vh] rounded-xl object-contain" onClick={e => e.stopPropagation()} />
                    )}
                </div>
            )}
        </AdminLayout>
    );
}
