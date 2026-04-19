'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useProviderGuard } from '@/lib/guards';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { providerDisputeApi } from '@/lib/api';
import { uploadFile, UploadPurpose } from '@/lib/upload';
import { DisputeSLACountdown } from '@/components/DisputeSLACountdown';
import { CheckCircle2, Clock, ShieldAlert, Receipt, MessageSquare, Image as ImageIcon, Film, AlertCircle } from 'lucide-react';
import { displayOrderCode, displayDisputeCaseRef } from '@/lib/reconciliation';

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

type UploadState = {
    id: string;
    file: File;
    kind: 'image' | 'video';
    status: 'uploading' | 'success' | 'error';
    url?: string;
};

function getStatusBadgeMeta(
    status: string,
    t: (path: string) => string,
): { label: string; bg: string; color: string } {
    const meta: Record<string, { labelKey: string; bg: string; color: string }> = {
        WAITING_FOR_PROVIDER: { labelKey: 'provider.disputes.detail.badgeWaitingForYou', bg: C.yellowLight, color: C.yellow },
        WAITING_FOR_CUSTOMER: { labelKey: 'provider.disputes.detail.badgeWaitingForCustomer', bg: C.blueLight, color: C.blue },
        INVESTIGATING: { labelKey: 'provider.disputes.detail.badgeInvestigating', bg: C.purpleLight, color: C.purple },
        RESOLVED: { labelKey: 'provider.disputes.detail.badgeResolved', bg: C.greenLight, color: C.green },
        REJECTED: { labelKey: 'provider.disputes.detail.badgeRejected', bg: C.redLight, color: C.red },
    };
    const m = meta[status];
    return m ? { label: t(m.labelKey), bg: m.bg, color: m.color } : { label: status, bg: '#f1f5f9', color: C.gray };
}

function ProgressTimeline({ status, t }: { status: string; t: (path: string) => string }) {
    const steps = [
        { id: 'created', label: t('provider.disputes.detail.timelineSubmitted'), active: false, done: true },
        {
            id: 'processing',
            label: t('provider.disputes.detail.timelineProcessing'),
            active: ['WAITING_FOR_PROVIDER', 'WAITING_FOR_CUSTOMER', 'INVESTIGATING'].includes(status),
            done: ['RESOLVED', 'REJECTED'].includes(status),
        },
        {
            id: 'closed',
            label: status === 'REJECTED' ? t('provider.disputes.detail.timelineRejected') : t('provider.disputes.detail.timelineOutcome'),
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
        <div className="flex items-center justify-between px-6 py-8 bg-white rounded-2xl border mb-4" style={{ borderColor: C.border }}>
            {steps.map((step, i) => (
                <React.Fragment key={step.id}>
                    <div className="flex flex-col items-center gap-2 relative z-10 w-24">
                        <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 relative z-20"
                            style={{ 
                                background: step.done || step.active 
                                    ? (step.isReject ? C.red : C.orange) 
                                    : '#f1f5f9',
                                boxShadow: step.active ? `0 0 0 4px ${step.isReject ? C.redLight : C.orangeLight}` : 'none'
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
                                    background: steps[i + 1].isReject ? C.red : C.orange 
                                }} 
                            />
                        </div>
                    )}
                </React.Fragment>
            ))}
        </div>
    );
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl overflow-hidden mb-4" style={{ border: `1px solid ${C.border}` }}>
            <div className="px-4 py-3 flex items-center gap-2.5" style={{ background: '#f8fafc', borderBottom: `1px solid ${C.border}` }}>
                {icon}
                <h3 className="text-sm font-bold" style={{ color: C.navy }}>{title}</h3>
            </div>
            <div className="p-4 space-y-3">{children}</div>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex justify-between items-start gap-4">
            <span className="text-xs flex-shrink-0" style={{ color: C.gray }}>{label}</span>
            <span className="text-xs font-semibold text-right" style={{ color: C.navy }}>{value}</span>
        </div>
    );
}

export default function ProviderDisputeDetailPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;
    const { isReady } = useProviderGuard();
    const { user } = useAuth();
    const { locale, t } = useLanguage();
    
    const [dispute, setDispute] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [msgBody, setMsgBody] = useState('');
    const [sending, setSending] = useState(false);
    const [uploads, setUploads] = useState<UploadState[]>([]);
    const [evidencePreview, setEvidencePreview] = useState<{url: string, type: 'image' | 'video'} | null>(null);
    const [readAt, setReadAt] = useState<number>(Date.now());
    const [activeTab, setActiveTab] = useState<'overview' | 'messages'>('overview');
    
    const fileRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLInputElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const uploadedVideoCount = uploads.filter((u) => u.kind === 'video').length;

    const load = async () => {
        if (!id) return;
        try {
            const data = await providerDisputeApi.getDisputeDetail(id);
            setDispute(data);
        } catch {
            setDispute(null);
        } finally {
            setLoading(false);
        }
    };
    const refreshDetail = async () => {
        if (!id) return;
        try {
            const data = await providerDisputeApi.getDisputeDetail(id);
            setDispute(data);
        } catch {
            // Keep last known UI state on transient polling errors.
        }
    };

    useEffect(() => {
        if (isReady) load();
    }, [isReady, id]);

    useEffect(() => {
        if (activeTab === 'messages') {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [dispute?.messages?.length, activeTab]);

    useEffect(() => {
        if (!isReady || !id || activeTab !== 'messages') return;

        const poll = () => {
            if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
            void refreshDetail();
        };

        const intervalId = window.setInterval(poll, 4000);
        return () => window.clearInterval(intervalId);
    }, [isReady, id, activeTab]);

    const unreadCount = useMemo(() => {
        if (!dispute?.messages?.length) return 0;
        return dispute.messages.filter((m: any) => m.userId !== user?.id && new Date(m.createdAt).getTime() > readAt).length;
    }, [dispute?.messages, readAt, user?.id]);
    const customerLastReadAt = useMemo(() => {
        const customerId = dispute?.payment?.userId;
        if (!customerId || !Array.isArray(dispute?.readStates)) return null;
        const state = dispute.readStates.find((s: any) => s.userId === customerId);
        return state?.lastReadAt ? new Date(state.lastReadAt).getTime() : null;
    }, [dispute?.payment?.userId, dispute?.readStates]);

    const retryUpload = async (u: UploadState) => {
        setUploads((prev) => prev.map((x) => (x.id === u.id ? { ...x, status: 'uploading' } : x)));
        const res =
            u.kind === 'video'
                ? await uploadVideoFile(u.file)
                : await uploadFile(u.file, UploadPurpose.REQUEST_PHOTO);
        if (res.success && res.publicUrl) {
            setUploads((prev) => prev.map((x) => (x.id === u.id ? { ...x, status: 'success', url: res.publicUrl } : x)));
            return;
        }
        setUploads((prev) => prev.map((x) => (x.id === u.id ? { ...x, status: 'error' } : x)));
    };

    const onSelectEvidence = async (files: FileList | null, kind: 'image' | 'video' = 'image') => {
        if (!files?.length) return;
        const currentVideoCount = uploads.filter((u) => u.kind === 'video').length;
        const maxByKind = kind === 'video' ? Math.max(0, 2 - currentVideoCount) : 5;
        const items = Array.from(files).slice(0, maxByKind);
        for (const file of items) {
            const id = `${file.name}-${Date.now()}-${Math.random()}`;
            const draft: UploadState = { id, file, kind, status: 'uploading' };
            setUploads((prev) => [...prev, draft]);
            const res =
                kind === 'video'
                    ? await uploadVideoFile(file)
                    : await uploadFile(file, UploadPurpose.REQUEST_PHOTO);
            if (res.success && res.publicUrl) {
                setUploads((prev) => prev.map((x) => (x.id === id ? { ...x, status: 'success', url: res.publicUrl } : x)));
            } else {
                setUploads((prev) => prev.map((x) => (x.id === id ? { ...x, status: 'error' } : x)));
            }
        }
    };

    const uploadVideoFile = async (file: File): Promise<{ success: boolean; publicUrl?: string }> => {
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

    const sendMsg = async () => {
        if (sending) return;
        const urls = uploads.filter((u) => u.status === 'success' && u.url).map((u) => u.url!) as string[];
        if (!msgBody.trim() && urls.length === 0) return;
        setSending(true);
        try {
            await providerDisputeApi.sendMessage(id, msgBody.trim() || t('provider.disputes.detail.evidenceOnlyMessage'), urls);
            setMsgBody('');
            setUploads([]);
            await load();
            setReadAt(Date.now());
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        } finally {
            setSending(false);
        }
    };

    if (!isReady || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center flex-col" style={{ background: C.bg }}>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: C.orange }} />
            </div>
        );
    }
    
    if (!dispute) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4" style={{ background: C.bg }}>
                <div className="bg-white p-6 rounded-2xl text-center w-full max-w-sm border" style={{ borderColor: C.border }}>
                    <p className="font-semibold mb-2" style={{ color: C.navy }}>{t('provider.disputes.detail.notFound')}</p>
                    <button onClick={() => router.push('/provider/disputes')} className="px-4 py-2 rounded-xl text-sm font-semibold text-white w-full" style={{ background: C.orange }}>{t('provider.disputes.detail.back')}</button>
                </div>
            </div>
        );
    }

    const status = dispute.status ?? '';
    const sm = getStatusBadgeMeta(status, t);
    const isClosed = dispute.isClosed;
    const canSend = !!dispute?.permissions?.canSendMessage && !isClosed;
    
    const request = dispute?.payment?.request;
    const customer = request?.user;
    const isVideo = (url: string) => /\.(mp4|webm|mkv|mov)(\?.*)?$/i.test(url) || url.includes('/video/upload/');
    const senderLabel = (msg: any) => {
        if (msg.senderRole === 'ADMIN') return 'ADMIN';
        if (msg.senderRole === 'CUSTOMER') {
            const name =
                msg.author?.fullName ||
                request?.user?.fullName ||
                t('provider.disputes.detail.authorNameFallbackUser');
            return `${name} (${t('provider.disputes.detail.roleCustomer')})`;
        }
        if (msg.senderRole === 'PROVIDER') {
            const name =
                msg.author?.fullName ||
                request?.assignedProvider?.fullName ||
                t('provider.disputes.detail.authorNameFallbackProvider');
            return `${name} (${t('provider.disputes.detail.roleProvider')})`;
        }
        return msg.senderRole;
    };
    const formatSystemMessage = (body: string) => {
        if (!body) return body;
        const match = body.match(/^Admin vừa yêu cầu (Provider|Customer) cung cấp thêm chứng cứ:\s*(.+)$/i);
        if (!match) return body;
        const target = match[1]?.toUpperCase();
        const content = match[2]?.trim() ?? '';
        if (target === 'PROVIDER') {
            return t('provider.disputes.detail.systemEvidenceRequestYou', { content });
        }
        return t('provider.disputes.detail.systemEvidenceRequestCustomer', { content });
    };

    return (
            <div className="h-[100dvh] flex flex-col overflow-hidden" style={{ background: C.bg }}>
            <div className="sticky top-0 z-20 bg-white" style={{ borderColor: C.border }}>
                <header className="px-4 py-3 border-b flex items-center justify-between gap-3" style={{ borderColor: C.border }}>
                    <div className="flex items-center gap-3 min-w-0">
                        <button onClick={() => router.push('/provider/disputes')} className="w-9 h-9 flex-shrink-0 rounded-xl hover:bg-slate-100 flex items-center justify-center transition-colors" style={{ color: C.navy, background: C.bg }}>
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="min-w-0">
                            <h1 className="font-bold text-base" style={{ color: C.navy }}>{t('provider.disputes.detail.headerTitle')}</h1>
                            <p className="text-xs font-semibold mt-0.5" style={{ color: C.gray }}>
                                {t('provider.disputes.detail.orderLine', {
                                    code: displayOrderCode(
                                        dispute?.request?.orderCode ?? dispute?.payment?.request?.orderCode,
                                        dispute?.payment?.requestId ?? dispute?.request?.id ?? dispute.id,
                                    ),
                                })}
                            </p>
                            <p className="text-[10px]" style={{ color: '#94a3b8' }}>
                                {t('provider.disputes.detail.caseLine', { code: displayDisputeCaseRef(String(dispute.id)) })}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0" style={{ background: sm.bg, color: sm.color }}>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: sm.color }} />
                        {sm.label}
                    </div>
                </header>

                <div className="flex px-4 border-b" style={{ borderColor: C.border }}>
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors relative ${activeTab === 'overview' ? 'border-orange-500' : 'border-transparent'}`}
                        style={{ color: activeTab === 'overview' ? C.orange : C.gray, borderColor: activeTab === 'overview' ? C.orange : 'transparent' }}
                    >
                        {t('provider.disputes.detail.tabsOverview')}
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab('messages');
                            setReadAt(Date.now());
                        }}
                        className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors relative ${activeTab === 'messages' ? 'border-orange-500' : 'border-transparent'}`}
                        style={{ color: activeTab === 'messages' ? C.orange : C.gray, borderColor: activeTab === 'messages' ? C.orange : 'transparent' }}
                    >
                        {t('provider.disputes.detail.tabsMessages')}
                        {unreadCount > 0 && activeTab !== 'messages' && (
                            <span className="absolute top-2 right-1 w-4 h-4 text-white text-[10px] font-bold flex items-center justify-center rounded-full" style={{ background: C.red }}>
                                {unreadCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

                <div className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full">
                    {activeTab === 'overview' && (
                        <div className="flex-1 overflow-y-auto p-4 pb-8 w-full max-w-2xl mx-auto lg:p-6">
                            {!isClosed && dispute.firstResponseDueAt && (
                                <div className="mb-4 text-center">
                                   <DisputeSLACountdown dueAt={dispute.firstResponseDueAt} />
                                </div>
                            )}

                            <ProgressTimeline status={status} t={t} />

                            <SectionCard title={t('provider.disputes.detail.sectionDispute')} icon={<ShieldAlert size={16} style={{ color: C.red }} />}>
                                <InfoRow label={t('provider.disputes.detail.reasonSummary')} value={dispute.reason} />
                                {dispute.description && <InfoRow label={t('provider.disputes.detail.descriptionDetail')} value={dispute.description} />}
                                {dispute.expectedOutcome && <InfoRow label={t('provider.disputes.detail.customerExpectation')} value={dispute.expectedOutcome} />}
                                <InfoRow label={t('provider.disputes.detail.refundRequested')} value={
                                    <span style={{ color: C.orange, fontSize: '14px' }}>
                                        {(dispute.targetAmount ?? 0).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')}₫
                                    </span>
                                } />
                                <InfoRow label={t('provider.disputes.detail.openedBy')} value={dispute.openedBy?.fullName || dispute.openedBy?.email || 'N/A'} />
                            </SectionCard>

                            {request && (
                                <SectionCard title={t('provider.disputes.detail.sectionService')} icon={<Receipt size={16} style={{ color: C.blue }} />}>
                                    <InfoRow label={t('provider.disputes.detail.orderCode')} value={
                                        <button 
                                            onClick={() => router.push(`/provider/requests/${request.id}`)}
                                            className="flex items-center justify-end gap-1 hover:underline outline-none"
                                            style={{ color: C.blue }}
                                        >
                                            {displayOrderCode(request.orderCode, request.id)}
                                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                        </button>
                                    } />
                                    <InfoRow label={t('provider.disputes.detail.incidentType')} value={request.incidentType || t('provider.disputes.detail.incidentFallback')} />
                                    <InfoRow label={t('provider.disputes.detail.customer')} value={customer?.fullName || 'N/A'} />
                                    <InfoRow label={t('provider.disputes.detail.customerPhone')} value={customer?.phoneNumber || 'N/A'} />
                                    <InfoRow label={t('provider.disputes.detail.customerEmail')} value={customer?.email || 'N/A'} />
                                    <InfoRow label={t('provider.disputes.detail.totalServicePaid')} value={`${(dispute.payment?.totalAmount ?? 0).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')}₫`} />
                                    {request.createdAt && (
                                        <InfoRow
                                            label={t('provider.disputes.detail.serviceDate')}
                                            value={new Date(request.createdAt).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US')}
                                        />
                                    )}
                                </SectionCard>
                            )}

                            {(dispute.evidence?.length ?? 0) > 0 && (
                                <SectionCard title={t('provider.disputes.detail.sectionEvidence')} icon={<ImageIcon size={16} style={{ color: C.green }} />}>
                                    <div className="grid grid-cols-3 gap-2">
                                        {dispute.evidence.map((e: any) => {
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
                                                            <span className="text-[10px] uppercase font-bold">{t('provider.disputes.detail.videoLabel')}</span>
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

                    {activeTab === 'messages' && (
                        <div className="flex-1 flex flex-col min-h-0 max-w-2xl mx-auto w-full relative lg:pt-4 lg:pb-32 bg-white border-l border-r lg:border lg:rounded-2xl shadow-sm" style={{ borderColor: C.border }}>
                            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-6 lg:px-6">
                                {(!dispute.messages || dispute.messages.length === 0) && (
                                    <div className="text-center mt-10">
                                        <MessageSquare size={32} className="mx-auto mb-3" style={{ color: '#cbd5e1' }} />
                                        <p className="text-sm font-semibold" style={{ color: C.gray }}>{t('provider.disputes.detail.messagesEmptyTitle')}</p>
                                        <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>{t('provider.disputes.detail.messagesEmptyHint')}</p>
                                    </div>
                                )}
                                {(dispute.messages as any[]).map((msg: any) => {
                                    const isSystem = msg.senderRole === 'SYSTEM';
                                    const isMe = msg.userId === user?.id;
                                    
                                    if (isSystem) {
                                        return (
                                            <div key={msg.id} className="flex justify-center my-4">
                                                <div className="max-w-sm rounded-xl px-4 py-2 text-[11px] font-semibold text-center border" style={{ background: '#f8fafc', color: C.gray, borderColor: C.border }}>
                                                    {formatSystemMessage(msg.body)}
                                                </div>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} w-full`}>
                                            <div className="flex flex-col gap-1 max-w-[85%]">
                                                <p className="text-[10px] font-bold px-1" style={{ color: C.gray }}>
                                                    {senderLabel(msg)}
                                                </p>
                                                <div 
                                                    className="rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap" 
                                                    style={{ 
                                                        background: isMe ? C.orange : '#f1f5f9', 
                                                        color: isMe ? '#fff' : C.navy, 
                                                        border: 'none',
                                                        borderBottomRightRadius: isMe ? '4px' : '16px',
                                                        borderTopLeftRadius: !isMe ? '4px' : '16px'
                                                    }}
                                                >
                                                    {msg.body}
                                                </div>
                                                {Array.isArray(msg.mediaUrls) && msg.mediaUrls.length > 0 && (
                                                    <div className="grid grid-cols-3 gap-1.5 mt-1">
                                                        {msg.mediaUrls.map((url: string, idx: number) => {
                                                            const video = isVideo(url);
                                                            return (
                                                                <button
                                                                    key={`${msg.id}-${idx}`}
                                                                    onClick={() => setEvidencePreview({ url, type: video ? 'video' : 'image' })}
                                                                    className="aspect-square overflow-hidden rounded-lg border"
                                                                    style={{ borderColor: C.border, background: '#f1f5f9' }}
                                                                >
                                                                    {video ? (
                                                                        <div className="w-full h-full flex items-center justify-center" style={{ color: C.gray }}>
                                                                            <Film size={18} />
                                                                        </div>
                                                                    ) : (
                                                                        <img src={url} alt="media" className="w-full h-full object-cover" />
                                                                    )}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                <div className={`flex items-center gap-1 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                                    <span className="text-[9px] font-semibold" style={{ color: '#cbd5e1' }}>
                                                        {new Date(msg.createdAt).toLocaleTimeString(locale === 'vi' ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    {isMe && customerLastReadAt && customerLastReadAt >= new Date(msg.createdAt).getTime() && (
                                                        <span className="text-[9px] font-bold" style={{ color: C.blue }}>
                                                            {t('provider.disputes.detail.seenByCustomer')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={bottomRef} className="h-4" />
                            </div>

                            {canSend && (
                                <div className="sticky bottom-0 left-0 right-0 px-4 py-3 bg-white border-t rounded-b-2xl z-10" style={{ borderColor: C.border }}>
                                    <div className="max-w-2xl mx-auto">
                                        <div className="mb-2 bg-orange-50 px-3 py-2 rounded-xl flex items-center justify-between border" style={{ borderColor: '#fed7aa', color: '#c2410c' }}>
                                            <div className="flex items-center gap-2">
                                                <AlertCircle size={16} className="text-orange-500 flex-shrink-0" />
                                                <span className="text-[11px] font-bold">{t('provider.disputes.detail.oneReplyWarning')}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-end gap-2">
                                            <div className="flex-1 bg-gray-50 rounded-2xl border flex flex-col pt-1 overflow-hidden transition-colors focus-within:bg-white focus-within:border-orange-500" style={{ borderColor: C.border }}>
                                                <textarea 
                                                    value={msgBody} 
                                                    onChange={(e) => setMsgBody(e.target.value)} 
                                                    onFocus={() => setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 300)}
                                                    placeholder={t('provider.disputes.detail.composerPlaceholder')}
                                                    className="w-full bg-transparent px-3 py-2 text-[13px] outline-none resize-none max-h-32 min-h-[44px]" 
                                                    rows={Math.min(4, msgBody.split('\n').length || 1)}
                                                />
                                                <div className="flex items-center px-2 pb-2 gap-2">
                                                    <button type="button" onClick={() => fileRef.current?.click()} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors" style={{ color: C.gray }}>
                                                        <ImageIcon size={18} />
                                                    </button>
                                                    <button type="button" onClick={() => videoRef.current?.click()} disabled={uploadedVideoCount >= 2} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-40" style={{ color: C.gray }}>
                                                        <Film size={18} />
                                                    </button>
                                                    <span className="text-[10px] font-medium" style={{ color: '#9ca3af' }}>{t('provider.disputes.detail.composerMediaHint')}</span>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={sendMsg} 
                                                disabled={sending || (!msgBody.trim() && uploads.length === 0)} 
                                                className="h-[44px] px-5 rounded-2xl text-sm font-bold text-white transition-opacity flex-shrink-0 disabled:opacity-50" 
                                                style={{ background: C.orange, boxShadow: `0 4px 12px ${C.orange}40` }}
                                            >
                                                {sending ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t('provider.disputes.detail.send')}
                                            </button>
                                        </div>
                                        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => void onSelectEvidence(e.target.files, 'image')} />
                                        <input ref={videoRef} type="file" accept="video/*" multiple className="hidden" onChange={(e) => void onSelectEvidence(e.target.files, 'video')} />
                                        
                                        {uploads.length > 0 && (
                                            <div className="mt-2 space-y-1.5 max-h-32 overflow-y-auto">
                                                {uploads.map((u) => (
                                                    <div key={u.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-xl border" style={{ background: '#f8fafc', borderColor: C.border }}>
                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                        {u.kind === 'video' ? (
                                                            <Film size={14} style={{ color: C.purple }} className="flex-shrink-0" />
                                                        ) : (
                                                            <ImageIcon size={14} style={{ color: C.blue }} className="flex-shrink-0" />
                                                        )}
                                                            <span className="truncate font-medium text-gray-700">{u.file.name}</span>
                                                        </div>
                                                        <div className="flex-shrink-0 ml-3">
                                                            {u.status === 'uploading' && <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />}
                                                            {u.status === 'success' && <CheckCircle2 size={16} className="text-green-500" />}
                                                            {u.status === 'error' && <button onClick={() => void retryUpload(u)} className="text-xs font-bold px-2 py-1 bg-red-50 text-red-600 rounded">{t('provider.disputes.detail.retryUpload')}</button>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            
                            {!canSend && !isClosed && (
                                <div className="sticky bottom-0 left-0 right-0 px-4 py-4 bg-white border-t text-center text-xs lg:rounded-b-2xl z-10" style={{ borderColor: C.border, color: C.gray }}>
                                    {t('provider.disputes.detail.thanksWaitingFooter')}
                                </div>
                            )}
                            {isClosed && (
                                <div className="sticky bottom-0 left-0 right-0 px-4 py-4 bg-white border-t text-center text-xs lg:rounded-b-2xl z-10" style={{ borderColor: C.border, color: C.gray }}>
                                    {t('provider.disputes.detail.chatClosedFooter')}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {evidencePreview && (
                    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.9)' }} onClick={() => setEvidencePreview(null)}>
                        <button onClick={() => setEvidencePreview(null)} className="absolute top-4 right-4 p-2 text-white bg-white/10 rounded-full hover:bg-white/20">
                            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        {evidencePreview.type === 'video' ? (
                            <video src={evidencePreview.url} controls autoPlay className="max-w-full max-h-[85vh] rounded-xl outline-none" onClick={e => e.stopPropagation()} />
                        ) : (
                            <img src={evidencePreview.url} alt="preview" className="max-w-full max-h-[85vh] object-contain rounded-xl" onClick={e => e.stopPropagation()} />
                        )}
                    </div>
                )}
        </div>
    );
}


