'use client';

import type { RescueFlowColors } from '../tokens';

export function PaymentQrProgressTimeline({
    colors,
    steps,
    currentStepIndex,
    isCompleted,
}: {
    colors: RescueFlowColors;
    steps: Array<{ key: string; label: string }>;
    /** 0-based active step when not completed */
    currentStepIndex: number;
    isCompleted: boolean;
}) {
    return (
        <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${colors.border}` }}>
            <div className="flex items-center justify-between relative">
                <div className="absolute top-3 left-0 right-0 h-0.5 mx-3" style={{ background: colors.border, zIndex: 0 }} />
                {steps.map((step, i) => {
                    const isDone = isCompleted || currentStepIndex > i;
                    const isActive = !isCompleted && currentStepIndex === i;
                    const dotBg = isDone ? '#16a34a' : isActive ? colors.orange : colors.border;
                    const labelColor = isDone ? '#16a34a' : isActive ? colors.orange : colors.gray;
                    return (
                        <div key={step.key} className="flex flex-col items-center" style={{ zIndex: 1, flex: 1 }}>
                            <div
                                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                                style={{
                                    background: dotBg,
                                    boxShadow: isActive ? `0 0 0 3px ${colors.orange}22` : undefined,
                                }}
                            >
                                {isDone ? (
                                    <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : isActive ? (
                                    <div className="w-2 h-2 rounded-full bg-white" />
                                ) : null}
                            </div>
                            <p
                                className="text-[9px] font-semibold text-center mt-1.5 leading-tight"
                                style={{ color: labelColor, maxWidth: 44 }}
                            >
                                {step.label}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
