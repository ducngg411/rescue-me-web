import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';

export interface PendingRequest {
    id: string;
    user: {
        name: string | null;
        phone: string | null;
    };
    incidentType: string;
    vehicleType: string;
    description: string | null;
    contactPhone: string;
    pickupLocation: {
        lat: number;
        lng: number;
        address: string;
    };
    dropoffLocation?: any;
    media: Array<{
        type: string;
        url: string;
    }>;
    distance: number;
    eta?: number; // Estimated time of arrival in minutes
    etaSeconds?: number; // ETA in seconds for countdown
    estimatedEarnings: number;
    searchPhase: number;
    expiresAt: string | null;
    timeRemaining: number;
    createdAt: string;
}

interface UsePendingRequestsOptions {
    enabled?: boolean;
    pollInterval?: number; // milliseconds
}

export function usePendingRequests({
    enabled = true,
    pollInterval = 5000, // 5 seconds
}: UsePendingRequestsOptions = {}) {
    const [requests, setRequests] = useState<PendingRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const fetchRequests = useCallback(async () => {
        try {
            const response = await api.get<PendingRequest[]>('/me/provider/pending-requests');
            setRequests(response.data);
            setError(null);
            return response.data;
        } catch (err: any) {
            console.error('Error fetching pending requests:', err);
            const errorMsg = err.response?.data?.message || 'Không thể tải requests';
            setError(errorMsg);
            return [];
        } finally {
            setIsLoading(false);
        }
    }, []);

    const stopPolling = useCallback(() => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
    }, []);

    const startPolling = useCallback(() => {
        stopPolling();

        // Initial fetch
        fetchRequests();

        // Setup polling
        pollIntervalRef.current = setInterval(() => {
            fetchRequests();
        }, pollInterval);
    }, [fetchRequests, pollInterval, stopPolling]);

    useEffect(() => {
        if (enabled) {
            startPolling();
        } else {
            stopPolling();
        }

        return () => {
            stopPolling();
        };
    }, [enabled, startPolling, stopPolling]);

    const acceptRequest = async (requestId: string) => {
        try {
            const response = await api.post(`/me/provider/requests/${requestId}/accept`);

            // Remove from pending list
            setRequests(prev => prev.filter(r => r.id !== requestId));

            return {
                success: true,
                request: response.data.request,
            };
        } catch (err: any) {
            console.error('Error accepting request:', err);
            return {
                success: false,
                message: err.response?.data?.message || 'Không thể nhận request',
            };
        }
    };

    const declineRequest = async (requestId: string) => {
        try {
            await api.post(`/me/provider/requests/${requestId}/decline`);

            // Remove from pending list
            setRequests(prev => prev.filter(r => r.id !== requestId));

            return { success: true };
        } catch (err: any) {
            console.error('Error declining request:', err);
            return {
                success: false,
                message: err.response?.data?.message || 'Không thể từ chối request',
            };
        }
    };

    return {
        requests,
        isLoading,
        error,
        fetchRequests,
        acceptRequest,
        declineRequest,
        startPolling,
        stopPolling,
    };
}
