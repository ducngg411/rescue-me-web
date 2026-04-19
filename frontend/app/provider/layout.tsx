import type { ReactNode } from 'react';
import { ProviderDisputeNavBadgeProvider } from '@/contexts/ProviderDisputeNavBadgeContext';
import { ProviderConfigProvider } from '@/contexts/ProviderConfigContext';

export default function ProviderLayout({ children }: { children: ReactNode }) {
    return (
        <ProviderDisputeNavBadgeProvider>
            <ProviderConfigProvider>
                {children}
            </ProviderConfigProvider>
        </ProviderDisputeNavBadgeProvider>
    );
}
