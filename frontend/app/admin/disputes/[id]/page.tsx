'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAdminGuard } from '@/lib/guards';
import { adminApi } from '@/lib/api';
import AdminLayout from '@/components/AdminLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

const C = {
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#e2e8f0',
    bg: '#f4f6f9',
    orange: '#f97316',
    orangeDark: '#ea6c0a',
    green: '#16a34a',
    red: '#ef4444',
    purple: '#7c3aed',
    purpleLight: '#faf5ff',
};

interface DisputeDetail {
    id: string;
    status: string;
    resolution: string | null;
    refundAmount: number | null;
    resolutionNote: string | null;
    resolvedAt: string | null;
    slaDueAt: string | null;
    payment: {
        id: string;
        requestId: string;
        totalAmount: number;
        status: string;
        paymentMethod: string;
        disputeReason: string | null;
        disputedAt: string | null;
        photoUrls: string[];
    };
    request: {
        id: string;
        status: string;
        incidentType: string;
        user: { id: string; fullName: string | null; email: string | null } | null;
        assignedProvider: { id: string; fullName: string | null; email: string | null } | null;
    };
    messages: Array<{
        id: string;
        actor: string;
        body: string;
        createdAt: string;
    }>;
    evidence: Array<{ id: string; url: string; note: string | null; createdAt: string }>;
}

export default function AdminDisputeDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const router = useRouter();
    const { t, locale } = useLanguage();
    const { isReady } = useAdminGuard();
    const [detail, setDetail] = useState<DisputeDetail | null>(null);
    const [loading, setLoading] = useState(true);

    const [statusNext, setStatusNext] = useState('IN_REVIEW');
    const [evidenceMsg, setEvidenceMsg] = useState('');
    const [resolveResolution, setResolveResolution] = useState('NO_CHANGE');
    const [refundAmount, setRefundAmount] = useState('');
    const [resolutionNote, setResolutionNote] = useState('');
    const [evidenceUrl, setEvidenceUrl] = useState('');
    const [evidenceNote, setEvidenceNote] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = (await adminApi.getDisputeDetail(id)) as DisputeDetail;
            setDetail(data);
            setStatusNext(data.status === 'NEW' ? 'IN_REVIEW' : 'IN_REVIEW');
        } catch {
            setDetail(null);
            toast.error(t('admin.disputes.loadError'));
        } finally {
            setLoading(false);
        }
    }, [id, t]);

    useEffect(() => {
        if (isReady && id) load();
    }, [isReady, id, load]);

    const closed = detail?.status === 'RESOLVED' || detail?.status === 'REJECTED';

    const actorLabel = (actor: string) => {
        if (actor === 'ADMIN') return t('admin.disputes.actorAdmin');
        if (actor === 'USER') return t('admin.disputes.actorUser');
        return t('admin.disputes.actorSystem');
    };

    const onStatus = async () => {
        if (!detail || closed) return;
        setBusy(true);
        try {
            await adminApi.updateDisputeStatus(detail.id, statusNext);
            toast.success(t('admin.disputes.success'));
            await load();
        } catch {
            toast.error(t('admin.disputes.error'));
        } finally {
            setBusy(false);
        }
    };

    const onRequestEvidence = async () => {
        if (!detail || closed || !evidenceMsg.trim()) return;
        setBusy(true);
        try {
            await adminApi.requestDisputeEvidence(detail.id, evidenceMsg.trim());
            toast.success(t('admin.disputes.success'));
            setEvidenceMsg('');
            await load();
        } catch {
            toast.error(t('admin.disputes.error'));
        } finally {
            setBusy(false);
        }
    };

    const onResolve = async () => {
        if (!detail || closed) return;
        const body: { resolution: string; refundAmount?: number; resolutionNote?: string } = {
            resolution: resolveResolution,
            resolutionNote: resolutionNote.trim() || undefined,
        };
        if (resolveResolution === 'PARTIAL_REFUND') {
            const n = parseInt(refundAmount.replace(/\D/g, ''), 10);
            if (!n || n <= 0) {
                toast.error(t('admin.disputes.refundAmountLabel'));
                return;
            }
            body.refundAmount = n;
        }
        setBusy(true);
        try {
            await adminApi.resolveDispute(detail.id, body);
            toast.success(t('admin.disputes.success'));
            await load();
        } catch (e: unknown) {
            const msg =
                typeof e === 'object' && e !== null && 'response' in e
                    ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
                    : undefined;
            toast.error(msg || t('admin.disputes.error'));
        } finally {
            setBusy(false);
        }
    };

    const onAddEvidence = async () => {
        if (!detail || closed || !evidenceUrl.trim()) return;
        setBusy(true);
        try {
            await adminApi.addDisputeEvidence(detail.id, evidenceUrl.trim(), evidenceNote.trim() || undefined);
            toast.success(t('admin.disputes.success'));
            setEvidenceUrl('');
            setEvidenceNote('');
            await load();
        } catch {
            toast.error(t('admin.disputes.error'));
        } finally {
            setBusy(false);
        }
    };

    if (!isReady || loading) {
        return (
            <AdminLayout activeTab="/admin/disputes">
                <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
                    <p style={{ color: C.gray }}>{t('common.loading')}</p>
                </div>
            </AdminLayout>
        );
    }

    if (!detail) {
        return (
            <AdminLayout activeTab="/admin/disputes">
                <div className="min-h-screen p-8" style={{ background: C.bg }}>
                    <p style={{ color: C.gray }}>{t('guest.errors.notFound')}</p>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout activeTab="/admin/disputes">
            <div className="min-h-screen pb-16" style={{ background: C.bg }}>
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
                    <button
                        type="button"
                        onClick={() => router.push('/admin/disputes')}
                        className="flex items-center gap-2 text-sm font-medium mb-6 hover:opacity-80"
                        style={{ color: C.orange }}
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {t('admin.disputes.backToList')}
                    </button>

                    <div className="flex items-start gap-3 mb-8">
                        <div
                            className="flex items-center justify-center w-12 h-12 rounded-xl flex-shrink-0"
                            style={{ background: C.purpleLight }}
                        >
                            <AlertTriangle className="w-6 h-6" style={{ color: C.purple }} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold font-mono" style={{ color: C.navy }}>
                                {detail.id}
                            </h1>
                            <p className="text-sm mt-1" style={{ color: C.gray }}>
                                {t('admin.disputes.detailTitle')}
                            </p>
                        </div>
                    </div>

                    {closed && (
                        <div
                            className="rounded-xl p-4 mb-6 border"
                            style={{ background: '#f8fafc', borderColor: C.border }}
                        >
                            <p className="text-sm font-semibold" style={{ color: C.navy }}>
                                {detail.status === 'REJECTED' ? t('admin.disputes.tabRejected') : t('admin.disputes.tabResolved')}
                            </p>
                            {detail.resolution && (
                                <p className="text-sm mt-1" style={{ color: C.gray }}>
                                    {detail.resolution}
                                    {detail.refundAmount != null
                                        ? ` · ${detail.refundAmount.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')}₫`
                                        : ''}
                                </p>
                            )}
                            {detail.resolutionNote && (
                                <p className="text-sm mt-2 whitespace-pre-wrap" style={{ color: C.navy }}>
                                    {detail.resolutionNote}
                                </p>
                            )}
                        </div>
                    )}

                    <section
                        className="rounded-2xl border p-6 mb-6 bg-white"
                        style={{ borderColor: C.border }}
                    >
                        <h2 className="text-sm font-bold uppercase tracking-wide mb-4" style={{ color: C.navy }}>
                            {t('admin.disputes.sectionPayment')}
                        </h2>
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            <div>
                                <dt style={{ color: C.gray }}>{t('admin.disputes.paymentMethod')}</dt>
                                <dd className="font-medium" style={{ color: C.navy }}>
                                    {detail.payment.paymentMethod}
                                </dd>
                            </div>
                            <div>
                                <dt style={{ color: C.gray }}>{t('admin.disputes.paymentTotal')}</dt>
                                <dd className="font-semibold" style={{ color: C.navy }}>
                                    {detail.payment.totalAmount.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')}
                                    ₫
                                </dd>
                            </div>
                            <div className="sm:col-span-2">
                                <dt style={{ color: C.gray }}>{t('admin.disputes.disputeReason')}</dt>
                                <dd className="mt-1" style={{ color: C.navy }}>
                                    {detail.payment.disputeReason || '—'}
                                </dd>
                            </div>
                        </dl>
                    </section>

                    <section
                        className="rounded-2xl border p-6 mb-6 bg-white"
                        style={{ borderColor: C.border }}
                    >
                        <h2 className="text-sm font-bold uppercase tracking-wide mb-4" style={{ color: C.navy }}>
                            {t('admin.disputes.sectionRequest')}
                        </h2>
                        <p className="text-sm">
                            <span style={{ color: C.gray }}>{t('admin.disputes.requestStatus')}: </span>
                            <span className="font-medium" style={{ color: C.navy }}>
                                {detail.request.status}
                            </span>
                        </p>
                        <p className="text-sm mt-2 font-mono" style={{ color: C.gray }}>
                            #{detail.request.id.slice(0, 8).toUpperCase()}
                        </p>
                        {detail.request.user && (
                            <p className="text-sm mt-2" style={{ color: C.navy }}>
                                User: {detail.request.user.fullName || detail.request.user.email}
                            </p>
                        )}
                        {detail.request.assignedProvider && (
                            <p className="text-sm mt-1" style={{ color: C.navy }}>
                                Provider:{' '}
                                {detail.request.assignedProvider.fullName || detail.request.assignedProvider.email}
                            </p>
                        )}
                    </section>

                    <section
                        className="rounded-2xl border p-6 mb-6 bg-white"
                        style={{ borderColor: C.border }}
                    >
                        <h2 className="text-sm font-bold uppercase tracking-wide mb-4" style={{ color: C.navy }}>
                            {t('admin.disputes.sectionMessages')}
                        </h2>
                        <ul className="space-y-3">
                            {detail.messages.map((m) => (
                                <li
                                    key={m.id}
                                    className="rounded-lg p-3 text-sm"
                                    style={{ background: '#f8fafc', border: `1px solid ${C.border}` }}
                                >
                                    <div className="flex justify-between gap-2 mb-1">
                                        <span className="font-semibold" style={{ color: C.orange }}>
                                            {actorLabel(m.actor)}
                                        </span>
                                        <span className="text-xs" style={{ color: C.gray }}>
                                            {new Date(m.createdAt).toLocaleString(
                                                locale === 'vi' ? 'vi-VN' : 'en-US',
                                            )}
                                        </span>
                                    </div>
                                    <p className="whitespace-pre-wrap" style={{ color: C.navy }}>
                                        {m.body}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section
                        className="rounded-2xl border p-6 mb-6 bg-white"
                        style={{ borderColor: C.border }}
                    >
                        <h2 className="text-sm font-bold uppercase tracking-wide mb-4" style={{ color: C.navy }}>
                            {t('admin.disputes.sectionEvidence')}
                        </h2>
                        <ul className="space-y-2 mb-4">
                            {detail.evidence.map((e) => (
                                <li key={e.id} className="text-sm">
                                    <a
                                        href={e.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline font-medium"
                                        style={{ color: C.orangeDark }}
                                    >
                                        {e.url}
                                    </a>
                                    {e.note && (
                                        <span className="block text-xs mt-0.5" style={{ color: C.gray }}>
                                            {e.note}
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                        {!closed && (
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    type="url"
                                    className="flex-1 rounded-lg border px-3 py-2 text-sm"
                                    style={{ borderColor: C.border }}
                                    placeholder={t('admin.disputes.addEvidenceUrl')}
                                    value={evidenceUrl}
                                    onChange={(e) => setEvidenceUrl(e.target.value)}
                                />
                                <input
                                    type="text"
                                    className="flex-1 rounded-lg border px-3 py-2 text-sm"
                                    style={{ borderColor: C.border }}
                                    placeholder={t('admin.disputes.addEvidenceNote')}
                                    value={evidenceNote}
                                    onChange={(e) => setEvidenceNote(e.target.value)}
                                />
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={onAddEvidence}
                                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                                    style={{ background: C.navy }}
                                >
                                    {t('admin.disputes.addEvidenceBtn')}
                                </button>
                            </div>
                        )}
                    </section>

                    {!closed && (
                        <section
                            className="rounded-2xl border p-6 mb-6 bg-white space-y-6"
                            style={{ borderColor: C.border }}
                        >
                            <div>
                                <h3 className="text-sm font-bold mb-2" style={{ color: C.navy }}>
                                    {t('admin.disputes.setStatus')}
                                </h3>
                                <div className="flex flex-wrap gap-2 items-center">
                                    <select
                                        className="rounded-lg border px-3 py-2 text-sm"
                                        style={{ borderColor: C.border }}
                                        value={statusNext}
                                        onChange={(e) => setStatusNext(e.target.value)}
                                    >
                                        <option value="NEW">NEW</option>
                                        <option value="IN_REVIEW">IN_REVIEW</option>
                                        <option value="AWAITING_EVIDENCE">AWAITING_EVIDENCE</option>
                                    </select>
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={onStatus}
                                        className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                                        style={{ background: C.gray }}
                                    >
                                        {t('common.update')}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-bold mb-2" style={{ color: C.navy }}>
                                    {t('admin.disputes.requestEvidenceBtn')}
                                </h3>
                                <textarea
                                    className="w-full rounded-lg border px-3 py-2 text-sm min-h-[88px]"
                                    style={{ borderColor: C.border }}
                                    placeholder={t('admin.disputes.requestEvidencePlaceholder')}
                                    value={evidenceMsg}
                                    onChange={(e) => setEvidenceMsg(e.target.value)}
                                />
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={onRequestEvidence}
                                    className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                                    style={{ background: C.orange }}
                                >
                                    {t('admin.disputes.requestEvidenceBtn')}
                                </button>
                            </div>

                            <div>
                                <h3 className="text-sm font-bold mb-2" style={{ color: C.navy }}>
                                    {t('admin.disputes.resolveBtn')}
                                </h3>
                                <select
                                    className="rounded-lg border px-3 py-2 text-sm mb-2 block"
                                    style={{ borderColor: C.border }}
                                    value={resolveResolution}
                                    onChange={(e) => setResolveResolution(e.target.value)}
                                >
                                    <option value="NO_CHANGE">{t('admin.disputes.resolutionNoChange')}</option>
                                    <option value="FULL_REFUND">{t('admin.disputes.resolutionFullRefund')}</option>
                                    <option value="PARTIAL_REFUND">{t('admin.disputes.resolutionPartialRefund')}</option>
                                    <option value="DISMISSED">{t('admin.disputes.resolutionDismissed')}</option>
                                </select>
                                {resolveResolution === 'PARTIAL_REFUND' && (
                                    <input
                                        type="text"
                                        className="w-full sm:w-64 rounded-lg border px-3 py-2 text-sm mb-2 block"
                                        style={{ borderColor: C.border }}
                                        placeholder={t('admin.disputes.refundAmountLabel')}
                                        value={refundAmount}
                                        onChange={(e) => setRefundAmount(e.target.value)}
                                    />
                                )}
                                <textarea
                                    className="w-full rounded-lg border px-3 py-2 text-sm min-h-[72px] mb-2"
                                    style={{ borderColor: C.border }}
                                    placeholder={t('admin.disputes.resolutionNoteLabel')}
                                    value={resolutionNote}
                                    onChange={(e) => setResolutionNote(e.target.value)}
                                />
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={onResolve}
                                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                                    style={{ background: C.green }}
                                >
                                    {busy ? t('admin.disputes.submitting') : t('admin.disputes.resolveBtn')}
                                </button>
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
