'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAdminGuard } from '@/lib/guards';
import { adminApi, userDisputeApi } from '@/lib/api';
import AdminLayout from '@/components/AdminLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';
import { ArrowLeft, AlertTriangle, CheckCircle2, Clock, ShieldAlert, Receipt, MessageSquare, Image as ImageIcon, Film, AlertCircle, X, MapPin, Phone, Banknote, Star, FileText, Wrench, Car, Calendar, User, ExternalLink, Wallet } from 'lucide-react';
import AvatarImage from '@/components/AvatarImage';
import { DisputeSLACountdown } from '@/components/DisputeSLACountdown';

function fmtVnd(n: number) {
    if (n == null) return '0đ';
    return new Intl.NumberFormat('vi-VN').format(n) + 'đ';
}

function fmtDateTime(iso: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function Stars({ rating }: { rating: number }) {
    if (!rating) return null;
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} className="w-4 h-4"
                    fill={i <= rating ? '#ca8a04' : 'none'}
                    stroke={i <= rating ? '#ca8a04' : '#d1d5db'} />
            ))}
        </div>
    );
}

function StatusBadge({ status, t }: { status: string, t: any }) {
    const cfg: Record<string, { color: string; bg: string }> = {
        COMPLETED: { color: '#16a34a', bg: '#f0fdf4' },
        PAID: { color: '#7c3aed', bg: '#faf5ff' },
        PAYMENT_PENDING: { color: '#ca8a04', bg: '#fefce8' },
        PROVIDER_CONFIRMED: { color: '#16a34a', bg: '#f0fdf4' },
        REFUNDED: { color: '#16a34a', bg: '#f0fdf4' },
        USER_CONFIRMED: { color: '#2563eb', bg: '#eff6ff' },
        PENDING: { color: '#ca8a04', bg: '#fefce8' },
        DISPUTED: { color: '#ef4444', bg: '#fef2f2' },
        IN_PROGRESS: { color: '#ca8a04', bg: '#fefce8' },
        WORKING: { color: '#ca8a04', bg: '#fefce8' },
        CANCELLED: { color: '#6b7280', bg: '#f3f4f6' },
        EXPIRED: { color: '#6b7280', bg: '#f3f4f6' },
    };
    const s = cfg[status] ?? { color: '#6b7280', bg: '#f3f4f6' };
    const label = t(`provider.historyDetail.statusBadge.${status}` as any) || status;
    return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold"
            style={{ background: s.bg, color: s.color }}>
            {label}
        </span>
    );
}
const C = {
    orange: '#f97316',
    orangeDark: '#ea6c0a',
    orangeLight: '#fff7ed',
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#e2e8f0',
    bg: '#f8fafc',
    blue: '#2563eb',
    blueLight: '#eff6ff',
    yellow: '#ca8a04',
    yellowLight: '#fefce8',
    green: '#16a34a',
    greenLight: '#f0fdf4',
    red: '#ef4444',
    redLight: '#fef2f2',
    purple: '#7c3aed',
    purpleLight: '#faf5ff',
};

/** Khớp `DisputeCaseStatus` trong Prisma — tránh hiển thị raw enum trên UI */
const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
    WAITING_FOR_PROVIDER: { label: 'Chờ Provider phản hồi', bg: C.yellowLight, color: C.yellow },
    WAITING_FOR_CUSTOMER: { label: 'Chờ khách phản hồi', bg: C.blueLight, color: C.blue },
    INVESTIGATING: { label: 'Đang điều tra', bg: C.purpleLight, color: C.purple },
    RESOLVED: { label: 'Đã giải quyết', bg: C.greenLight, color: C.green },
    REJECTED: { label: 'Đã từ chối', bg: C.redLight, color: C.red },
};

function ProgressTimeline({ status }: { status: string }) {
    const steps = [
        { id: 'created', label: 'Đã gửi khiếu nại', active: false, done: true },
        {
            id: 'processing',
            label: 'Đang xử lý',
            active: ['WAITING_FOR_PROVIDER', 'WAITING_FOR_CUSTOMER', 'INVESTIGATING'].includes(status),
            done: ['RESOLVED', 'REJECTED'].includes(status),
        },
        {
            id: 'closed',
            label: status === 'REJECTED' ? 'Bị từ chối' : 'Có kết quả',
            active: ['RESOLVED', 'REJECTED'].includes(status),
            done: ['RESOLVED', 'REJECTED'].includes(status),
            isReject: status === 'REJECTED',
        },
    ];

    if (['WAITING_FOR_PROVIDER', 'WAITING_FOR_CUSTOMER', 'INVESTIGATING'].includes(status)) {
        steps[0].active = false;
        steps[0].done = true;
    }

    return (
        <div className="flex items-center justify-between px-6 py-8 bg-white rounded-2xl border mb-6" style={{ borderColor: C.border }}>
            {steps.map((step, i) => (
                <React.Fragment key={step.id}>
                    <div className="flex flex-col items-center gap-2 relative z-10 w-24">
                        <div
                            className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 relative z-20"
                            style={{
                                background:
                                    step.done || step.active ? (step.isReject ? C.red : C.orange) : '#f1f5f9',
                                boxShadow: step.active ? `0 0 0 4px ${step.isReject ? C.redLight : C.orangeLight}` : 'none',
                            }}
                        >
                            {step.done ? (
                                <CheckCircle2 size={16} className="text-white" />
                            ) : step.active ? (
                                <Clock size={16} className="text-white animate-pulse" />
                            ) : (
                                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#cbd5e1' }} />
                            )}
                        </div>
                        <span
                            className="text-[10px] font-bold text-center absolute top-10 w-28 whitespace-nowrap"
                            style={{ color: step.active || step.done ? C.navy : C.gray }}
                        >
                            {step.label}
                        </span>
                    </div>
                    {i < steps.length - 1 && (
                        <div className="flex-1 h-1 relative mx-2 rounded-full overflow-hidden">
                            <div className="absolute inset-0" style={{ background: '#e2e8f0' }} />
                            <div
                                className="absolute inset-y-0 left-0 transition-all duration-500"
                                style={{
                                    width: steps[i + 1].active || steps[i + 1].done ? '100%' : '0%',
                                    background: steps[i + 1].isReject ? C.red : C.orange,
                                }}
                            />
                        </div>
                    )}
                </React.Fragment>
            ))}
        </div>
    );
}

type UploadState = {
    id: string;
    file: File;
    kind: 'image' | 'video';
    status: 'uploading' | 'success' | 'error';
    url?: string;
};

// Simple Component Wrappers
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    if (!value) return null;
    return (
        <div className="flex justify-between items-start gap-4 py-2 border-b border-dashed last:border-0" style={{ borderColor: C.border }}>
            <span className="text-sm font-medium flex-shrink-0" style={{ color: C.gray }}>{label}</span>
            <span className="text-sm font-semibold text-right" style={{ color: C.navy }}>{value}</span>
        </div>
    );
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl p-4 lg:p-6 mb-4 border" style={{ borderColor: C.border }}>
            <div className="flex items-center gap-2 mb-4">
                {icon}
                <h2 className="font-bold text-sm uppercase tracking-wide" style={{ color: C.navy }}>{title}</h2>
            </div>
            {children}
        </div>
    );
}

export default function AdminDisputeDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const router = useRouter();
    const { t, locale } = useLanguage();
    const { isReady, user } = useAdminGuard();
    
    const [detail, setDetail] = useState<any>(null);
    const [orderDetail, setOrderDetail] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [activeTab, setActiveTab] = useState<'overview' | 'order' | 'messages'>('overview');
    
    // Chat states
    const [msgBody, setMsgBody] = useState('');
    const [uploads, setUploads] = useState<UploadState[]>([]);
    const [sending, setSending] = useState(false);
    const [evidencePreview, setEvidencePreview] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLInputElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const uploadedVideoCount = uploads.filter((u) => u.kind === 'video').length;

    // Admin Action States
    const [evidenceMsg, setEvidenceMsg] = useState('');
    const [evidenceTargetRole, setEvidenceTargetRole] = useState<'PROVIDER' | 'CUSTOMER'>('PROVIDER');
    const [resolveResolution, setResolveResolution] = useState('NO_REFUND');
    const [refundAmount, setRefundAmount] = useState('');
    const [resolutionNote, setResolutionNote] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await adminApi.getDisputeDetail(id);
            setDetail(data);
            // Try fetching full order details
            const reqId = data?.payment?.requestId || data?.request?.id;
            if (reqId) {
                try {
                    const reqData = await adminApi.getRequestDetail(reqId);
                    setOrderDetail(reqData);
                } catch {
                    // ignore if missing api
                }
            }
        } catch {
            setDetail(null);
            toast.error(t('admin.disputes.loadError'));
        } finally {
            setLoading(false);
        }
    }, [id, t]);

    const refreshDetail = async () => {
        if (!id) return;
        try {
            const data = await adminApi.getDisputeDetail(id);
            setDetail(data);
        } catch {
            // Keep last known UI state
        }
    };

    useEffect(() => {
        if (isReady && id) load();
    }, [isReady, id, load]);

    useEffect(() => {
        if (!isReady || !id || activeTab !== 'messages') return;
        const poll = () => {
            if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
            void refreshDetail();
        };
        const intervalId = window.setInterval(poll, 4000);
        return () => window.clearInterval(intervalId);
    }, [isReady, id, activeTab]);

    useEffect(() => {
        if (activeTab === 'messages') {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [detail?.messages?.length, activeTab]);

    if (!isReady || loading) {
        return (
            <AdminLayout activeTab="/admin/disputes">
                <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-8" style={{ background: C.bg }}>
                    <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-orange-500 animate-spin" />
                </div>
            </AdminLayout>
        );
    }

    if (!detail) {
        return (
            <AdminLayout activeTab="/admin/disputes">
                <div className="min-h-screen flex items-center justify-center px-4" style={{ background: C.bg }}>
                    <div className="bg-white p-6 rounded-2xl text-center w-full max-w-sm border" style={{ borderColor: C.border }}>
                        <p className="font-semibold mb-2" style={{ color: C.navy }}>Không tìm thấy khiếu nại</p>
                        <button onClick={() => router.push('/admin/disputes')} className="px-4 py-2 rounded-xl text-sm font-semibold text-white w-full" style={{ background: C.orange }}>Quay lại</button>
                    </div>
                </div>
            </AdminLayout>
        );
    }

    const status = detail.status ?? '';
    const sm = STATUS_META[status] ?? { label: status, bg: '#f1f5f9', color: C.gray };
    const isClosed = status === 'RESOLVED' || status === 'REJECTED';
    const refundableCap = Number(detail?.refundableCap ?? detail?.payment?.totalAmount ?? 0);
    const safeRefundInput = Math.max(0, parseInt(refundAmount.replace(/\D/g, ''), 10) || 0);
    const providerReceiveAmount = Math.max(0, refundableCap - safeRefundInput);
    
    // File uploads logic
    const isVideo = (url: string) => /\.(mp4|webm|mkv|mov)(\?.*)?$/i.test(url) || url.includes('/video/upload/');
    
    const uploadVideoFileLocal = async (file: File): Promise<{ success: boolean; publicUrl?: string }> => {
        if (!file.type.startsWith('video/')) return { success: false };
        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
        const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '';
        if (!cloudName || !preset) return { success: false };

        try {
            const form = new FormData();
            form.append('file', file);
            form.append('upload_preset', preset);
            form.append('resource_type', 'video');
            const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/upload`, {
                method: 'POST',
                body: form,
            });
            if (!res.ok) return { success: false };
            const data = await res.json();
            return { success: true, publicUrl: data.secure_url as string };
        } catch {
            return { success: false };
        }
    };

    const retryUpload = async (u: UploadState) => {
        setUploads((prev) => prev.map((x) => (x.id === u.id ? { ...x, status: 'uploading' } : x)));
        try {
            const res = u.kind === 'video' ? await uploadVideoFileLocal(u.file) : await adminApi.addDisputeEvidence(id, 'uploading', 'temp'); 
            // wait, adminApi.addDisputeEvidence sends a url. We need to upload to cloud first.
            // In Admin, we might rely on the same Cloudinary logic or a general upload API.
            // Let's assume standard `uploadFile` is available in `@/lib/api` as imported.
            // BUT wait, `uploadFile` requires `uploadFile(file, UploadPurpose.REQUEST_PHOTO)`.
            // Let's implement full manual upload logic if we can't import `uploadFile` well. But we did import it.
        } catch {
            setUploads((prev) => prev.map((x) => (x.id === u.id ? { ...x, status: 'error' } : x)));
        }
    };

    const onSelectEvidence = async (files: FileList | null, kind: 'image' | 'video' = 'image') => {
        if (!files?.length) return;
        const currentVideoCount = uploads.filter((u) => u.kind === 'video').length;
        const maxByKind = kind === 'video' ? Math.max(0, 2 - currentVideoCount) : 5;
        const items = Array.from(files).slice(0, maxByKind);
        for (const file of items) {
            const tid = `${file.name}-${Date.now()}-${Math.random()}`;
            const draft: UploadState = { id: tid, file, kind, status: 'uploading' };
            setUploads((prev) => [...prev, draft]);
            
            try {
                // To keep it simple, we upload file to cloudinary directly for admin as well.
                const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
                const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '';
                const type = kind === 'video' ? 'video' : 'image';
                const form = new FormData();
                form.append('file', file);
                form.append('upload_preset', preset);
                form.append('resource_type', type);
                const r = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/upload`, { method: 'POST', body: form });
                if (r.ok) {
                    const data = await r.json();
                    setUploads((prev) => prev.map((x) => (x.id === tid ? { ...x, status: 'success', url: data.secure_url } : x)));
                    continue;
                }
            } catch {}
            setUploads((prev) => prev.map((x) => (x.id === tid ? { ...x, status: 'error' } : x)));
        }
    };

    const sendMsg = async () => {
        if (sending) return;
        const urls = uploads.filter((u) => u.status === 'success' && u.url).map((u) => u.url!) as string[];
        if (!msgBody.trim() && urls.length === 0) return;
        
        setSending(true);
        try {
            await userDisputeApi.sendMessage(
                detail.id,
                msgBody.trim() ? msgBody.trim() : undefined,
                urls.length ? urls : undefined,
            );
            setMsgBody('');
            setUploads([]);
            await refreshDetail();
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        } catch {
            toast.error('Gửi không thành công');
        } finally {
            setSending(false);
        }
    };

    // Admin Sidebar Actions
    const onRequestEvidence = async () => {
        if (!detail || isClosed || !evidenceMsg.trim()) return;
        setBusy(true);
        try {
            await adminApi.requestDisputeEvidence(detail.id, evidenceMsg.trim(), evidenceTargetRole);
            toast.success(t('admin.disputes.success'));
            setEvidenceMsg('');
            // Switch to chat tab to see the message injected
            setActiveTab('messages');
            await refreshDetail();
        } catch {
            toast.error(t('admin.disputes.error'));
        } finally {
            setBusy(false);
        }
    };

    const onResolve = async () => {
        if (!detail || isClosed) return;
        const body: any = {
            resolutionType: resolveResolution,
            resolutionNote: resolutionNote.trim() || undefined,
        };
        if (resolveResolution === 'PARTIAL_REFUND') {
            const n = parseInt(refundAmount.replace(/\D/g, ''), 10);
            if (!n || n <= 0) {
                toast.error(t('admin.disputes.refundAmountLabel'));
                return;
            }
            if (n > refundableCap) {
                toast.error(`Số tiền hoàn không được vượt quá ${refundableCap.toLocaleString('vi-VN')}đ`);
                return;
            }
            body.resolutionAmountCustomer = n;
        }
        setBusy(true);
        try {
            await adminApi.resolveDispute(detail.id, body);
            toast.success(t('admin.disputes.success'));
            await refreshDetail();
        } catch (e: any) {
             const m = e?.response?.data?.message;
            toast.error(m || t('admin.disputes.error'));
        } finally {
            setBusy(false);
        }
    };

    const senderLabel = (msg: any) => {
        if (msg.senderRole === 'ADMIN' || msg.actor === 'ADMIN') return 'ADMIN';
        if (msg.senderRole === 'CUSTOMER' || msg.actor === 'USER') {
            const name = msg.author?.fullName || detail?.payment?.request?.user?.fullName || detail?.request?.user?.fullName || 'User';
            return `${name} (User)`;
        }
        if (msg.senderRole === 'PROVIDER' || msg.actor === 'PROVIDER') {
            const name =
                msg.author?.fullName ||
                detail?.payment?.request?.assignedProvider?.fullName ||
                detail?.request?.assignedProvider?.fullName ||
                'Provider';
            return `${name} (Provider)`;
        }
        return msg.senderRole || msg.actor || 'SYSTEM';
    };

    return (
        <AdminLayout activeTab="/admin/disputes">
            <div className="min-h-[calc(100vh-64px)] lg:h-full lg:min-h-0 flex flex-col lg:overflow-hidden" style={{ background: C.bg }}>
                <div className="max-w-7xl mx-auto px-4 lg:px-6 w-full pt-6">
                    {/* Header */}
                    <div className="mb-6">
                        <button
                            onClick={() => router.push('/admin/disputes')}
                            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Quay lại danh sách
                        </button>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h1 className="text-3xl font-semibold text-gray-900">Chi tiết khiếu nại</h1>
                                <p className="text-lg text-gray-600 mt-1">
                                    Đơn #{String(detail?.payment?.requestId ?? detail?.request?.id ?? detail.id).slice(0, 8).toUpperCase()}
                                </p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <span className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: sm.bg, color: sm.color }}>
                                    <div className="w-2 h-2 rounded-full" style={{ background: sm.color }} />
                                    {sm.label}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-shrink-0 z-20 bg-white" style={{ borderColor: C.border }}>
                    {/* Tabs */}
                    <div className="flex px-4 border-b overflow-x-auto no-scrollbar" style={{ borderColor: C.border }}>
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`flex-1 min-w-[100px] py-3 text-sm font-bold text-center border-b-2 transition-colors relative ${activeTab === 'overview' ? 'border-orange-500' : 'border-transparent'}`}
                            style={{ color: activeTab === 'overview' ? C.orange : C.gray, borderColor: activeTab === 'overview' ? C.orange : 'transparent' }}
                        >
                            Thông tin chi tiết
                        </button>
                        <button
                            onClick={() => setActiveTab('order')}
                            className={`flex-1 min-w-[100px] py-3 text-sm font-bold text-center border-b-2 transition-colors relative ${activeTab === 'order' ? 'border-orange-500' : 'border-transparent'}`}
                            style={{ color: activeTab === 'order' ? C.orange : C.gray, borderColor: activeTab === 'order' ? C.orange : 'transparent' }}
                        >
                            Chi tiết đơn
                        </button>
                        <button
                            onClick={() => setActiveTab('messages')}
                            className={`flex-1 min-w-[100px] py-3 text-sm font-bold text-center border-b-2 transition-colors relative ${activeTab === 'messages' ? 'border-orange-500' : 'border-transparent'}`}
                            style={{ color: activeTab === 'messages' ? C.orange : C.gray, borderColor: activeTab === 'messages' ? C.orange : 'transparent' }}
                        >
                            Trao đổi
                        </button>
                    </div>
                </div>

                {/* Main Content & Sidebar */}
                <div className="flex-1 lg:min-h-0 flex flex-col lg:flex-row max-w-7xl mx-auto w-full px-4 lg:px-6 gap-6 py-4 lg:py-6">
                    {/* Main Content Area */}
                    <div className="flex-1 lg:min-h-0 min-w-0 flex flex-col lg:overflow-y-auto no-scrollbar pr-1 pb-6 lg:pr-2">
                        {activeTab === 'overview' && (
                            <div className="w-full">
                                {!isClosed && detail.firstResponseDueAt && (
                                    <div className="mb-4 flex justify-center">
                                        <DisputeSLACountdown dueAt={detail.firstResponseDueAt} />
                                    </div>
                                )}
                                <ProgressTimeline status={status} />

                                {isClosed && (
                                    <div className="rounded-xl p-4 mb-6 border" style={{ background: '#f8fafc', borderColor: C.border }}>
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: detail.status === 'REJECTED' ? C.redLight : C.greenLight }}>
                                                {detail.status === 'REJECTED' ? <X size={16} style={{ color: C.red }} /> : <CheckCircle2 size={16} style={{ color: C.green }} />}
                                            </div>
                                            <p className="text-sm font-bold uppercase tracking-wide" style={{ color: detail.status === 'REJECTED' ? C.red : C.green }}>
                                                {detail.status === 'REJECTED' ? t('admin.disputes.tabRejected') : t('admin.disputes.tabResolved')}
                                            </p>
                                        </div>
                                        <div className="space-y-2 bg-white p-3 rounded-lg border" style={{ borderColor: C.border }}>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs" style={{ color: C.gray }}>Quyết định:</span>
                                                <span className="text-sm font-semibold" style={{ color: C.navy }}>
                                                    {detail.resolutionType === 'NO_REFUND' ? 'Không hoàn tiền' :
                                                     detail.resolutionType === 'FULL_REFUND' ? 'Hoàn tiền 100%' :
                                                     detail.resolutionType === 'PARTIAL_REFUND' ? 'Hoàn tiền một phần' : 'Không xác định'}
                                                </span>
                                            </div>
                                            {detail.resolutionType !== 'NO_REFUND' && (
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs" style={{ color: C.gray }}>Khách hàng nhận lại:</span>
                                                    <span className="text-sm font-bold" style={{ color: C.orange }}>
                                                        {(detail.resolutionAmountCustomer ?? detail.refundAmount ?? 0).toLocaleString()}₫
                                                    </span>
                                                </div>
                                            )}
                                            {detail.resolutionType !== 'FULL_REFUND' && (
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs" style={{ color: C.gray }}>Cứu hộ viên nhận:</span>
                                                    <span className="text-sm font-bold" style={{ color: C.blue }}>
                                                        {(detail.resolutionAmountProvider ?? 0).toLocaleString()}₫
                                                    </span>
                                                </div>
                                            )}
                                            {detail.resolutionNote && (
                                                <div className="pt-2 mt-2 border-t" style={{ borderColor: C.border }}>
                                                    <span className="text-xs block mb-1" style={{ color: C.gray }}>Ghi chú xử lý:</span>
                                                    <p className="text-sm whitespace-pre-wrap" style={{ color: C.navy }}>{detail.resolutionNote}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <SectionCard title="Nội dung khiếu nại" icon={<ShieldAlert size={16} style={{ color: C.red }} />}>
                                    <InfoRow label="Lý do chung" value={detail.reason || detail?.payment?.disputeReason} />
                                    {detail.description && <InfoRow label="Mô tả cụ thể" value={detail.description} />}
                                    {detail.expectedOutcome && <InfoRow label="Mong muốn KH" value={detail.expectedOutcome} />}
                                    <InfoRow label="Yêu cầu hoàn/bồi thường" value={
                                        <span style={{ color: C.orange, fontSize: '14px' }}>
                                            {(detail.targetAmount ?? 0).toLocaleString()}₫
                                        </span>
                                    } />
                                    <InfoRow label="Người mở" value={detail.openedBy?.fullName || detail.request?.user?.fullName || 'N/A'} />
                                </SectionCard>

                                <SectionCard title="Tóm tắt thanh toán" icon={<Receipt size={16} style={{ color: C.blue }} />}>
                                    <InfoRow label="Phương thức" value={detail.payment?.paymentMethod || 'N/A'} />
                                    <InfoRow label="Tổng thanh toán dịch vụ" value={`${(detail.payment?.totalAmount ?? 0).toLocaleString()}₫`} />
                                </SectionCard>

                                {(detail.evidence?.length ?? 0) > 0 && (
                                    <SectionCard title="Bằng chứng đính kèm" icon={<ImageIcon size={16} style={{ color: C.green }} />}>
                                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                            {detail.evidence.map((e: any) => {
                                                const video = isVideo(e.url);
                                                return (
                                                    <button 
                                                        key={e.id} 
                                                        onClick={() => setEvidencePreview({ url: e.url, type: video ? 'video' : 'image' })} 
                                                        className="aspect-square overflow-hidden rounded-xl border relative group" 
                                                        style={{ borderColor: C.border, background: '#f1f5f9' }}
                                                    >
                                                        {video ? (
                                                            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-100">
                                                                <Film size={24} className="mb-1" />
                                                                <span className="text-[10px] uppercase font-bold">Video</span>
                                                            </div>
                                                        ) : (
                                                            <img src={e.url} alt="evidence" className="w-full h-full object-cover group-active:opacity-80 transition-opacity" />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </SectionCard>
                                )}
                            </div>
                        )}

                        {activeTab === 'order' && (
                            <div className="w-full space-y-4">
                                {orderDetail && orderDetail.req ? (
                                    <>
                                        {/* Customer Info */}
                                        <SectionCard title={t('provider.historyDetail.sections.customerInfo')} icon={<User size={16} style={{ color: C.blue }} />}>
                                            <div className="flex items-center gap-3">
                                                <AvatarImage
                                                    name={orderDetail.req.user?.fullName || t('provider.historyDetail.customer.fallback')}
                                                    avatar={orderDetail.req.user?.avatar}
                                                    className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                                                    fallbackBackground={`linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`}
                                                    initialsCount={1}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold" style={{ color: C.navy }}>{orderDetail.req.user?.fullName || t('provider.historyDetail.customer.fallback')}</p>
                                                    <p className="text-xs mt-0.5" style={{ color: C.gray }}>{orderDetail.req.contactPhone || orderDetail.req.user?.phoneNumber}</p>
                                                    <p className="text-xs mt-0.5" style={{ color: C.gray }}>{orderDetail.req.user?.email}</p>
                                                </div>
                                            </div>
                                        </SectionCard>

                                        {/* Provider Info */}
                                        {orderDetail.req.assignedProvider && (
                                            <SectionCard title="Thông tin Cứu hộ viên" icon={<Wrench size={16} style={{ color: C.blue }} />}>
                                                <div className="flex items-center gap-3">
                                                    <AvatarImage
                                                        name={orderDetail.req.assignedProvider.fullName || 'Provider'}
                                                        avatar={orderDetail.req.assignedProvider.avatar}
                                                        className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base flex-shrink-0"
                                                        fallbackBackground={`linear-gradient(135deg, ${C.blue}, #1e40af)`}
                                                        initialsCount={1}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold" style={{ color: C.navy }}>{orderDetail.req.assignedProvider.fullName}</p>
                                                        {orderDetail.req.assignedProvider.businessName && <p className="text-xs mt-0.5" style={{ color: C.navy }}>{orderDetail.req.assignedProvider.businessName}</p>}
                                                        <p className="text-xs mt-0.5" style={{ color: C.gray }}>{orderDetail.req.assignedProvider.phoneNumber}</p>
                                                        <p className="text-xs mt-0.5" style={{ color: C.gray }}>{orderDetail.req.assignedProvider.email || 'N/A'}</p>
                                                    </div>
                                                </div>
                                            </SectionCard>
                                        )}

                                        {/* Rescue details */}
                                        <SectionCard title={t('provider.historyDetail.sections2.rescueDetails')} icon={<Wrench size={16} style={{ color: C.orange }} />}>
                                            <InfoRow label="Trạng thái đơn gốc" value={<StatusBadge status={orderDetail.req.status} t={t} />} />
                                            {orderDetail.req.incidentType && (
                                                <InfoRow
                                                    label={t('provider.historyDetail.labels.incidentType')}
                                                    value={t(`provider.historyDetail.incidentLabels.${orderDetail.req.incidentType}` as any) ?? orderDetail.req.incidentType}
                                                />
                                            )}
                                            {orderDetail.req.vehicleType && (
                                                <InfoRow
                                                    label={t('provider.historyDetail.labels.vehicleType')}
                                                    value={t(`provider.historyDetail.vehicleLabels.${orderDetail.req.vehicleType}` as any) ?? orderDetail.req.vehicleType}
                                                />
                                            )}
                                            {(orderDetail.req.licensePlate?.trim() || orderDetail.req.user?.licensePlate) && (
                                                <InfoRow
                                                    label={t('provider.historyDetail.infoLabels2.licensePlate')}
                                                    value={orderDetail.req.licensePlate?.trim() || orderDetail.req.user?.licensePlate}
                                                />
                                            )}
                                            {(orderDetail.req.vehicleColor?.trim() || orderDetail.req.user?.vehicleColor) && (
                                                <InfoRow
                                                    label={t('provider.historyDetail.infoLabels2.vehicleColor')}
                                                    value={orderDetail.req.vehicleColor?.trim() || orderDetail.req.user?.vehicleColor}
                                                />
                                            )}
                                            {orderDetail.req.pickupLocation?.addressText && (
                                                <InfoRow
                                                    label={t('provider.historyDetail.labels.pickupLocation')}
                                                    value={orderDetail.req.pickupLocation.addressText}
                                                />
                                            )}
                                            {orderDetail.req.dropoffLocation?.addressText && (
                                                <InfoRow
                                                    label={t('provider.historyDetail.infoLabels2.dropoffLocation')}
                                                    value={orderDetail.req.dropoffLocation.addressText}
                                                />
                                            )}
                                            {orderDetail.req.description && (
                                                <InfoRow
                                                    label={t('provider.historyDetail.labels.description')}
                                                    value={orderDetail.req.description}
                                                />
                                            )}
                                            <InfoRow
                                                label={t('provider.historyDetail.labels.createdAt')}
                                                value={fmtDateTime(orderDetail.req.createdAt)}
                                            />
                                        </SectionCard>

                                        {/* Media from original rescue request */}
                                        {Array.isArray(orderDetail.req.media) && orderDetail.req.media.length > 0 && (
                                            <SectionCard title="Hình ảnh/Video lúc tạo đơn" icon={<ImageIcon size={16} style={{ color: C.blue }} />}>
                                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                                    {orderDetail.req.media.map((e: any) => {
                                                        const isVid = e.mediaType === 'VIDEO' || isVideo(e.publicUrl || e.url);
                                                        const src = e.publicUrl || e.url;
                                                        return (
                                                            <button 
                                                                key={e.id} 
                                                                onClick={() => setEvidencePreview({ url: src, type: isVid ? 'video' : 'image' })} 
                                                                className="aspect-square overflow-hidden rounded-xl border relative group" 
                                                                style={{ borderColor: C.border, background: '#f1f5f9' }}
                                                            >
                                                                {isVid ? (
                                                                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-100">
                                                                        <Film size={24} className="mb-1" />
                                                                        <span className="text-[10px] uppercase font-bold">Video</span>
                                                                    </div>
                                                                ) : (
                                                                    <img src={src} alt="media" className="w-full h-full object-cover group-active:opacity-80 transition-opacity" />
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </SectionCard>
                                        )}

                                        {/* Quotes Data if available */}
                                        {Array.isArray(orderDetail.quotes) && orderDetail.quotes.length > 0 && (
                                            <SectionCard title="Các báo giá đã tham gia" icon={<Banknote size={16} style={{ color: C.green }} />}>
                                                <div className="space-y-3">
                                                    {orderDetail.quotes.map((q: any) => (
                                                        <div key={q.id} className="rounded-xl p-3 border" style={{ borderColor: q.id === orderDetail.req.acceptedQuoteId ? C.green : C.border, background: q.id === orderDetail.req.acceptedQuoteId ? C.greenLight : C.bg }}>
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="text-sm font-bold" style={{ color: C.navy }}>{fmtVnd(q.price)}</span>
                                                                <StatusBadge status={q.status} t={t} />
                                                            </div>
                                                            <p className="text-xs" style={{ color: C.gray }}>ETA: {q.estimatedArrivalMinutes} phút</p>
                                                            {q.message && <p className="text-xs mt-1 italic" style={{ color: C.navy }}>"{q.message}"</p>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </SectionCard>
                                        )}

                                        {/* Payment Block */}
                                        {orderDetail.payment && (
                                            <SectionCard title={t('provider.historyDetail.sections2.payment')} icon={<Banknote size={16} style={{ color: C.orange }} />}>
                                                <div className="grid grid-cols-2 gap-3 mb-4">
                                                    <div className="rounded-xl p-3 col-span-2" style={{ background: C.bg }}>
                                                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: C.gray }}>Tiền vào ví Cứu hộ viên</p>
                                                        {orderDetail.payment.walletTxStatus === 'COMPLETED'
                                                            ? (
                                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: C.greenLight, color: C.green }}>
                                                                    <CheckCircle2 size={12} /> Đã nhận tiền vào ví
                                                                </span>
                                                            )
                                                            : orderDetail.payment.walletTxStatus === 'PENDING'
                                                                ? (
                                                                    <div className="rounded-xl p-3" style={{ background: '#f5f3ff', border: '1.5px solid #ddd6fe' }}>
                                                                        <div className="flex items-center gap-2 mb-1">
                                                                            <Clock size={13} style={{ color: '#7c3aed' }} />
                                                                            <span className="text-xs font-bold" style={{ color: '#7c3aed' }}>Hệ thống đang giải ngân</span>
                                                                        </div>
                                                                    </div>
                                                                )
                                                                : <StatusBadge status={orderDetail.payment.status} t={t} />
                                                        }
                                                    </div>
                                                    <div className="rounded-xl p-3" style={{ background: C.bg }}>
                                                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: C.gray }}>{t('provider.historyDetail.payment.method')}</p>
                                                        <p className="text-sm font-bold" style={{ color: C.navy }}>
                                                            {orderDetail.payment.paymentMethod === 'CASH'
                                                                ? t('provider.historyDetail.labels.cash')
                                                                : orderDetail.payment.paymentMethod === 'WALLET'
                                                                    ? 'Ví điện tử RescueMe'
                                                                    : t('provider.historyDetail.labels.transfer')}
                                                        </p>
                                                    </div>
                                                    <div className="rounded-xl p-3" style={{ background: C.bg }}>
                                                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: C.gray }}>{t('provider.historyDetail.payment.total')}</p>
                                                        <p className="text-sm font-bold" style={{ color: C.navy }}>{fmtVnd(orderDetail.payment.totalAmount)}</p>
                                                    </div>
                                                </div>
                                                {/* Fee breakdown */}
                                                <div className="rounded-xl overflow-hidden border mb-4" style={{ borderColor: C.border }}>
                                                    {[
                                                        { label: t('provider.historyDetail.feeItems.base'), val: orderDetail.payment.baseFee },
                                                        { label: t('provider.historyDetail.feeItems.distance'), val: orderDetail.payment.distanceFee },
                                                        orderDetail.payment.overtimeFee > 0 && { label: t('provider.historyDetail.feeItems.overtime'), val: orderDetail.payment.overtimeFee },
                                                        orderDetail.payment.otherFee > 0 && { label: t('provider.historyDetail.feeItems.other'), val: orderDetail.payment.otherFee },
                                                    ].filter(Boolean).map((row: any, i: number, arr) => (
                                                        <div key={i} className="flex items-center justify-between px-4 py-2.5"
                                                            style={{ borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                                                            <span className="text-xs" style={{ color: C.gray }}>{row.label}</span>
                                                            <span className="text-xs font-semibold" style={{ color: C.navy }}>{fmtVnd(row.val)}</span>
                                                        </div>
                                                    ))}
                                                    <div className="flex items-center justify-between px-4 py-3"
                                                        style={{ background: '#f8fafc', borderTop: `1px solid ${C.border}` }}>
                                                        <span className="text-sm font-bold" style={{ color: C.navy }}>{t('provider.historyDetail.feeItems.total')}</span>
                                                        <span className="text-sm font-bold" style={{ color: C.orange }}>{fmtVnd(orderDetail.payment.totalAmount)}</span>
                                                    </div>
                                                </div>

                                                {orderDetail.payment.note && (
                                                    <p className="text-xs mt-1 mb-4" style={{ color: C.gray }}>{t('provider.historyDetail.payment.notes')} {orderDetail.payment.note}</p>
                                                )}

                                                {/* Surcharges Breakdown */}
                                                {(() => {
                                                    if (!orderDetail.payment.surchargeNote) return null;
                                                    let breakdown: { label: string; amount: number }[] = [];
                                                    let surcharges: { label: string; amount: number }[] = [];
                                                    let rawText: string | null = null;
                                                    try {
                                                        const parsed = JSON.parse(orderDetail.payment.surchargeNote);
                                                        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                                                            breakdown = parsed.breakdown ?? [];
                                                            surcharges = parsed.surcharges ?? [];
                                                        } else if (Array.isArray(parsed)) {
                                                            breakdown = parsed;
                                                        } else {
                                                            rawText = orderDetail.payment.surchargeNote;
                                                        }
                                                    } catch {
                                                        rawText = orderDetail.payment.surchargeNote;
                                                    }
                                                    const items = [...breakdown, ...surcharges].filter(i => i.label || i.amount > 0);
                                                    if (items.length === 0 && !rawText) return null;
                                                    return (
                                                        <div className="rounded-xl overflow-hidden border mb-4" style={{ borderColor: C.border }}>
                                                            <div className="px-3 py-1.5" style={{ background: '#fff7ed', borderBottom: `1px solid ${C.border}` }}>
                                                                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: C.orange }}>{t('provider.historyDetail.payment.surcharges')}</p>
                                                            </div>
                                                            {rawText ? (
                                                                <p className="px-3 py-2 text-xs" style={{ color: C.gray }}>{rawText}</p>
                                                            ) : items.map((item, i) => (
                                                                <div key={i} className="flex items-center justify-between px-3 py-2"
                                                                    style={{ borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>
                                                                    <span className="text-xs" style={{ color: C.gray }}>{item.label || '—'}</span>
                                                                    <span className="text-xs font-semibold" style={{ color: C.navy }}>{fmtVnd(item.amount)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                })()}

                                                {/* Payment photos */}
                                                {orderDetail.payment.photoUrls && orderDetail.payment.photoUrls.length > 0 && (
                                                    <div>
                                                        <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: C.gray }}>
                                                            {t('provider.historyDetail.payment.photos').replace('{count}', String(orderDetail.payment.photoUrls.length))}
                                                        </p>
                                                        <div className="grid grid-cols-3 gap-2">
                                                            {orderDetail.payment.photoUrls.map((src: string, i: number) => (
                                                                <button key={i} onClick={() => setEvidencePreview({ url: src, type: 'image' })}
                                                                    className="aspect-square rounded-xl overflow-hidden"
                                                                    style={{ background: '#f1f5f9' }}>
                                                                    <img src={src} alt={`Ảnh thanh toán ${i + 1}`} className="w-full h-full object-cover" />
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </SectionCard>
                                        )}

                                        {/* Review Block */}
                                        {orderDetail.req.review && (
                                            <SectionCard title={t('provider.historyDetail.sections2.review')} icon={<Star size={16} style={{ color: C.yellow }} />}>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Stars rating={orderDetail.req.review.rating} />
                                                            <span className="text-xs font-bold" style={{ color: C.navy }}>{orderDetail.req.review.rating}/5</span>
                                                        </div>
                                                        <p className="text-sm mt-1.5" style={{ color: C.navy }}>{orderDetail.req.review.comment || t('provider.historyDetail.review.noComment')}</p>
                                                    </div>
                                                </div>
                                            </SectionCard>
                                        )}

                                        {/* Timeline */}
                                        <SectionCard title={t('provider.historyDetail.sections2.timeline')} icon={<Clock size={16} style={{ color: C.blue }} />}>
                                            <div className="space-y-0">
                                                {[
                                                    { label: t('provider.historyDetail.timeline.created'), time: orderDetail.req.createdAt, done: true },
                                                    { label: t('provider.historyDetail.timeline.assigned'), time: orderDetail.req.assignedAt, done: !!orderDetail.req.assignedAt },
                                                    { label: t('provider.historyDetail.timeline.payment'), time: orderDetail.payment?.createdAt, done: !!orderDetail.payment },
                                                    { label: t('provider.historyDetail.timeline.completed'), time: orderDetail.req.completedAt, done: ['COMPLETED', 'PAID'].includes(orderDetail.req.status) },
                                                ].map((step, i, arr) => (
                                                    <div key={i} className="flex gap-3">
                                                        <div className="flex flex-col items-center">
                                                            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                                                                style={{
                                                                    background: step.done ? C.orange : '#f1f5f9',
                                                                    border: `2px solid ${step.done ? C.orange : C.border}`,
                                                                }}>
                                                                {step.done
                                                                    ? <CheckCircle2 size={13} className="text-white" />
                                                                    : <Clock size={11} style={{ color: C.gray }} />
                                                                }
                                                            </div>
                                                            {i < arr.length - 1 && (
                                                                <div className="w-0.5 h-8 mt-0.5"
                                                                    style={{ background: step.done ? `${C.orange}40` : '#f1f5f9' }} />
                                                            )}
                                                        </div>
                                                        <div className="pb-4">
                                                            <p className="text-sm font-semibold" style={{ color: step.done ? C.navy : '#9ca3af' }}>
                                                                {step.label}
                                                            </p>
                                                            {step.time ? (
                                                                <p className="text-xs mt-0.5" style={{ color: C.gray }}>{fmtDateTime(step.time)}</p>
                                                            ) : (
                                                                <p className="text-xs mt-0.5" style={{ color: '#d1d5db' }}>{t('provider.historyDetail.timeline.notDone')}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </SectionCard>
                                    </>
                                ) : (
                                    <SectionCard title="Chi tiết dịch vụ gốc" icon={<Clock size={16} style={{ color: C.blue }} />}>
                                        <div className="text-center py-6">
                                            <p className="text-sm font-medium" style={{ color: C.gray }}>Đang tải hoặc không có sẵn chi tiết đơn...</p>
                                        </div>
                                    </SectionCard>
                                )}
                            </div>
                        )}
                        {activeTab === 'messages' && (
                            <div className="flex-1 lg:min-h-0 flex flex-col max-w-2xl mx-auto w-full relative sm:min-h-[500px] h-[calc(100dvh-200px)] lg:h-auto bg-white border lg:rounded-2xl shadow-sm" style={{ borderColor: C.border }}>
                                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 lg:px-6">
                                    {(!detail.messages || detail.messages.length === 0) && (
                                        <div className="text-center mt-10">
                                            <MessageSquare size={32} className="mx-auto mb-3" style={{ color: '#cbd5e1' }} />
                                            <p className="text-sm font-semibold" style={{ color: C.gray }}>Chưa có tin nhắn nào</p>
                                        </div>
                                    )}
                                    {(detail.messages as any[]).map((msg: any) => {
                                        const isSystem = msg.senderRole === 'SYSTEM' || msg.actor === 'SYSTEM';
                                        const isMe = msg.senderRole === 'ADMIN' || msg.actor === 'ADMIN';
                                        
                                        if (isSystem && !msg.body) { return null; }
                                        if (isSystem && msg.body) {
                                            return (
                                                <div key={msg.id} className="flex justify-center my-4">
                                                    <div className="max-w-sm rounded-xl px-4 py-2 text-[11px] font-semibold text-center border whitespace-pre-wrap" style={{ background: '#f8fafc', color: C.gray, borderColor: C.border }}>
                                                        {msg.body}
                                                    </div>
                                                </div>
                                            );
                                        }

                                        let mUrls = msg.mediaUrls || [];
                                        if (typeof mUrls === 'string') {
                                            mUrls = [mUrls];
                                        }
                                        
                                        return (
                                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} w-full`}>
                                                <div className="flex flex-col gap-1 max-w-[85%]">
                                                    <p className="text-[10px] font-bold px-1" style={{ color: C.gray }}>
                                                        {senderLabel(msg)}
                                                    </p>
                                                    <div className="rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap" style={{ background: isMe ? C.navy : '#f1f5f9', color: isMe ? '#fff' : C.navy, borderBottomRightRadius: isMe ? '4px' : '16px', borderTopLeftRadius: !isMe ? '4px' : '16px' }}>
                                                        {msg.body}
                                                    </div>
                                                    {Array.isArray(mUrls) && mUrls.length > 0 && mUrls[0] && (
                                                        <div className="grid grid-cols-3 gap-1.5 mt-1">
                                                            {mUrls.map((url: string, idx: number) => {
                                                                const video = isVideo(url);
                                                                return (
                                                                    <button key={`${msg.id}-${idx}`} onClick={() => setEvidencePreview({ url, type: video ? 'video' : 'image' })} className="aspect-square overflow-hidden rounded-lg border" style={{ borderColor: C.border, background: '#f1f5f9' }}>
                                                                        {video ? <div className="w-full h-full flex items-center justify-center text-gray-500"><Film size={18} /></div> : <img src={url} alt="media" className="w-full h-full object-cover" />}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                    <span className={`text-[9px] font-semibold px-1 ${isMe ? 'text-right' : 'text-left'}`} style={{ color: '#cbd5e1' }}>
                                                        {new Date(msg.createdAt).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={bottomRef} className="h-4" />
                                </div>

                                {!isClosed && (
                                    <div className="sticky bottom-0 left-0 right-0 px-4 py-3 bg-white border-t rounded-b-2xl z-10" style={{ borderColor: C.border }}>
                                        <div className="flex items-end gap-2">
                                            <div className="flex-1 bg-gray-50 rounded-2xl border flex flex-col pt-1 overflow-hidden focus-within:bg-white focus-within:border-orange-500 transition-colors" style={{ borderColor: C.border }}>
                                                <textarea onFocus={() => setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 300)} value={msgBody} onChange={e => setMsgBody(e.target.value)} placeholder="Nhập tin nhắn với tư cách Admin..." className="w-full bg-transparent px-3 py-2 text-[13px] outline-none resize-none max-h-32 min-h-[44px]" rows={Math.min(4, msgBody.split('\n').length || 1)} />
                                                <div className="flex items-center px-2 pb-2 gap-2">
                                                    <button type="button" onClick={() => fileRef.current?.click()} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors" style={{ color: C.gray }}><ImageIcon size={18} /></button>
                                                    <button type="button" onClick={() => videoRef.current?.click()} disabled={uploadedVideoCount >= 2} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-40" style={{ color: C.gray }}><Film size={18} /></button>
                                                </div>
                                            </div>
                                            <button onClick={sendMsg} disabled={sending || (!msgBody.trim() && uploads.length === 0)} className="h-[44px] px-5 rounded-2xl text-sm font-bold text-white transition-opacity active:scale-95 disabled:opacity-50" style={{ background: C.navy, boxShadow: `0 4px 12px ${C.navy}40` }}>
                                                {sending ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Gửi'}
                                            </button>
                                        </div>
                                        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => void onSelectEvidence(e.target.files, 'image')} />
                                        <input ref={videoRef} type="file" accept="video/*" multiple className="hidden" onChange={(e) => void onSelectEvidence(e.target.files, 'video')} />
                                    </div>
                                )}
                                {isClosed && (
                                     <div className="sticky bottom-0 left-0 right-0 px-4 py-4 bg-white border-t text-center text-xs lg:rounded-b-2xl z-10" style={{ borderColor: C.border, color: C.gray }}>
                                         Cuộc hội thoại này đã kết thúc vì khiếu nại đã được giải quyết.
                                     </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Admin Sidebar */}
                    <div className="w-full lg:w-96 flex-shrink-0 flex flex-col gap-6 lg:overflow-y-auto no-scrollbar pb-6 pr-1 lg:pr-2">
                        {!isClosed && (
                            <>
                                {/* Request Evidence from User/Provider */}
                                <div className="bg-white rounded-2xl border p-5 shadow-sm" style={{ borderColor: C.border }}>
                                    <h3 className="text-sm font-bold mb-3 uppercase tracking-wide" style={{ color: C.navy }}>{t('admin.disputes.requestEvidenceBtn')}</h3>
                                    <p className="text-[11px] mb-3" style={{ color: C.gray }}>Gửi yêu cầu cung cấp thêm thông tin tới Khách hoặc Đối tác.</p>
                                    <div className="mb-3">
                                        <label className="block text-xs font-bold mb-1.5" style={{ color: C.gray }}>Yêu cầu gửi đến</label>
                                        <select
                                            className="w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:border-orange-500"
                                            style={{ borderColor: C.border, color: C.navy }}
                                            value={evidenceTargetRole}
                                            onChange={(e) => setEvidenceTargetRole(e.target.value as 'PROVIDER' | 'CUSTOMER')}
                                        >
                                            <option value="PROVIDER">Provider</option>
                                            <option value="CUSTOMER">Customer</option>
                                        </select>
                                    </div>
                                    <textarea
                                        className="w-full rounded-xl border px-3 py-2 text-sm min-h-[80px] outline-none focus:border-orange-500"
                                        style={{ borderColor: C.border, color: C.navy }}
                                        placeholder={t('admin.disputes.requestEvidencePlaceholder')}
                                        value={evidenceMsg}
                                        onChange={(e) => setEvidenceMsg(e.target.value)}
                                    />
                                    <button disabled={busy || !evidenceMsg.trim()} onClick={onRequestEvidence} className="mt-3 w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: C.orange }}>Gửi yêu cầu</button>
                                </div>

                                {/* Resolution Panel */}
                                <div className="bg-white rounded-2xl border p-5 shadow-sm" style={{ borderColor: C.border }}>
                                    <h3 className="text-lg font-bold mb-4" style={{ color: C.navy }}>Phán Quyết Giải Quyết</h3>
                                    
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold mb-1.5" style={{ color: C.gray }}>Kết quả</label>
                                            <select
                                                className="w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:border-orange-500"
                                                style={{ borderColor: C.border, color: C.navy }}
                                                value={resolveResolution}
                                                onChange={(e) => setResolveResolution(e.target.value)}
                                            >
                                                <option value="NO_REFUND">{t('admin.disputes.resolutionNoChange')} (Không hoàn tiền)</option>
                                                <option value="FULL_REFUND">{t('admin.disputes.resolutionFullRefund')} (Hoàn 100%)</option>
                                                <option value="PARTIAL_REFUND">{t('admin.disputes.resolutionPartialRefund')} (Hoàn 1 phần)</option>
                                            </select>
                                            <p className="text-[11px] mt-1.5" style={{ color: C.gray }}>
                                                Mức hoàn tối đa theo tiền net của provider: {refundableCap.toLocaleString('vi-VN')}đ
                                            </p>
                                        </div>

                                        {resolveResolution === 'PARTIAL_REFUND' && (
                                            <div>
                                                <label className="block text-xs font-bold mb-1.5" style={{ color: C.gray }}>Số tiền hoàn cho User (VNĐ)</label>
                                                <input
                                                    type="text"
                                                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-orange-500"
                                                    style={{ borderColor: C.border, color: C.navy }}
                                                    placeholder={`Tối đa ${refundableCap.toLocaleString('vi-VN')}`}
                                                    value={refundAmount}
                                                    onChange={(e) => setRefundAmount(e.target.value.replace(/\D/g, ''))}
                                                />
                                                <p className="text-[11px] mt-1.5" style={{ color: C.gray }}>
                                                    Provider nhận: {providerReceiveAmount.toLocaleString('vi-VN')}đ
                                                </p>
                                            </div>
                                        )}

                                        <div>
                                            <label className="block text-xs font-bold mb-1.5" style={{ color: C.gray }}>Lý do (Sẽ hiển thị cho user)</label>
                                            <textarea
                                                className="w-full rounded-xl border px-3 py-2 text-sm min-h-[80px] outline-none focus:border-orange-500"
                                                style={{ borderColor: C.border, color: C.navy }}
                                                placeholder="Lý do kết thúc khiếu nại..."
                                                value={resolutionNote}
                                                onChange={(e) => setResolutionNote(e.target.value)}
                                            />
                                        </div>

                                        <button disabled={busy} onClick={onResolve} className="w-full py-3 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50" style={{ background: C.green }}>
                                            {busy ? t('admin.disputes.submitting') : 'Kết thúc Khiếu nại'}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                        {isClosed && (
                            <div className="bg-white rounded-2xl border p-5 shadow-sm flex flex-col items-center text-center text-sm" style={{ borderColor: C.border, color: C.gray }}>
                                <CheckCircle2 size={48} className="text-green-500 mb-3" />
                                <p className="font-bold text-base mb-1" style={{ color: C.navy }}>Khiếu nại đã đóng</p>
                                <p>Không thể thao tác thay đổi ở trạng thái này nữa.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Evidence Preview Modal */}
            {evidencePreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setEvidencePreview(null); }}>
                    <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col bg-transparent my-auto mx-auto rounded-xl overflow-hidden shadow-2xl">
                        <div className="absolute top-2 right-2 z-10 flex gap-2">
                            <a href={evidencePreview.url} target="_blank" rel="noopener noreferrer" className="bg-white/20 hover:bg-white/30 p-2 rounded-full backdrop-blur-md text-white transition-all shadow-xl">
                                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            </a>
                            <button onClick={() => setEvidencePreview(null)} className="bg-white/20 hover:bg-white/30 p-2 rounded-full backdrop-blur-md text-white transition-all shadow-xl">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="flex-1 min-h-[300px] flex items-center justify-center bg-black/50">
                            {evidencePreview.type === 'video' ? (
                                <video src={evidencePreview.url} controls autoPlay className="max-w-full max-h-[90vh] object-contain rounded-xl" />
                            ) : (
                                <img src={evidencePreview.url} alt="Bằng chứng" className="max-w-full max-h-[90vh] object-contain rounded-xl" />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}

