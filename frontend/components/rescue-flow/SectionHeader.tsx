import type { RescueFlowColors } from './tokens';

export function SectionHeader({
    step,
    title,
    icon,
    colors,
}: {
    step: number;
    title: string;
    icon: React.ReactNode;
    colors: RescueFlowColors;
}) {
    return (
        <div className="flex items-center gap-3 mb-4">
            <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ background: colors.orange }}
            >
                {step}
            </div>
            <div className="flex items-center gap-2">
                <span style={{ color: colors.orange }}>{icon}</span>
                <h2 className="font-semibold text-sm" style={{ color: colors.navy }}>
                    {title}
                </h2>
            </div>
        </div>
    );
}
