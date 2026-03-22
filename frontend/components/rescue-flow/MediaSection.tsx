'use client';

import type { ReactNode } from 'react';
import { SectionHeader } from './SectionHeader';
import type { RescueFlowColors } from './tokens';

export function MediaSection({
    colors,
    t,
    imageUploadSlot,
    videoUploadSlot,
}: {
    colors: RescueFlowColors;
    t: (key: string) => string;
    imageUploadSlot: ReactNode;
    videoUploadSlot: ReactNode;
}) {
    return (
        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <SectionHeader
                step={6}
                title={t('user.create.mediaSection')}
                colors={colors}
                icon={
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                    </svg>
                }
            />
            <div className="space-y-4">
                <div>
                    <p className="text-xs font-medium mb-2" style={{ color: colors.gray }}>
                        {t('user.create.photoLabel')}
                    </p>
                    {imageUploadSlot}
                </div>
                <div>
                    <p className="text-xs font-medium mb-2" style={{ color: colors.gray }}>
                        {t('user.create.videoLabel')}
                    </p>
                    {videoUploadSlot}
                </div>
            </div>
        </div>
    );
}
