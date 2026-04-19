import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';

export interface PendingRequest {
    id: string;
    user: {
        name: string | null;
        phone: string | null;
        avatar?: string | null;
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
    // Quote window info
    quoteWindowOpen?: boolean;
    quoteWindowTimeRemaining?: number;
    quoteWindowExpiresAt?: string | null;
    quoteCount?: number;
    maxQuotes?: number;
    createdAt: string;
}

interface UsePendingRequestsOptions {
    enabled?: boolean;
    pollInterval?: number; // milliseconds
}

// Adaptive backoff config: if no requests found, gradually slow down polling to save battery/server
const MIN_POLL_INTERVAL = 2_000;  // 2s — base rate (FCM handles instant delivery; poll is fallback)
const MAX_POLL_INTERVAL = 30_000; // 30s — idle ceiling
const BACKOFF_STEP = 5_000;       // +5s per consecutive empty response

export function usePendingRequests({
    enabled = true,
    pollInterval = MIN_POLL_INTERVAL,
}: UsePendingRequestsOptions = {}) {
    const [requests, setRequests] = useState<PendingRequest[]>([]);
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
    // Guard: prevent overlapping concurrent requests (e.g. from React StrictMode double-mount
    // or when VietMap API is slow and the next poll fires before the previous one finishes).
    const isFetchingRef = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    // Adaptive backoff: track current effective interval
    const currentIntervalRef = useRef(pollInterval);
    const consecutiveEmptyRef = useRef(0);

    const fetchRequests = useCallback(async () => {
        // Skip if a previous request is still in-flight
        if (isFetchingRef.current) return [];

        // Cancel any lingering previous request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        isFetchingRef.current = true;

        try {
            const response = await api.get<{ requests: PendingRequest[]; activeJobId: string | null }>(
                '/me/provider/pending-requests',
                { signal: abortControllerRef.current.signal },
            );
            const { requests: incoming, activeJobId: jobId } = response.data;
            setRequests(incoming);
            setActiveJobId(jobId);
            setError(null);

            // Adaptive backoff: reset to fast polling when requests are found
            if (incoming.length > 0) {
                consecutiveEmptyRef.current = 0;
                currentIntervalRef.current = pollInterval;
            } else {
                consecutiveEmptyRef.current += 1;
                currentIntervalRef.current = Math.min(
                    pollInterval + consecutiveEmptyRef.current * BACKOFF_STEP,
                    MAX_POLL_INTERVAL,
                );
            }

            return incoming;
        } catch (err: any) {
            if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
                // Request was aborted — not an error, just ignore
                return [];
            }
            console.error('Error fetching pending requests:', err);
            const errorMsg = err.response?.data?.message || 'Không thể tải requests';
            setError(errorMsg);
            return [];
        } finally {
            isFetchingRef.current = false;
            setIsLoading(false);
        }
    }, [pollInterval]);

    const stopPolling = useCallback(() => {
        if (pollIntervalRef.current) {
            clearTimeout(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
        // Cancel any in-flight request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        isFetchingRef.current = false;
        consecutiveEmptyRef.current = 0;
        currentIntervalRef.current = pollInterval;
    }, [pollInterval]);

    // Adaptive polling via recursive setTimeout so we can vary the delay after each response
    const scheduleNextPoll = useCallback(() => {
        pollIntervalRef.current = setTimeout(async () => {
            await fetchRequests();
            scheduleNextPoll(); // re-schedule with the latest (possibly backed-off) interval
        }, currentIntervalRef.current);
    }, [fetchRequests]);

    const startPolling = useCallback(() => {
        stopPolling();
        consecutiveEmptyRef.current = 0;
        currentIntervalRef.current = pollInterval;

        // Initial fetch then kick off the adaptive loop
        fetchRequests().then(() => scheduleNextPoll());
    }, [fetchRequests, pollInterval, stopPolling, scheduleNextPoll]);

    useEffect(() => {
        if (enabled) {
            // Reset backoff counters every time provider goes online so the first
            // poll after toggling online is always at the fastest interval (2s),
            // not a backed-off interval from a previous idle session.
            consecutiveEmptyRef.current = 0;
            currentIntervalRef.current = pollInterval;
            startPolling();
        } else {
            stopPolling();
            setRequests([]);
            setActiveJobId(null);
        }

        return () => {
            stopPolling();
        };
    }, [enabled, startPolling, stopPolling]);

    // Re-fetch immediately when the browser tab becomes visible again (e.g. provider switches tabs
    // then comes back). This makes the UX feel instant without relying solely on the poll interval.
    useEffect(() => {
        if (!enabled) return;

        const handleVisible = () => {
            if (document.visibilityState === 'visible') {
                // Reset backoff so next automatic poll is also fast
                consecutiveEmptyRef.current = 0;
                currentIntervalRef.current = pollInterval;
                fetchRequests();
            }
        };

        document.addEventListener('visibilitychange', handleVisible);
        window.addEventListener('focus', handleVisible);

        return () => {
            document.removeEventListener('visibilitychange', handleVisible);
            window.removeEventListener('focus', handleVisible);
        };
    }, [enabled, fetchRequests, pollInterval]);

    /**
     * @deprecated This function calls a deprecated endpoint that bypasses the quote system.
     * 
     * Instead of accepting requests directly, providers should:
     * 1. Navigate to the request detail page
     * 2. View full request details
     * 3. Submit a quote with their price
     * 4. Wait for user to accept the quote
     * 
     * The correct flow is: Provider views → Sends quote → User accepts → ASSIGNED
     * Not: Provider accepts → ASSIGNED (this bypasses price negotiation)
     */
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

    /**
     * @deprecated This function is no longer needed.
     * 
     * The modal now shows "Bỏ qua" (Skip) instead of "Từ chối" (Decline).
     * Providers can simply close the modal without making an API call.
     * The request remains visible to other providers.
     */
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
        activeJobId,
        isLoading,
        error,
        fetchRequests,
        acceptRequest,
        declineRequest,
        startPolling,
        stopPolling,
    };
}
