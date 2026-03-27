import { useState, useEffect, useRef, useCallback } from 'react';
import api from '@/lib/api';
import { matchingQuoteWindowSecondsRemaining } from '@/lib/matchingQuoteWindowCountdown';

export interface RequestStatus {
    id: string;
    orderCode?: string | null;
    status: string;
    createdAt: string;
    incidentType?: string;
    pickupLocation?: { addressText: string; lat: number; lng: number } | null;
    matchingStartedAt: string | null;
    assignedAt: string | null;
    expiresAt: string | null;
    matchAttempts: number;
    searchPhase?: number;
    matchedDistance?: number;
    matchedEta?: number;
    viewingProvidersCount?: number;
    quoteCount?: number;
    maxQuotes?: number;
    quoteWindowOpen?: boolean;
    quoteWindowTimeRemaining?: number;
    quoteWindowExpiresAt?: string | null;
    quoteWindowClosedAt?: string | null;
    assignedProvider?: {
        id: string;
        name: string | null;
        serviceName: string | null;
        serviceTypes: string[];
        phoneNumber: string | null;
        pricePerKm: number | null;
        baseFee: number | null;
        isOnline: boolean;
        averageRating: number | null;
        reviewCount: number;
    };
}

interface UseRequestTrackingOptions {
    requestId: string;
    enabled?: boolean;
    pollInterval?: number; // milliseconds
}

export function useRequestTracking({
    requestId,
    enabled = true,
    pollInterval = 3000 // 3 seconds
}: UseRequestTrackingOptions) {
    const [status, setStatus] = useState<RequestStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeRemaining, setTimeRemaining] = useState<number>(0);
    const [quoteWindowJustClosed, setQuoteWindowJustClosed] = useState(false);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const expireCheckInProgress = useRef<boolean>(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    // Track latest status in a ref so countdown interval can read it without stale closure
    const statusRef = useRef<RequestStatus | null>(null);
    const prevCountdownSecRef = useRef<number | null>(null);

    // Force backend to check and transition phases immediately
    const triggerExpireCheck = useCallback(async () => {
        if (expireCheckInProgress.current) return;

        try {
            expireCheckInProgress.current = true;
            console.log(' [useRequestTracking] Triggering immediate expire check');

            await api.post('/rescue-requests/admin/expire-check', undefined, {
                signal: abortControllerRef.current?.signal,
            });

            await new Promise(resolve => setTimeout(resolve, 500));

            await fetchStatus();
        } catch (err: any) {
            if (err?.code !== 'ERR_CANCELED') {
                console.error('Error triggering expire check:', err);
            }
        } finally {
            expireCheckInProgress.current = false;
        }
    }, []);

    const fetchStatus = useCallback(async () => {
        try {
            const response = await api.get(`/rescue-requests/${requestId}/status`, {
                signal: abortControllerRef.current?.signal,
            });
            const newStatus = response.data;
            setStatus(newStatus);
            statusRef.current = newStatus; // keep ref in sync
            setError(null);

            // For MATCHING status, derive remaining from server deadlines (stays in sync across clients)
            if (newStatus.status === 'MATCHING') {
                const remaining = matchingQuoteWindowSecondsRemaining(newStatus);
                setTimeRemaining(remaining);
                prevCountdownSecRef.current = remaining;

                if (remaining <= 0) {
                    if ((newStatus.quoteCount ?? 0) > 0) {
                        setQuoteWindowJustClosed(true);
                    } else {
                        triggerExpireCheck();
                    }
                }
            } else {
                setTimeRemaining(0);
                prevCountdownSecRef.current = 0;
            }

            return newStatus;
        } catch (err: any) {
            if (err?.code === 'ERR_CANCELED') return;
            console.error('Error fetching request status:', err);
            setError(err.response?.data?.message || 'Failed to fetch status');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [requestId, triggerExpireCheck]);

    const stopPolling = useCallback(() => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
    }, []);

    const startPolling = useCallback(() => {
        stopPolling(); // Clear any existing intervals
        abortControllerRef.current = new AbortController();

        // Initial fetch
        fetchStatus();

        // Setup polling
        pollIntervalRef.current = setInterval(async () => {
            const newStatus = await fetchStatus();

            // Stop polling only for terminal states (not during active ride)
            if (newStatus && !['MATCHING', 'CREATED', 'ASSIGNED', 'IN_PROGRESS', 'ARRIVED', 'WORKING', 'PAYMENT_PENDING', 'PAID'].includes(newStatus.status)) {
                stopPolling();
            }
        }, pollInterval);

        // Countdown every second from server deadline (not local decrement — avoids drift vs guest/provider)
        countdownIntervalRef.current = setInterval(() => {
            const s = statusRef.current;
            const sec = matchingQuoteWindowSecondsRemaining(s);
            setTimeRemaining(sec);

            const prev = prevCountdownSecRef.current;
            prevCountdownSecRef.current = sec;

            if (s?.status === 'MATCHING' && sec === 0 && prev !== null && prev > 0) {
                const quoteCount = s.quoteCount ?? 0;
                if (quoteCount > 0) {
                    console.log(`💰 [Countdown] Reached 00:00 with ${quoteCount} quotes — switching to quote selection`);
                    setQuoteWindowJustClosed(true);
                } else {
                    console.log('⏰ [Countdown] Reached 00:00, no quotes — triggering expire');
                    triggerExpireCheck();
                }
            }
        }, 1000);
    }, [fetchStatus, pollInterval, stopPolling, triggerExpireCheck]);

    useEffect(() => {
        if (enabled && requestId) {
            startPolling();
        }

        return () => {
            stopPolling();
        };
    }, [enabled, requestId, startPolling, stopPolling]);

    const cancelRequest = async () => {
        try {
            await api.patch(`/rescue-requests/${requestId}/cancel`, undefined, {
                signal: abortControllerRef.current?.signal,
            });
            await fetchStatus();
            return true;
        } catch (err: any) {
            if (err?.code === 'ERR_CANCELED') return false;
            console.error('Error cancelling request:', err);
            setError(err.response?.data?.message || 'Failed to cancel request');
            return false;
        }
    };

    const retryRequest = async () => {
        try {
            const response = await api.post(`/rescue-requests/${requestId}/retry`, undefined, {
                signal: abortControllerRef.current?.signal,
            });
            return response.data;
        } catch (err: any) {
            if (err?.code === 'ERR_CANCELED') throw err;
            console.error('Error retrying request:', err);
            setError(err.response?.data?.message || 'Failed to retry request');
            throw err;
        }
    };

    return {
        status,
        isLoading,
        error,
        timeRemaining,
        quoteWindowJustClosed,
        refresh: fetchStatus,
        cancelRequest,
        retryRequest,
    };
}
