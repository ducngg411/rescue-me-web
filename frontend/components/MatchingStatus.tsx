'use client';
import { useLanguage } from '@/contexts/LanguageContext';

const C = {
    orange: '#f97316',
    orangeDark: '#ea6c0a',
    orangeLight: '#fff7ed',
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#f1f5f9',
    bg: '#f8fafc',
};

interface MatchingStatusProps {
    timeRemaining: number;
    searchPhase?: number;
    viewingProvidersCount?: number;
    quoteCount?: number;
    maxQuotes?: number;
    quoteWindowOpen?: boolean;
    onCancel: () => void;
    onViewQuotes?: () => void;
}

export default function MatchingStatus({
    timeRemaining,
    searchPhase = 1,
    viewingProvidersCount = 0,
    quoteCount = 0,
    maxQuotes = 3,
    quoteWindowOpen = true,
    onCancel,
    onViewQuotes,
}: MatchingStatusProps) {
    const { t } = useLanguage();
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;

    const hasViewingProviders = viewingProvidersCount > 0;
    const hasQuotes = quoteCount > 0;
    const windowClosed = !quoteWindowOpen;

    // Dynamic state config
    let state: 'searching' | 'viewing' | 'quotes' | 'closed' | 'expanded' = 'searching';
    if (windowClosed) state = 'closed';
    else if (hasQuotes) state = 'quotes';
    else if (hasViewingProviders) state = 'viewing';
    else if (searchPhase === 2) state = 'expanded';

    const stateConfig = {
        searching: { color: C.orange, bg: C.orangeLight, label: t('user.tracking.matching.searching'), pulse: true },
        viewing: { color: '#2563eb', bg: '#eff6ff', label: t('user.tracking.matching.viewing'), pulse: true },
        quotes: { color: '#16a34a', bg: '#f0fdf4', label: t('user.tracking.matching.quotes', { count: quoteCount, max: maxQuotes }), pulse: true },
        closed: { color: '#7c3aed', bg: '#f5f3ff', label: t('user.tracking.matching.closed', { count: quoteCount }), pulse: false },
        expanded: { color: C.orange, bg: C.orangeLight, label: t('user.tracking.matching.expanded'), pulse: true },
    }[state];

    const messageTitle = (() => {
        if (windowClosed) return t('user.tracking.matching.msgReceivedQuotes', { count: quoteCount, max: maxQuotes });
        if (hasQuotes) return t('user.tracking.matching.msgReceivedQuotes', { count: quoteCount, max: maxQuotes });
        if (hasViewingProviders) return t('user.tracking.matching.msgViewing', { count: viewingProvidersCount });
        if (searchPhase === 2) return t('user.tracking.matching.msgExpanding');
        return t('user.tracking.matching.msgSending');
    })();

    const messageSubtitle = (() => {
        if (windowClosed) return t('user.tracking.matching.subWait');
        if (hasQuotes) return t('user.tracking.matching.subCountdownQuotes', { seconds: Math.floor(timeRemaining) });
        if (hasViewingProviders) return t('user.tracking.matching.subCountdownViewing', { seconds: Math.floor(timeRemaining) });
        if (searchPhase === 2) return t('user.tracking.matching.subExpanded');
        return t('user.tracking.matching.subSending');
    })();

    return (
        <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>

            {/* Status Badge */}
            <div className="flex justify-center mb-5">
                <div
                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold"
                    style={{ background: stateConfig.bg, color: stateConfig.color }}
                >
                    <div
                        className={stateConfig.pulse ? 'animate-ping w-2 h-2 rounded-full' : 'w-2 h-2 rounded-full'}
                        style={{ background: stateConfig.color, opacity: stateConfig.pulse ? 0.8 : 1 }}
                    />
                    {!stateConfig.pulse && <div className="w-2 h-2 rounded-full absolute" style={{ background: stateConfig.color }} />}
                    <span>{stateConfig.label}</span>
                </div>
            </div>

            {/* Countdown OR Quote count */}
            {!windowClosed ? (
                <div className="text-center mb-5">
                    {/* Big timer */}
                    <div
                        className="text-5xl font-bold tabular-nums mb-1"
                        style={{ color: timeRemaining < 30 ? '#ef4444' : C.navy }}
                    >
                        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                    </div>
                    <p className="text-xs" style={{ color: C.gray }}>{t('user.tracking.matching.timeLeft')}</p>
                    {/* Progress bar */}
                    <div className="mt-3 w-full h-1.5 rounded-full overflow-hidden mx-auto" style={{ background: C.border, maxWidth: '200px' }}>
                        <div
                            className="h-full rounded-full transition-all duration-1000"
                            style={{
                                width: `${Math.min(100, (timeRemaining / 180) * 100)}%`,
                                background: timeRemaining < 30 ? '#ef4444' : C.orange,
                            }}
                        />
                    </div>
                </div>
            ) : (
                <div className="text-center mb-5">
                    <div className="text-5xl font-bold mb-1" style={{ color: '#7c3aed' }}>
                        {quoteCount}<span className="text-2xl text-gray-400">/{maxQuotes}</span>
                    </div>
                    <p className="text-xs" style={{ color: C.gray }}>{t('user.tracking.matching.quotesReceivedInfo')}</p>
                </div>
            )}

            {/* Visual indicator */}
            <div className="flex justify-center mb-5">
                {hasQuotes ? (
                    <div className="relative w-16 h-16 rounded-full flex items-center justify-center" style={{ background: '#f0fdf4' }}>
                        <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#16a34a' }}>
                            {quoteCount}
                        </div>
                    </div>
                ) : hasViewingProviders ? (
                    <div className="relative w-16 h-16 rounded-full flex items-center justify-center" style={{ background: '#eff6ff' }}>
                        <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#2563eb" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#2563eb' }}>
                            {viewingProvidersCount}
                        </div>
                    </div>
                ) : (
                    // Pulsing ring animation
                    <div className="relative w-16 h-16">
                        <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: C.orange }} />
                        <div className="absolute inset-2 rounded-full animate-ping opacity-30 delay-150" style={{ background: C.orange }} />
                        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: C.orangeLight }}>
                            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                    </div>
                )}
            </div>

            {/* Info message */}
            <div className="rounded-xl p-3.5 mb-5 flex items-start gap-3" style={{ background: stateConfig.bg }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={stateConfig.color} strokeWidth={2} className="flex-shrink-0 mt-0.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                    <p className="text-sm font-semibold" style={{ color: C.navy }}>{messageTitle}</p>
                    <p className="text-xs mt-0.5" style={{ color: C.gray }}>{messageSubtitle}</p>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
                {windowClosed && quoteCount > 0 && (
                    <button
                        onClick={onViewQuotes}
                        className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.98]"
                        style={{ background: '#7c3aed', boxShadow: '0 4px 12px rgba(124,58,237,0.4)' }}
                    >
                        {t('user.tracking.matching.selectQuoteBtn', { count: quoteCount })}
                    </button>
                )}
                <button
                    onClick={onCancel}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold transition-colors"
                    style={{ background: '#fef2f2', color: '#ef4444', border: '1.5px solid #fecaca' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fee2e2'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#fef2f2'}
                >
                    {t('user.tracking.matching.cancelBtn')}
                </button>
            </div>
        </div>
    );
}
