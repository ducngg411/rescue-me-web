'use client';

import type { RescueFlowColors } from '../tokens';

export function GuestWalletLockedCard({
    colors,
    title,
    description,
    ctaLabel,
    registerHref = '/auth/register',
}: {
    colors: RescueFlowColors;
    title: string;
    description: string;
    ctaLabel: string;
    registerHref?: string;
}) {
    return (
        <div className="rounded-2xl p-5" style={{ background: '#fefce8', border: '1.5px solid #fde68a' }}>
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#fef9c3' }}>
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#ca8a04" strokeWidth={2}>
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                    </svg>
                </div>
                <div>
                    <p className="font-semibold text-sm" style={{ color: colors.navy }}>
                        {title}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#92400e' }}>
                        {description}
                    </p>
                </div>
            </div>
            <a
                href={registerHref}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm text-white transition-all"
                style={{ background: 'linear-gradient(135deg,#d97706,#b45309)' }}
            >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                    />
                </svg>
                {ctaLabel}
            </a>
        </div>
    );
}
