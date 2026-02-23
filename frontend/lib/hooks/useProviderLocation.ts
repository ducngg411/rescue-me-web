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

    const updateLocationOnServer = useCallback(async (lat: number, lng: number) => {
        try {
            await api.patch('/me/provider/location', { lat, lng });
            console.log(`📍 Location updated on server: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        } catch (err: any) {
            console.error('Failed to update location on server:', err);
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

        // Request permission and get initial position
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

        // Watch position changes (for real-time tracking)
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

        // Setup periodic server updates
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
                    timeout: 5000,
                    maximumAge: 10000,
                }
            );
        }, updateInterval);

        console.log('📍 Started GPS tracking');
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

        console.log('📍 Stopped GPS tracking');
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
