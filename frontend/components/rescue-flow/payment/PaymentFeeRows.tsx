'use client';

import type { RescueFlowColors } from '../tokens';

export function PaymentFeeRow({
    label,
    amount,
    colors,
    locale = 'vi-VN',
}: {
    label: string;
    amount: number;
    colors: RescueFlowColors;
    locale?: string;
}) {
    if (amount <= 0) return null;
    return (
        <div className="flex justify-between text-sm py-1">
            <span style={{ color: colors.gray }}>{label}</span>
            <span style={{ color: colors.navy }}>{amount.toLocaleString(locale)}đ</span>
        </div>
    );
}

export function PaymentFeeSummaryCard({
    colors,
    title,
    children,
    totalLabel,
    totalAmount,
    note,
    notePrefix,
    locale = 'vi-VN',
}: {
    colors: RescueFlowColors;
    title: string;
    children: React.ReactNode;
    totalLabel: string;
    totalAmount: number;
    note?: string | null;
    notePrefix?: string;
    locale?: string;
}) {
    return (
        <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: colors.orangeLight }}>
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke={colors.orange} strokeWidth={2.5}>
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                    </svg>
                </div>
                <h3 className="text-sm font-semibold" style={{ color: colors.navy }}>
                    {title}
                </h3>
            </div>

            <div className="space-y-0.5">{children}</div>

            <div className="flex justify-between items-center pt-3 mt-2" style={{ borderTop: `1.5px solid ${colors.border}` }}>
                <span className="font-semibold text-sm" style={{ color: colors.navy }}>
                    {totalLabel}
                </span>
                <span className="font-bold text-xl" style={{ color: colors.orange }}>
                    {totalAmount.toLocaleString(locale)}đ
                </span>
            </div>

            {note && (
                <p className="mt-3 text-xs px-3 py-2 rounded-lg" style={{ color: colors.gray, background: colors.bg }}>
                    {notePrefix ? `${notePrefix}: ${note}` : note}
                </p>
            )}
        </div>
    );
}
