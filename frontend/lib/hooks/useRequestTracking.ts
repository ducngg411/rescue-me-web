import { useState, useEffect, useRef, useCallback } from 'react';
import api from '@/lib/api';

export interface RequestStatus {
    id: string;
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
    // Track latest status in a ref so countdown interval can read it without stale closure
    const statusRef = useRef<RequestStatus | null>(null);

    // Force backend to check and transition phases immediately
    const triggerExpireCheck = useCallback(async () => {
        if (expireCheckInProgress.current) return;

        try {
            expireCheckInProgress.current = true;
            console.log('🔔 [useRequestTracking] Triggering immediate expire check');

            // Call admin endpoint to force immediate phase transition
            await api.post('/rescue-requests/admin/expire-check');

            // Wait a bit for backend to process
            await new Promise(resolve => setTimeout(resolve, 500));

            // Refetch status to get updated phase
            await fetchStatus();
        } catch (err) {
            console.error('Error triggering expire check:', err);
        } finally {
            expireCheckInProgress.current = false;
        }
    }, []);

    const fetchStatus = useCallback(async () => {
        try {
            const response = await api.get(`/rescue-requests/${requestId}/status`);
            const newStatus = response.data;
            setStatus(newStatus);
            statusRef.current = newStatus; // keep ref in sync
            setError(null);

            // For MATCHING status, use quote window time remaining
            if (newStatus.status === 'MATCHING') {
                if (newStatus.quoteWindowTimeRemaining !== undefined) {
                    const remaining = newStatus.quoteWindowTimeRemaining;
                    setTimeRemaining(remaining);

                    // Quote window just closed (server says 0) — check if we have quotes
                    if (remaining <= 0) {
                        if ((newStatus.quoteCount ?? 0) > 0) {
                            // We have quotes → signal UI to show quote selection
                            setQuoteWindowJustClosed(true);
                            // Do NOT expire — let user choose a quote
                        } else {
                            // No quotes → trigger expire to show ExpiredRetry
                            triggerExpireCheck();
                        }
                    }
                } else {
                    // Fallback to phase expiration (for backward compatibility)
                    const expiresAt = new Date(newStatus.expiresAt);
                    const now = new Date();
                    const remaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
                    setTimeRemaining(remaining);

                    // INSTANT TRANSITION: When countdown hits 0, force backend to check immediately
                    if (remaining === 0) {
                        console.log('⏰ [useRequestTracking] Countdown reached 00:00, forcing transition...');
                        triggerExpireCheck();
                    }
                }
            } else {
                setTimeRemaining(0);
            }

            return newStatus;
        } catch (err: any) {
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
    }, []);

    const startPolling = useCallback(() => {
        stopPolling(); // Clear any existing intervals

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

        // Setup countdown timer (client-side countdown every second)
        countdownIntervalRef.current = setInterval(() => {
            setTimeRemaining(prev => {
                const newValue = Math.max(0, prev - 1);

                // When countdown hits 0, check if we have quotes before triggering expire
                if (newValue === 0 && prev > 0) {
                    const currentStatus = statusRef.current;
                    const quoteCount = currentStatus?.quoteCount ?? 0;

                    if (quoteCount > 0) {
                        // Has quotes → auto-show quote selection, skip expire
                        console.log(`💰 [Countdown] Reached 00:00 with ${quoteCount} quotes — switching to quote selection`);
                        setQuoteWindowJustClosed(true);
                    } else {
                        // No quotes → trigger expire as before
                        console.log('⏰ [Countdown] Reached 00:00, no quotes — triggering expire');
                        triggerExpireCheck();
                    }
                }

                return newValue;
            });
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
            await api.patch(`/rescue-requests/${requestId}/cancel`);
            await fetchStatus(); // Refresh status
            return true;
        } catch (err: any) {
            console.error('Error cancelling request:', err);
            setError(err.response?.data?.message || 'Failed to cancel request');
            return false;
        }
    };

    const retryRequest = async () => {
        try {
            const response = await api.post(`/rescue-requests/${requestId}/retry`);
            return response.data; // Return new request
        } catch (err: any) {
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
