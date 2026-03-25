import type { ReactNode } from 'react';
import { UserDisputeNavBadgeProvider } from '@/contexts/UserDisputeNavBadgeContext';

export default function UserLayout({ children }: { children: ReactNode }) {
    return <UserDisputeNavBadgeProvider>{children}</UserDisputeNavBadgeProvider>;
}
