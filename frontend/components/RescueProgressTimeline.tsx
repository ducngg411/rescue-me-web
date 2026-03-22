'use client';

export type RescueProgressTimelineLabels = {
    sent: string;
    searching: string;
    chooseQuote: string;
    moving: string;
    working: string;
    payment: string;
    done: string;
};

const C = {
    orange: '#f97316',
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#f1f5f9',
};

/** Shared step index for guest + customer rescue tracking (two-phase 4-dot UI). */
export function rescueTimelineStepIndex(status: string, quoteCount: number): number {
    const q = quoteCount ?? 0;
    if (['CANCELLED', 'REJECTED', 'EXPIRED'].includes(status)) return -1;

    switch (status) {
        case 'CREATED':
            return 0;
        case 'SEARCHING':
        case 'MATCHED':
            return 1;
        case 'MATCHING':
            return q > 0 ? 2 : 1;
        case 'ACCEPTED':
        case 'ASSIGNED':
            return 3;
        case 'IN_PROGRESS':
            return 3;
        case 'ARRIVED':
            return 4;
        case 'WORKING':
            return 4;
        case 'PAYMENT_PENDING':
            return 5;
        case 'PAID':
        case 'COMPLETED':
            return 6;
        default:
            return 1;
    }
}

export default function RescueProgressTimeline({
    status,
    quoteCount = 0,
    labels,
}: {
    status: string;
    quoteCount?: number;
    labels: RescueProgressTimelineLabels;
}) {
    const currentIndex = rescueTimelineStepIndex(status, quoteCount);
    if (currentIndex < 0) return null;

    const phase1 = [
        { key: 'p1-sent', fullIndex: 0 as const, label: labels.sent },
        { key: 'p1-searching', fullIndex: 1 as const, label: labels.searching },
        { key: 'p1-choose', fullIndex: 2 as const, label: labels.chooseQuote },
        { key: 'p1-moving', fullIndex: 3 as const, label: labels.moving },
    ];
    const phase2 = [
        { key: 'p2-moving', fullIndex: 3 as const, label: labels.moving },
        { key: 'p2-working', fullIndex: 4 as const, label: labels.working },
        { key: 'p2-payment', fullIndex: 5 as const, label: labels.payment },
        { key: 'p2-done', fullIndex: 6 as const, label: labels.done },
    ];

    const usePhase2 = currentIndex >= 3;
    const steps = usePhase2 ? phase2 : phase1;

    const renderDot = (step: (typeof steps)[number]) => {
        const fi = step.fullIndex;
        const isDone = currentIndex > fi;
        const isActive = currentIndex === fi;
        const dotBg = isDone ? '#16a34a' : isActive ? C.orange : C.border;
        return (
            <div className="flex h-4 items-center justify-center">
                <div
                    className="box-border flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full transition-all"
                    style={{
                        background: dotBg,
                        border: isActive ? `2px solid ${C.orange}` : '2px solid transparent',
                        boxShadow: isActive ? `0 0 0 3px ${C.orange}22` : undefined,
                    }}
                >
                    {isDone && (
                        <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    )}
                    {isActive && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                </div>
            </div>
        );
    };

    const renderLabel = (step: (typeof steps)[number]) => {
        const fi = step.fullIndex;
        const isDone = currentIndex > fi;
        const isActive = currentIndex === fi;
        const labelColor = isDone ? '#16a34a' : isActive ? C.orange : C.gray;
        return (
            <p
                className="px-0.5 pt-1 text-center text-[9px] font-semibold leading-snug sm:text-[10px] text-balance"
                style={{ color: labelColor }}
            >
                {step.label}
            </p>
        );
    };

    return (
        <div className="rounded-2xl bg-white px-4 pb-2.5 pt-3 sm:px-5 sm:pb-3 sm:pt-3.5" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
            <div className="relative w-full">
                <div className="relative h-4 w-full">
                    <div
                        className="pointer-events-none absolute left-[12.5%] top-1/2 z-0 h-0.5 w-[75%] -translate-y-1/2"
                        style={{ background: C.border }}
                    />
                    <div className="relative z-[1] grid h-4 grid-cols-4">
                        {steps.map((step) => (
                            <div key={`d-${step.key}`}>{renderDot(step)}</div>
                        ))}
                    </div>
                </div>
                <div className="relative z-[1] grid grid-cols-4">
                    {steps.map((step) => (
                        <div key={`l-${step.key}`}>{renderLabel(step)}</div>
                    ))}
                </div>
            </div>
        </div>
    );
}
