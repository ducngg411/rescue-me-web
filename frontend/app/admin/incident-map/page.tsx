'use client';

import { useAdminGuard } from '@/lib/guards';
import AdminLayout from '@/components/AdminLayout';
import { IncidentMapDynamicFallback } from '@/components/IncidentMapDynamicFallback';
import { useLanguage } from '@/contexts/LanguageContext';
import dynamic from 'next/dynamic';

const IncidentMap = dynamic(() => import('@/components/IncidentMap'), {
    ssr: false,
    loading: () => <IncidentMapDynamicFallback />,
});

export default function AdminIncidentMapPage() {
    const { isReady } = useAdminGuard();
    const { t } = useLanguage();

    if (!isReady) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: '#f4f6f9' }}>
                <div className="w-10 h-10 rounded-full border-[3px] animate-spin"
                    style={{ borderColor: '#f97316', borderTopColor: 'transparent' }} />
            </div>
        );
    }

    return (
        <AdminLayout activeTab="/admin/incident-map">
            <div className="flex flex-col" style={{ height: 'calc(100vh - 40px)' }}>
                <IncidentMap
                    apiEndpoint="/admin/incidents/map-data"
                    title={t('admin.incidentMap.title')}
                    className="flex-1"
                />
            </div>
        </AdminLayout>
    );
}
