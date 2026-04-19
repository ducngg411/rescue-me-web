'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useDisputeNavBadge } from '@/lib/hooks/useDisputeNavBadge';

type Ctx = {
    disputeNavBadge: number;
    resetDisputeNavBadge: () => void;
};

const ProviderDisputeNavBadgeContext = createContext<Ctx>({
    disputeNavBadge: 0,
    resetDisputeNavBadge: () => {},
});

export function ProviderDisputeNavBadgeProvider({ children }: { children: React.ReactNode }) {
    const { badge, resetOnNavigate } = useDisputeNavBadge({
        fetchPath: '/disputes/provider',
        listPath: '/provider/disputes',
        storagePrefix: 'provider.disputes',
    });

    const value = useMemo(
        () => ({
            disputeNavBadge: badge,
            resetDisputeNavBadge: resetOnNavigate,
        }),
        [badge, resetOnNavigate],
    );

    return (
        <ProviderDisputeNavBadgeContext.Provider value={value}>
            {children}
        </ProviderDisputeNavBadgeContext.Provider>
    );
}

export function useProviderDisputeNavBadge() {
    return useContext(ProviderDisputeNavBadgeContext);
}
