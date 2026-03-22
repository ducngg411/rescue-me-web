/** Shared client countdown for quote window — derived from server deadline so guest/customer/provider stay aligned. */
export type MatchingQuoteWindowSource = {
    status: string;
    quoteWindowOpen?: boolean;
    quoteWindowExpiresAt?: string | null;
    expiresAt?: string | null;
    quoteWindowTimeRemaining?: number;
};

export function matchingQuoteWindowSecondsRemaining(
    source: MatchingQuoteWindowSource | null | undefined,
): number {
    if (!source || source.status !== 'MATCHING') return 0;
    if (source.quoteWindowOpen === false) return 0;

    if (source.quoteWindowExpiresAt) {
        const t = new Date(source.quoteWindowExpiresAt).getTime();
        if (Number.isNaN(t)) return Math.max(0, source.quoteWindowTimeRemaining ?? 0);
        return Math.max(0, Math.floor((t - Date.now()) / 1000));
    }
    if (source.expiresAt) {
        const t = new Date(source.expiresAt).getTime();
        if (Number.isNaN(t)) return Math.max(0, source.quoteWindowTimeRemaining ?? 0);
        return Math.max(0, Math.floor((t - Date.now()) / 1000));
    }
    return Math.max(0, source.quoteWindowTimeRemaining ?? 0);
}
