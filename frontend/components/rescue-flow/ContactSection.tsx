'use client';

import type { CSSProperties } from 'react';
import { SectionHeader } from './SectionHeader';
import type { RescueFlowColors } from './tokens';

export function ContactSection({
    colors,
    t,
    contactPhone,
    onContactPhoneChange,
}: {
    colors: RescueFlowColors;
    t: (key: string) => string;
    contactPhone: string;
    onContactPhoneChange: (v: string) => void;
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
    };

    return (
        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <SectionHeader
                step={4}
                title={t('user.create.contactSection')}
                colors={colors}
                icon={
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                    </svg>
                }
            />
            <label className="block text-xs font-medium mb-1.5" style={{ color: colors.gray }}>
                {t('user.create.phoneLabel')} <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
                type="tel"
                value={contactPhone}
                onChange={(e) => onContactPhoneChange(e.target.value)}
                placeholder={t('user.create.phonePlaceholder')}
                style={inputStyle}
                onFocus={(e) => (e.target.style.border = `1.5px solid ${colors.orange}`)}
                onBlur={(e) => (e.target.style.border = '1.5px solid #e5e7eb')}
                required
            />
            <p className="mt-1.5 text-xs" style={{ color: colors.gray }}>
                {t('user.create.phoneHint')}
            </p>
        </div>
    );
}
