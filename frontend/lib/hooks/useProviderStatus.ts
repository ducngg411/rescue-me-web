import { useState, useCallback } from 'react';
import api from '@/lib/api';

interface ProviderStatusResponse {
    success: boolean;
    isOnline: boolean;
    message: string;
}

export function useProviderStatus() {
    const [isOnline, setIsOnline] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const toggleOnlineStatus = useCallback(async (newStatus: boolean) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await api.patch<ProviderStatusResponse>('/me/provider/status', {
                isOnline: newStatus,
            });

            setIsOnline(response.data.isOnline);
            return {
                success: true,
                message: response.data.message,
            };
        } catch (err: any) {
            const errorMsg = err.response?.data?.message || 'Không thể cập nhật trạng thái';
            setError(errorMsg);
            return {
                success: false,
                message: errorMsg,
            };
        } finally {
            setIsLoading(false);
        }
    }, []);

    const setOnline = useCallback(() => toggleOnlineStatus(true), [toggleOnlineStatus]);
    const setOffline = useCallback(() => toggleOnlineStatus(false), [toggleOnlineStatus]);

    return {
        isOnline,
        isLoading,
        error,
        toggleOnlineStatus,
        setOnline,
        setOffline,
        setIsOnline, // For manual control from profile fetch
    };
}
