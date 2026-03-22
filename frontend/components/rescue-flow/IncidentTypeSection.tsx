'use client';

import { SectionHeader } from './SectionHeader';
import { INCIDENT_TYPES_META } from './incidents';
import type { IncidentTypeValue } from './incidents';
import type { RescueFlowColors } from './tokens';

export function IncidentTypeSection({
    colors,
    t,
    incidentType,
    onSelectType,
}: {
    colors: RescueFlowColors;
    t: (key: string) => string;
    incidentType: string;
    onSelectType: (value: IncidentTypeValue) => void;
}) {
    return (
        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <SectionHeader
                step={1}
                title={t('user.create.selectType')}
                colors={colors}
                icon={
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                    </svg>
                }
            />
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {INCIDENT_TYPES_META.map((type) => {
                    const active = incidentType === type.value;
                    const label = t('provider.incidents.' + type.value);
                    return (
                        <button
                            key={type.value}
                            type="button"
                            onClick={() => onSelectType(type.value)}
                            className="flex flex-col items-center gap-2 py-3 px-1 rounded-xl transition-all active:scale-95"
                            style={{
                                border: `1.5px solid ${active ? colors.orange : '#e5e7eb'}`,
                                background: active ? colors.orangeLight : colors.white,
                                color: active ? colors.orange : colors.gray,
                            }}
                        >
                            <span style={{ color: active ? colors.orange : '#94a3b8' }}>{type.icon}</span>
                            <span
                                className="text-[11px] font-medium leading-tight text-center"
                                style={{ color: active ? colors.orange : colors.navy }}
                            >
                                {label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
