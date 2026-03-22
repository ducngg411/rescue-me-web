'use client';

export function PaymentCompletedCard({
    title,
    subtitle,
}: {
    title: string;
    subtitle?: string;
}) {
    return (
        <div className="rounded-2xl p-5 text-center" style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0' }}>
            <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: '#dcfce7' }}>
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
            </div>
            <p className="font-bold text-sm" style={{ color: '#15803d' }}>
                {title}
            </p>
            {subtitle && (
                <p className="text-xs mt-1" style={{ color: '#16a34a' }}>
                    {subtitle}
                </p>
            )}
        </div>
    );
}
