'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useProviderGuard } from '@/lib/guards';
import { useLanguage } from '@/contexts/LanguageContext';
import ProviderLayout from '@/components/ProviderLayout';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import AvatarImage from '@/components/AvatarImage';
import RescueMeLogo from '@/components/RescueMeLogo';
import { useAuth } from '@/contexts/AuthContext';
import { providerDisputeApi } from '@/lib/api';
import api from '@/lib/api';

const C = {
    orange: '#f97316',
    orangeLight: '#fff7ed',
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#e2e8f0',
    bg: '#f4f6f9',
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

interface DisputeItem {
    id: string;
    status: string;
    createdAt: string;
    userReason?: string;
    targetAmount?: number;
    payment: {
        requestId: string;
        totalAmount: number;
    };
    request?: {
        id: string;
        incidentType: string;
    };
}

function statusStyle(status: string): { bg: string; color: string } {
    switch (status) {
        case 'WAITING_FOR_PROVIDER': return { bg: C.yellowLight, color: C.yellow };
        case 'WAITING_FOR_CUSTOMER': return { bg: C.blueLight,   color: C.blue   };
        case 'INVESTIGATING':        return { bg: C.purpleLight,  color: C.purple };
        case 'RESOLVED': return { bg: C.greenLight, color: C.green };
        case 'REJECTED': return { bg: C.redLight, color: C.red };
        default: return { bg: '#f8fafc', color: C.gray };
    }
}


export default function ProviderDisputesPage() {
    const router = useRouter();
    const { isReady } = useProviderGuard();
    const { user } = useAuth();
    const { t, locale } = useLanguage();
    const [disputes, setDisputes] = useState<DisputeItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            const res = await providerDisputeApi.getMyDisputes();
            setDisputes((res.items as DisputeItem[]) ?? []);
        } catch {
            // Fallback: filter history requests by disputedAt
            try {
                const res2 = await api.get('/provider/requests/history');
                const requests: any[] = res2.data?.items ?? res2.data ?? [];
                const withDisputes = requests
                    .filter((r: any) => r.payment?.disputedAt)
                    .map((r: any) => ({
                        id: r.payment.disputeId ?? r.id,
                        status: r.payment.disputeStatus ?? 'IN_REVIEW',
                        createdAt: r.payment.disputedAt ?? r.createdAt,
                        userReason: r.payment.disputeReason ?? '',
                        targetAmount: r.payment.totalAmount,
                        payment: {
                            requestId: r.id,
                            totalAmount: r.payment.totalAmount ?? 0,
                        },
                        request: { id: r.id, incidentType: r.incidentType },
                    }));
                setDisputes(withDisputes);
            } catch {
                setError(true);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isReady) load();
    }, [isReady, load]);

    const statusLabel = (status: string) => {
        const map: Record<string, string> = {
            WAITING_FOR_PROVIDER:  t('provider.disputes.status.WAITING_FOR_PROVIDER'),
            WAITING_FOR_CUSTOMER:  t('provider.disputes.status.WAITING_FOR_CUSTOMER'),
            INVESTIGATING:         t('provider.disputes.status.INVESTIGATING'),
            RESOLVED:              t('provider.disputes.status.RESOLVED'),
            REJECTED:              t('provider.disputes.status.REJECTED'),
        };
        return map[status] ?? status;
    };


    if (!isReady) {
        return (
            <ProviderLayout activeTab="/provider/disputes">
                <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: C.orange }} />
                </div>
            </ProviderLayout>
        );
    }

    return (
        <ProviderLayout activeTab="/provider/disputes">
            <div className="min-h-screen" style={{ background: C.bg }}>
                {/* ── Header (matches pattern) ── */}
                <header
                    className="flex items-center justify-between px-4 py-3 flex-shrink-0 sticky top-0 z-20"
                    style={{ background: '#ffffff', borderBottom: `1px solid ${C.border}` }}
                >
                    {/* Mobile: back arrow + RescueMe | Desktop: page title */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/provider/active')}
                            className="flex md:hidden items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 transition-colors"
                            style={{ color: C.navy }}
                        >
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="flex md:hidden items-center gap-2">
                            <RescueMeLogo size={24} textClass="hidden" />
                        </div>
                        <h2 className="hidden md:block text-base font-semibold" style={{ color: C.navy }}>{t('provider.disputes.title')}</h2>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
                            <span className="text-xs font-medium" style={{ color: '#64748b' }}>{t('common.systemOperational')}</span>
                        </div>
                        <LanguageSwitcher />
                        <AvatarImage
                            name={user?.name || user?.email || 'Provider'}
                            avatar={user?.avatar}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            fallbackBackground={C.orange}
                            initialsCount={1}
                        />
                    </div>
                </header>

                <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
                    {/* Header */}
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: C.purpleLight }}>
                            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke={C.purple} strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold" style={{ color: C.navy }}>{t('provider.disputes.title')}</h1>
                            <p className="text-sm" style={{ color: C.gray }}>{t('provider.disputes.subtitle')}</p>
                        </div>
                    </div>

                    {/* Info Banner */}
                    <div className="rounded-2xl border p-4" style={{ background: '#faf5ff', borderColor: '#ddd6fe' }}>
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.purple }}>
                                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <div>
                                <p className="text-sm font-semibold" style={{ color: C.navy }}>Hướng dẫn xử lý khiếu nại</p>
                                <p className="text-xs mt-0.5" style={{ color: C.gray }}>
                                    Admin sẽ xem xét các khiếu nại và có thể yêu cầu bạn cung cấp thêm bằng chứng. Phản hồi kịp thời giúp giải quyết nhanh hơn.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Dispute List Card */}
                    <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: C.border }}>
                        {loading ? (
                            <div className="p-8 flex flex-col gap-3">
                                {[0, 1, 2].map(i => (
                                    <div key={i} className="rounded-xl animate-pulse p-4" style={{ background: C.bg }}>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg" style={{ background: '#e2e8f0' }} />
                                            <div className="flex-1 space-y-2">
                                                <div className="h-3 rounded" style={{ background: '#e2e8f0', width: '55%' }} />
                                                <div className="h-2.5 rounded" style={{ background: '#e2e8f0', width: '35%' }} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : error ? (
                            <div className="p-10 text-center" style={{ color: C.gray }}>
                                <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} className="mx-auto mb-3 opacity-40"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                <p className="text-sm font-medium">{t('provider.disputes.loadError')}</p>
                            </div>
                        ) : disputes.length === 0 ? (
                            <div className="p-10 flex flex-col items-center text-center gap-3">
                                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: C.greenLight }}>
                                    <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke={C.green} strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="font-semibold text-base" style={{ color: C.navy }}>{t('provider.disputes.empty')}</p>
                                    <p className="text-sm mt-1" style={{ color: C.gray }}>{t('provider.disputes.emptySub')}</p>
                                </div>
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-200" style={{ borderColor: C.border }}>
                                {disputes.map((d) => {
                                    const st = statusStyle(d.status);
                                    const date = new Date(d.createdAt);
                                    const dateStr = date.toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                    const requestId = d.payment?.requestId ?? d.request?.id ?? d.id;
                                    return (
                                        <li
                                            key={d.id}
                                            className="flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                                            onClick={() => router.push(`/provider/disputes/${d.id}`)}
                                        >
                                            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: C.purpleLight }}>
                                                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={C.purple} strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xs font-mono font-bold" style={{ color: C.navy }}>
                                                        #{requestId.slice(0, 8).toUpperCase()}
                                                    </span>
                                                    <span
                                                        className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold"
                                                        style={{ background: st.bg, color: st.color }}
                                                    >
                                                        {statusLabel(d.status)}
                                                    </span>
                                                </div>
                                                {d.userReason && (
                                                    <p className="text-sm mt-1 line-clamp-2" style={{ color: C.gray }}>
                                                        {t('provider.disputes.reason')}: {d.userReason}
                                                    </p>
                                                )}
                                                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                                    <span className="text-xs" style={{ color: C.gray }}>
                                                        {t('provider.disputes.filedAt')}: {dateStr}
                                                    </span>
                                                    {d.targetAmount !== undefined && d.targetAmount > 0 ? (
                                                        <span className="text-xs font-semibold" style={{ color: C.orange }}>
                                                            {d.targetAmount.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')}₫
                                                        </span>
                                                    ) : d.payment?.totalAmount > 0 && (
                                                        <span className="text-xs font-semibold" style={{ color: C.navy }}>
                                                            {d.payment.totalAmount.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')}₫
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={C.gray} strokeWidth={2} className="flex-shrink-0 mt-1">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                            </svg>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </ProviderLayout>
    );
}
