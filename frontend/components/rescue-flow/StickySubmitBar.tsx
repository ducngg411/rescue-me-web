'use client';

import type { RescueFlowColors } from './tokens';

export function StickySubmitBar({
    colors,
    t,
    onBack,
    isSubmitting,
    submitDisabled,
    layout = 'withBack',
}: {
    colors: RescueFlowColors;
    t: (key: string) => string;
    onBack: () => void;
    isSubmitting: boolean;
    submitDisabled: boolean;
    layout?: 'withBack' | 'submitOnly';
}) {
    const submitInner = isSubmitting ? (
        <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            {t('user.create.submitting')}
        </span>
    ) : (
        <span className="flex items-center justify-center gap-2">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
            </svg>
            {t('user.create.submitBtn')}
        </span>
    );

    return (
        <div
            className="fixed bottom-0 left-0 right-0 z-20 px-4 py-3"
            style={{
                background: colors.white,
                borderTop: `1px solid ${colors.border}`,
                boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
            }}
        >
            <div className={`max-w-2xl mx-auto ${layout === 'withBack' ? 'flex gap-3' : ''}`}>
                {layout === 'withBack' && (
                    <button
                        type="button"
                        onClick={onBack}
                        className="w-14 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                        style={{ background: colors.bg, color: colors.gray, border: `1px solid ${colors.border}` }}
                    >
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                )}
                <button
                    type="submit"
                    disabled={submitDisabled}
                    className={`${layout === 'withBack' ? 'flex-1' : 'w-full'} h-12 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98]`}
                    style={{
                        background: submitDisabled ? '#fdba74' : `linear-gradient(135deg, ${colors.orange} 0%, ${colors.orangeDark} 100%)`,
                        boxShadow: !submitDisabled ? `0 4px 16px ${colors.orange}40` : 'none',
                        cursor: submitDisabled ? 'not-allowed' : 'pointer',
                    }}
                >
                    {submitInner}
                </button>
            </div>
        </div>
    );
}
