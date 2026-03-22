'use client';

import type { CSSProperties } from 'react';
import { SectionHeader } from './SectionHeader';
import type { RescueFlowColors } from './tokens';

export function DescriptionSection({
    colors,
    t,
    description,
    onDescriptionChange,
}: {
    colors: RescueFlowColors;
    t: (key: string) => string;
    description: string;
    onDescriptionChange: (v: string) => void;
}) {
    const inputStyle: CSSProperties = {
        width: '100%',
        padding: '10px 14px',
        borderRadius: '10px',
        border: '1.5px solid #e5e7eb',
        color: colors.navy,
        fontSize: '14px',
        outline: 'none',
        background: colors.white,
        resize: 'none',
    };

    return (
        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <SectionHeader
                step={5}
                title={t('user.create.descriptionSection')}
                colors={colors}
                icon={
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                }
            />
            <textarea
                value={description}
                onChange={(e) => onDescriptionChange(e.target.value)}
                placeholder={t('user.create.descriptionPlaceholder')}
                rows={3}
                style={inputStyle}
                onFocus={(e) => (e.target.style.border = `1.5px solid ${colors.orange}`)}
                onBlur={(e) => (e.target.style.border = '1.5px solid #e5e7eb')}
            />
        </div>
    );
}
