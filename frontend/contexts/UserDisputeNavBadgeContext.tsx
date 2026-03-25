'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useDisputeNavBadge } from '@/lib/hooks/useDisputeNavBadge';

type Ctx = {
    disputeNavBadge: number;
    resetDisputeNavBadge: () => void;
};

const UserDisputeNavBadgeContext = createContext<Ctx>({
    disputeNavBadge: 0,
    resetDisputeNavBadge: () => {},
});

export function UserDisputeNavBadgeProvider({ children }: { children: React.ReactNode }) {
    const { badge, resetOnNavigate } = useDisputeNavBadge({
        fetchPath: '/disputes/my',
        listPath: '/user/disputes',
        storagePrefix: 'user.disputes',
    });

    const value = useMemo(
        () => ({
            disputeNavBadge: badge,
            resetDisputeNavBadge: resetOnNavigate,
        }),
        [badge, resetOnNavigate],
    );

    return (
        <UserDisputeNavBadgeContext.Provider value={value}>
            {children}
        </UserDisputeNavBadgeContext.Provider>
    );
}

export function useUserDisputeNavBadge() {
    return useContext(UserDisputeNavBadgeContext);
}
