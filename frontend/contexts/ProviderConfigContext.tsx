'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '@/lib/api';

type ProviderConfig = {
    commissionRate: number;
};

type Ctx = {
    config: ProviderConfig | null;
    commissionRatePct: number;
};

const ProviderConfigContext = createContext<Ctx>({
    config: null,
    commissionRatePct: 0,
});

export function ProviderConfigProvider({ children }: { children: React.ReactNode }) {
    const [config, setConfig] = useState<ProviderConfig | null>(null);

    useEffect(() => {
        api.get<ProviderConfig>('/me/provider/config')
            .then(res => setConfig(res.data))
            .catch(() => {/* non-critical — consumers fall back gracefully */});
    }, []);

    const commissionRatePct = config ? Math.round(config.commissionRate * 100) : 0;

    return (
        <ProviderConfigContext.Provider value={{ config, commissionRatePct }}>
            {children}
        </ProviderConfigContext.Provider>
    );
}

export function useProviderConfig() {
    return useContext(ProviderConfigContext);
}
