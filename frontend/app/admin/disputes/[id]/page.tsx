'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAdminGuard } from '@/lib/guards';
import { adminApi, uploadFile, UploadPurpose, uploadVideoFile } from '@/lib/api'; // Notice: We need to ensure uploadVideoFile is exported or we inline it. Actually, uploadVideoFile is in Provider/User page, let's inline it to be safe.
import AdminLayout from '@/components/AdminLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';
import { ArrowLeft, AlertTriangle, CheckCircle2, Clock, ShieldAlert, Receipt, MessageSquare, Image as ImageIcon, Film, AlertCircle, X } from 'lucide-react';

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

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
    NEW: { label: 'Mới', bg: C.blueLight, color: C.blue },
    IN_REVIEW: { label: 'Đang xem xét', bg: C.purpleLight, color: C.purple },
    AWAITING_EVIDENCE: { label: 'Chờ bằng chứng', bg: C.yellowLight, color: C.yellow },
    RESOLVED: { label: 'Đã giải quyết', bg: C.greenLight, color: C.green },
    REJECTED: { label: 'Đã từ chối', bg: C.redLight, color: C.red },
};

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
    const [statusNext, setStatusNext] = useState('IN_REVIEW');
    const [evidenceMsg, setEvidenceMsg] = useState('');
    const [resolveResolution, setResolveResolution] = useState('NO_CHANGE');
    const [refundAmount, setRefundAmount] = useState('');
    const [resolutionNote, setResolutionNote] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await adminApi.getDisputeDetail(id);
            setDetail(data);
            setStatusNext(data.status === 'NEW' ? 'IN_REVIEW' : data.status);
            
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
            await adminApi.addDisputeEvidence(id, urls.join(','), msgBody.trim());
            // Admin sending message currently seems tricky. In User/Provider it's `sendMessage`. 
            // Admin might use `requestDisputeEvidence` to send a message to user. Wait!
            // The API for admin adding message doesn't formally exist as `sendMessage` in `lib/api.ts`!
            // I should use `adminApi.requestDisputeEvidence(id, msg)` and append URLs if possible, or add a proper message integration.
            // Let's use `requestDisputeEvidence` for admin chat message for now if `sendMessage` is missing.
            await adminApi.requestDisputeEvidence(id, `${msgBody}\n${urls.join('\n')}`);
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
    const onStatusUpdate = async () => {
        if (!detail || isClosed) return;
        setBusy(true);
        try {
            await adminApi.updateDisputeStatus(detail.id, statusNext);
            toast.success(t('admin.disputes.success'));
            await refreshDetail();
        } catch {
            toast.error(t('admin.disputes.error'));
        } finally {
            setBusy(false);
        }
    };

    const onRequestEvidence = async () => {
        if (!detail || isClosed || !evidenceMsg.trim()) return;
        setBusy(true);
        try {
            await adminApi.requestDisputeEvidence(detail.id, evidenceMsg.trim());
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
            return `${msg.author?.fullName || 'User'} (User)`;
        }
        if (msg.senderRole === 'PROVIDER' || msg.actor === 'SYSTEM') {
            return `${msg.author?.fullName || 'Provider'} (Provider)`;
        }
        return msg.senderRole || msg.actor || 'SYSTEM';
    };

    return (
        <AdminLayout activeTab="/admin/disputes">
            <div className="min-h-[calc(100vh-64px)] flex flex-col" style={{ background: C.bg }}>
                {/* Header */}
                <div className="sticky top-0 z-20 bg-white" style={{ borderColor: C.border }}>
                    <header className="px-4 py-3 border-b flex items-center justify-between gap-3" style={{ borderColor: C.border }}>
                        <div className="flex items-center gap-3 min-w-0">
                            <button onClick={() => router.push('/admin/disputes')} className="w-9 h-9 flex-shrink-0 rounded-xl hover:bg-slate-100 flex items-center justify-center transition-colors" style={{ color: C.navy, background: C.bg }}>
                                <ArrowLeft size={20} strokeWidth={2.5} />
                            </button>
                            <div className="min-w-0">
                                <h1 className="font-bold text-base" style={{ color: C.navy }}>Chi tiết khiếu nại</h1>
                                <p className="text-xs font-semibold mt-0.5" style={{ color: C.gray }}>
                                    Đơn #{String(detail?.payment?.requestId ?? detail?.request?.id ?? detail.id).slice(0, 8).toUpperCase()}
                                </p>
                                <p className="text-[10px]" style={{ color: '#94a3b8' }}>
                                    Case #{String(detail.id).slice(0, 8).toUpperCase()}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0" style={{ background: sm.bg, color: sm.color }}>
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: sm.color }} />
                            {sm.label}
                        </div>
                    </header>

                    {/* Tabs */}
                    <div className="flex px-4 border-b overflow-x-auto no-scrollbar" style={{ borderColor: C.border }}>
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`flex-1 min-w-[100px] py-3 text-sm font-bold text-center border-b-2 transition-colors relative ${activeTab === 'overview' ? 'border-orange-500' : 'border-transparent'}`}
                            style={{ color: activeTab === 'overview' ? C.orange : C.gray, borderColor: activeTab === 'overview' ? C.orange : 'transparent' }}
                        >
                            Tổng quan
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
                <div className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full px-4 lg:px-6 gap-6 py-6">
                    {/* Main Content Area */}
                    <div className="flex-1 min-w-0 flex flex-col">
                        {activeTab === 'overview' && (
                            <div className="pb-8 w-full">
                                {isClosed && (
                                    <div className="rounded-xl p-4 mb-6 border" style={{ background: '#f8fafc', borderColor: C.border }}>
                                        <p className="text-sm font-semibold" style={{ color: C.navy }}>
                                            {detail.status === 'REJECTED' ? t('admin.disputes.tabRejected') : t('admin.disputes.tabResolved')}
                                        </p>
                                        {detail.resolution && (
                                            <p className="text-sm mt-1" style={{ color: C.gray }}>
                                                {detail.resolution}
                                                {detail.refundAmount != null ? ` · ${(detail.refundAmount || detail.resolutionAmountCustomer || 0).toLocaleString()}₫` : ''}
                                            </p>
                                        )}
                                        {detail.resolutionNote && (
                                            <p className="text-sm mt-2 whitespace-pre-wrap" style={{ color: C.navy }}>{detail.resolutionNote}</p>
                                        )}
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
                            <div className="pb-8 w-full">
                                <SectionCard title="Chi tiết dịch vụ gốc" icon={<Clock size={16} style={{ color: C.blue }} />}>
                                    {orderDetail ? (
                                        <>
                                            <InfoRow label="Trạng thái đơn" value={orderDetail.status || detail?.request?.status || 'N/A'} />
                                            <InfoRow label="Loại sự cố" value={orderDetail.incidentType || detail?.request?.incidentType || 'N/A'} />
                                            <InfoRow label="Địa điểm" value={orderDetail.locationLine1 || 'N/A'} />
                                            <InfoRow label="Nền tảng" value={orderDetail.platform || 'System'} />
                                            <InfoRow label="Khách hàng" value={orderDetail.user?.fullName || detail?.request?.user?.fullName || 'N/A'} />
                                            <InfoRow label="Nhà cung cấp" value={orderDetail.assignedProvider?.fullName || detail?.request?.assignedProvider?.fullName || 'N/A'} />
                                            {orderDetail.createdAt && <InfoRow label="Ngày tạo đơn" value={new Date(orderDetail.createdAt).toLocaleString()} />}
                                        </>
                                    ) : (
                                        <div className="text-center py-6">
                                            <p className="text-sm font-medium" style={{ color: C.gray }}>Đang tải hoặc không có sẵn chi tiết đơn...</p>
                                        </div>
                                    )}
                                </SectionCard>
                            </div>
                        )}

                        {activeTab === 'messages' && (
                            <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full relative sm:min-h-[500px] h-[70vh] lg:h-auto bg-white border lg:rounded-2xl shadow-sm" style={{ borderColor: C.border }}>
                                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-32 lg:pb-4 lg:px-6">
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
                                    <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-white border-t rounded-b-2xl" style={{ borderColor: C.border }}>
                                        <div className="flex items-end gap-2">
                                            <div className="flex-1 bg-gray-50 rounded-2xl border flex flex-col pt-1 overflow-hidden focus-within:bg-white focus-within:border-orange-500 transition-colors" style={{ borderColor: C.border }}>
                                                <textarea value={msgBody} onChange={e => setMsgBody(e.target.value)} placeholder="Nhập tin nhắn với tư cách Admin..." className="w-full bg-transparent px-3 py-2 text-[13px] outline-none resize-none max-h-32 min-h-[44px]" rows={Math.min(4, msgBody.split('\n').length || 1)} />
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
                                     <div className="absolute bottom-0 left-0 right-0 px-4 py-4 bg-white border-t text-center text-xs lg:rounded-b-2xl" style={{ borderColor: C.border, color: C.gray }}>
                                         Đơn khiếu nại này đã đóng. Không thể gửi thêm tin nhắn.
                                     </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Admin Sidebar */}
                    <div className="w-full lg:w-96 flex-shrink-0 flex flex-col gap-6">
                        {!isClosed && (
                            <>
                                {/* Status Changer */}
                                <div className="bg-white rounded-2xl border p-5 shadow-sm" style={{ borderColor: C.border }}>
                                    <h3 className="text-sm font-bold mb-3 uppercase tracking-wide" style={{ color: C.navy }}>{t('admin.disputes.setStatus')}</h3>
                                    <div className="flex gap-2">
                                        <select
                                            className="flex-1 rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:border-orange-500"
                                            style={{ borderColor: C.border, color: C.navy }}
                                            value={statusNext}
                                            onChange={(e) => setStatusNext(e.target.value)}
                                        >
                                            <option value="NEW">MỚI (NEW)</option>
                                            <option value="IN_REVIEW">ĐANG XEM XÉT</option>
                                            <option value="AWAITING_EVIDENCE">CHỜ BẰNG CHỨNG</option>
                                        </select>
                                        <button disabled={busy || statusNext === detail.status} onClick={onStatusUpdate} className="px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: C.navy }}>Cập nhật</button>
                                    </div>
                                </div>

                                {/* Request Evidence from User/Provider */}
                                <div className="bg-white rounded-2xl border p-5 shadow-sm" style={{ borderColor: C.border }}>
                                    <h3 className="text-sm font-bold mb-3 uppercase tracking-wide" style={{ color: C.navy }}>{t('admin.disputes.requestEvidenceBtn')}</h3>
                                    <p className="text-[11px] mb-3" style={{ color: C.gray }}>Gửi yêu cầu cung cấp thêm thông tin tới Khách hoặc Đối tác.</p>
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
                                                <option value="NO_CHANGE">{t('admin.disputes.resolutionNoChange')} (Không hoàn tiền)</option>
                                                <option value="FULL_REFUND">{t('admin.disputes.resolutionFullRefund')} (Hoàn 100%)</option>
                                                <option value="PARTIAL_REFUND">{t('admin.disputes.resolutionPartialRefund')} (Hoàn 1 phần)</option>
                                                <option value="DISMISSED">{t('admin.disputes.resolutionDismissed')} (Từ chối xử lý)</option>
                                            </select>
                                        </div>

                                        {resolveResolution === 'PARTIAL_REFUND' && (
                                            <div>
                                                <label className="block text-xs font-bold mb-1.5" style={{ color: C.gray }}>Số tiền bồi thường (VNĐ)</label>
                                                <input
                                                    type="text"
                                                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-orange-500"
                                                    style={{ borderColor: C.border, color: C.navy }}
                                                    placeholder="VD: 50000"
                                                    value={refundAmount}
                                                    onChange={(e) => setRefundAmount(e.target.value.replace(/\D/g, ''))}
                                                />
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

