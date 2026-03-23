'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminGuard } from '@/lib/guards';
import { adminApi } from '@/lib/api';
import AdminLayout from '@/components/AdminLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { AlertTriangle, ChevronRight } from 'lucide-react';

const C = {
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#e2e8f0',
    bg: '#f4f6f9',
    orange: '#f97316',
    orangeLight: '#fff7ed',
    green: '#16a34a',
    greenLight: '#f0fdf4',
    red: '#ef4444',
    redLight: '#fef2f2',
    yellow: '#ca8a04',
    yellowLight: '#fefce8',
    blue: '#2563eb',
    blueLight: '#eff6ff',
    purple: '#7c3aed',
    purpleLight: '#faf5ff',
};

type DisputeStatus =
    | 'ALL'
    | 'NEW'
    | 'IN_REVIEW'
    | 'AWAITING_EVIDENCE'
    | 'RESOLVED'
    | 'REJECTED';

interface DisputeListItem {
    id: string;
    status: string;
    slaDueAt: string | null;
    createdAt: string;
    payment: {
        requestId: string;
        totalAmount: number;
        status: string;
        paymentMethod: string;
        disputedAt: string | null;
    };
    request: { id: string; status: string; incidentType: string };
}

const PAGE_SIZE = 20;

function statusStyle(status: string): { bg: string; color: string } {
    switch (status) {
        case 'NEW':
            return { bg: C.blueLight, color: C.blue };
        case 'IN_REVIEW':
            return { bg: C.yellowLight, color: C.yellow };
        case 'AWAITING_EVIDENCE':
            return { bg: C.orangeLight, color: C.orange };
        case 'RESOLVED':
            return { bg: C.greenLight, color: C.green };
        case 'REJECTED':
            return { bg: C.redLight, color: C.red };
        default:
            return { bg: '#f8fafc', color: C.gray };
    }
}

function disputeStatusLabel(
    t: (path: string) => string,
    status: string,
): string {
    switch (status) {
        case 'NEW':
            return t('admin.disputes.tabNew');
        case 'IN_REVIEW':
            return t('admin.disputes.tabInReview');
        case 'AWAITING_EVIDENCE':
            return t('admin.disputes.tabAwaiting');
        case 'RESOLVED':
            return t('admin.disputes.tabResolved');
        case 'REJECTED':
            return t('admin.disputes.tabRejected');
        default:
            return status;
    }
}

export default function AdminDisputesPage() {
    const router = useRouter();
    const { t, locale } = useLanguage();
    const { isReady } = useAdminGuard();
    const [tab, setTab] = useState<DisputeStatus>('IN_REVIEW');
    const [items, setItems] = useState<DisputeListItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params: { status?: string; skip: number; take: number } = {
                skip: 0,
                take: PAGE_SIZE,
            };
            if (tab !== 'ALL') params.status = tab;
            const res = await adminApi.getDisputes(params);
            setItems(res.items as DisputeListItem[]);
            setTotal(res.total);
        } catch {
            setItems([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [tab]);

    useEffect(() => {
        if (isReady) load();
    }, [isReady, load]);

    const tabs: { key: DisputeStatus; labelKey: string }[] = [
        { key: 'ALL', labelKey: 'tabAll' },
        { key: 'NEW', labelKey: 'tabNew' },
        { key: 'IN_REVIEW', labelKey: 'tabInReview' },
        { key: 'AWAITING_EVIDENCE', labelKey: 'tabAwaiting' },
        { key: 'RESOLVED', labelKey: 'tabResolved' },
        { key: 'REJECTED', labelKey: 'tabRejected' },
    ];

    return (
        <AdminLayout activeTab="/admin/disputes">
            <div className="min-h-screen" style={{ background: C.bg }}>
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
                    <div className="flex items-start gap-3 mb-8">
                        <div
                            className="flex items-center justify-center w-12 h-12 rounded-xl flex-shrink-0"
                            style={{ background: C.purpleLight }}
                        >
                            <AlertTriangle className="w-6 h-6" style={{ color: C.purple }} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold" style={{ color: C.navy }}>
                                {t('admin.disputes.title')}
                            </h1>
                            <p className="text-sm mt-1" style={{ color: C.gray }}>
                                {t('admin.disputes.subtitle')}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-6">
                        {tabs.map(({ key, labelKey }) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setTab(key)}
                                className="px-4 py-2 rounded-full text-sm font-semibold transition-colors"
                                style={{
                                    background: tab === key ? C.navy : '#fff',
                                    color: tab === key ? '#fff' : C.gray,
                                    border: `1px solid ${tab === key ? C.navy : C.border}`,
                                }}
                            >
                                {labelKey === 'tabAll' && t('admin.disputes.tabAll')}
                                {labelKey === 'tabNew' && t('admin.disputes.tabNew')}
                                {labelKey === 'tabInReview' && t('admin.disputes.tabInReview')}
                                {labelKey === 'tabAwaiting' && t('admin.disputes.tabAwaiting')}
                                {labelKey === 'tabResolved' && t('admin.disputes.tabResolved')}
                                {labelKey === 'tabRejected' && t('admin.disputes.tabRejected')}
                            </button>
                        ))}
                    </div>

                    <div
                        className="rounded-2xl border overflow-hidden bg-white"
                        style={{ borderColor: C.border }}
                    >
                        {loading ? (
                            <div className="p-12 text-center" style={{ color: C.gray }}>
                                {t('common.loading')}
                            </div>
                        ) : items.length === 0 ? (
                            <div className="p-12 text-center" style={{ color: C.gray }}>
                                {t('admin.disputes.noCases')}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr style={{ background: '#f8fafc', borderBottom: `1px solid ${C.border}` }}>
                                            <th className="px-4 py-3 font-semibold" style={{ color: C.navy }}>
                                                {t('admin.disputes.colCase')}
                                            </th>
                                            <th className="px-4 py-3 font-semibold" style={{ color: C.navy }}>
                                                {t('admin.disputes.colRequest')}
                                            </th>
                                            <th className="px-4 py-3 font-semibold" style={{ color: C.navy }}>
                                                {t('admin.disputes.colAmount')}
                                            </th>
                                            <th className="px-4 py-3 font-semibold" style={{ color: C.navy }}>
                                                {t('admin.disputes.colStatus')}
                                            </th>
                                            <th className="px-4 py-3 font-semibold" style={{ color: C.navy }}>
                                                {t('admin.disputes.colSla')}
                                            </th>
                                            <th className="px-4 py-3 w-10" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((row) => {
                                            const st = statusStyle(row.status);
                                            const sla = row.slaDueAt ? new Date(row.slaDueAt) : null;
                                            const overdue = sla && sla < new Date();
                                            return (
                                                <tr
                                                    key={row.id}
                                                    className="border-t cursor-pointer hover:bg-slate-50/80"
                                                    style={{ borderColor: C.border }}
                                                    onClick={() => router.push(`/admin/disputes/${row.id}`)}
                                                >
                                                    <td className="px-4 py-3 font-mono text-xs" style={{ color: C.navy }}>
                                                        {row.id.slice(0, 10)}…
                                                    </td>
                                                    <td className="px-4 py-3 font-mono text-xs" style={{ color: C.gray }}>
                                                        #{row.payment.requestId.slice(0, 8).toUpperCase()}
                                                    </td>
                                                    <td className="px-4 py-3 font-semibold" style={{ color: C.navy }}>
                                                        {row.payment.totalAmount.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')}
                                                        ₫
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span
                                                            className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold"
                                                            style={{ background: st.bg, color: st.color }}
                                                        >
                                                            {disputeStatusLabel(t, row.status)}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-xs">
                                                        {sla ? (
                                                            <span style={{ color: overdue ? C.red : C.green }}>
                                                                {overdue
                                                                    ? t('admin.disputes.slaOverdue')
                                                                    : t('admin.disputes.slaOk')}{' '}
                                                                · {sla.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')}
                                                            </span>
                                                        ) : (
                                                            '—'
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <ChevronRight className="w-5 h-5" style={{ color: C.gray }} />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {!loading && total > 0 && (
                        <p className="text-xs mt-3 text-center" style={{ color: C.gray }}>
                            {total} total
                        </p>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
