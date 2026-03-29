'use client';

import { useAdminGuard } from '@/lib/guards';
import AdminLayout from '@/components/AdminLayout';
import dynamic from 'next/dynamic';

const IncidentMap = dynamic(() => import('@/components/IncidentMap'), {
    ssr: false,
    loading: () => (
        <div className="flex-1 flex items-center justify-center" style={{ background: '#f4f6f9' }}>
            <div className="text-center">
                <div className="w-10 h-10 rounded-full border-[3px] animate-spin mx-auto mb-3"
                    style={{ borderColor: '#f97316', borderTopColor: 'transparent' }} />
                <p className="text-sm" style={{ color: '#6b7280' }}>Đang tải bản đồ...</p>
            </div>
        </div>
    ),
});

export default function AdminIncidentMapPage() {
    const { isReady } = useAdminGuard();

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
                    title="Bản đồ sự cố toàn hệ thống"
                    className="flex-1"
                />
            </div>
        </AdminLayout>
    );
}
