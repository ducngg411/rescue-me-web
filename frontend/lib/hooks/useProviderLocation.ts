import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';

interface LocationState {
    lat: number | null;
    lng: number | null;
    error: string | null;
    isTracking: boolean;
}

interface UseProviderLocationOptions {
    enabled: boolean; // Only track when provider is online
    updateInterval?: number; // milliseconds, default 30s
}

export function useProviderLocation({
    enabled,
    updateInterval = 30000, // 30 seconds
}: UseProviderLocationOptions) {
    const [location, setLocation] = useState<LocationState>({
        lat: null,
        lng: null,
        error: null,
        isTracking: false,
    });

    const watchIdRef = useRef<number | null>(null);
    const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
    // Guard: prevents concurrent PATCH /location calls (React StrictMode double-mount,
    // or initial getCurrentPosition racing with the first interval tick).
    const isSendingRef = useRef(false);

    const updateLocationOnServer = useCallback(async (lat: number, lng: number) => {
        if (isSendingRef.current) return; // already in-flight, skip
        isSendingRef.current = true;
        try {
            await api.patch('/me/provider/location', { lat, lng });
        } catch (err: any) {
            // silently ignore — location update is best-effort
        } finally {
            isSendingRef.current = false;
        }
    }, []);

    const startTracking = useCallback(() => {
        if (!('geolocation' in navigator)) {
            setLocation(prev => ({
                ...prev,
                error: 'Trình duyệt không hỗ trợ GPS',
                isTracking: false,
            }));
            return;
        }

        // Request permission and get initial position + send to server immediately
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setLocation({
                    lat: latitude,
                    lng: longitude,
                    error: null,
                    isTracking: true,
                });

                // Send initial location to server
                updateLocationOnServer(latitude, longitude);
            },
            (error) => {
                let errorMessage = 'Không thể lấy vị trí';
                if (error.code === error.PERMISSION_DENIED) {
                    errorMessage = 'Vui lòng cho phép truy cập vị trí để nhận requests';
                } else if (error.code === error.POSITION_UNAVAILABLE) {
                    errorMessage = 'Không thể xác định vị trí';
                } else if (error.code === error.TIMEOUT) {
                    errorMessage = 'Yêu cầu vị trí hết thời gian chờ';
                }
                setLocation(prev => ({
                    ...prev,
                    error: errorMessage,
                    isTracking: false,
                }));
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
            }
        );

        // Watch position changes — only updates LOCAL UI state, NOT the server.
        // Server updates happen exclusively via the setInterval below to avoid
        // concurrent requests that cause ERR_HTTP_HEADERS_SENT.
        watchIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setLocation(prev => ({
                    ...prev,
                    lat: latitude,
                    lng: longitude,
                    error: null,
                    isTracking: true,
                }));
            },
            (error) => {
                console.error('Geolocation watch error:', error);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 30000, // 30 seconds
                timeout: 27000,
            }
        );

        // Periodic server updates — the ONLY place we send location to the server
        // after the initial push above. This prevents concurrent requests.
        updateIntervalRef.current = setInterval(() => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    updateLocationOnServer(latitude, longitude);
                },
                (error) => {
                    console.error('Failed to get position for update:', error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 15000,   // increased from 5s – browser geolocation needs more time on desktop
                    maximumAge: 30000, // reuse cached position up to 30s old
                }
            );
        }, updateInterval);

    }, [updateInterval, updateLocationOnServer]);

    const stopTracking = useCallback(() => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }

        if (updateIntervalRef.current !== null) {
            clearInterval(updateIntervalRef.current);
            updateIntervalRef.current = null;
        }

        setLocation({
            lat: null,
            lng: null,
            error: null,
            isTracking: false,
        });

    }, []);

    useEffect(() => {
        if (enabled) {
            startTracking();
        } else {
            stopTracking();
        }

        return () => {
            stopTracking();
        };
    }, [enabled, startTracking, stopTracking]);

    return {
        location,
        startTracking,
        stopTracking,
    };
}
