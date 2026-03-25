'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import api from '@/lib/api';

function toInt(value: string | null, fallback: number) {
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export type UseDisputeNavBadgeOptions = {
    /** e.g. `/disputes/my` or `/disputes/provider` */
    fetchPath: string;
    /** Base path for inbox; detail routes under it also clear badge */
    listPath: string;
    storagePrefix: string;
    pollMs?: number;
};

/**
 * Simple “new cases” badge: when total dispute count increases, badge += delta.
 * Visiting listPath (or a sub-route) resets badge. Not message-unread math.
 */
export function useDisputeNavBadge(options: UseDisputeNavBadgeOptions) {
    const { fetchPath, listPath, storagePrefix, pollMs = 30000 } = options;
    const pathname = usePathname();
    const [badge, setBadge] = useState(0);
    const [latestTotal, setLatestTotal] = useState(0);

    const LS_SEEN = `${storagePrefix}.seenTotal`;
    const LS_BADGE = `${storagePrefix}.badgeCount`;

    useEffect(() => {
        let active = true;

        const tick = async () => {
            try {
                const res = await api.get(fetchPath);
                if (!active) return;

                const total = Number(
                    res.data?.total ??
                        (Array.isArray(res.data?.items) ? res.data.items.length : 0),
                );
                setLatestTotal(total);

                const inDisputeSection =
                    pathname === listPath || pathname.startsWith(`${listPath}/`);

                const seenTotal = toInt(
                    typeof window !== 'undefined' ? localStorage.getItem(LS_SEEN) : null,
                    total,
                );
                const currentBadge = toInt(
                    typeof window !== 'undefined' ? localStorage.getItem(LS_BADGE) : null,
                    0,
                );

                if (inDisputeSection) {
                    localStorage.setItem(LS_SEEN, String(total));
                    localStorage.setItem(LS_BADGE, '0');
                    setBadge(0);
                    return;
                }

                if (total < seenTotal) {
                    localStorage.setItem(LS_SEEN, String(total));
                    setBadge(currentBadge);
                    return;
                }

                const delta = Math.max(0, total - seenTotal);
                const next = currentBadge + delta;
                localStorage.setItem(LS_BADGE, String(next));
                localStorage.setItem(LS_SEEN, String(total));
                setBadge(next);
            } catch {
                if (active) setBadge(0);
            }
        };

        void tick();
        const id = window.setInterval(() => void tick(), pollMs);
        return () => {
            active = false;
            window.clearInterval(id);
        };
    }, [pathname, fetchPath, listPath, LS_SEEN, LS_BADGE, pollMs]);

    const resetOnNavigate = useCallback(() => {
        if (typeof window === 'undefined') return;
        localStorage.setItem(LS_BADGE, '0');
        localStorage.setItem(LS_SEEN, String(latestTotal));
        setBadge(0);
    }, [LS_BADGE, LS_SEEN, latestTotal]);

    return { badge, latestTotal, resetOnNavigate };
}
