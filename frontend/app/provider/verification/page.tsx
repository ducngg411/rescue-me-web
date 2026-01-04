'use client';

import React from 'react';
import ProviderVerificationSubmit from '@/components/ProviderVerificationSubmit';
import { useAuthGuard } from '@/lib/guards';

export default function ProviderVerificationPage() {
    const { isReady } = useAuthGuard({ requireAuth: true });

    if (!isReady) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <ProviderVerificationSubmit />
        </div>
    );
}
