'use client';

const VIETMAP_API_KEY = process.env.NEXT_PUBLIC_VIETMAP_API_KEY;

import { useEffect, useRef, useState } from 'react';

// Global flag to track if VietMap script is loaded
let isVietMapScriptLoaded = false;
let vietmapLoadPromise: Promise<void> | null = null;

interface VietMapProps {
    center: [number, number]; // [lng, lat]
    zoom?: number;
    className?: string;
    onLoad?: (map: any) => void;
    showMarker?: boolean;
    markerPosition?: [number, number]; // [lng, lat]
}

// Function to load VietMap script only once
const loadVietMapScript = (): Promise<void> => {
    // If already loaded, return resolved promise
    if (isVietMapScriptLoaded && window.vietmapgl) {
        return Promise.resolve();
    }

    // If currently loading, return existing promise
    if (vietmapLoadPromise) {
        return vietmapLoadPromise;
    }

    // Create new load promise
    vietmapLoadPromise = new Promise((resolve, reject) => {
        // Check if already exists
        if (window.vietmapgl) {
            isVietMapScriptLoaded = true;
            resolve();
            return;
        }

        // Load CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/@vietmap/vietmap-gl-js@6.0.0/dist/vietmap-gl.css';
        document.head.appendChild(link);

        // Load JS
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@vietmap/vietmap-gl-js@6.0.0/dist/vietmap-gl.js';
        script.async = true;
        script.onload = () => {
            isVietMapScriptLoaded = true;
            resolve();
        };
        script.onerror = () => {
            vietmapLoadPromise = null;
            reject(new Error('Failed to load VietMap script'));
        };
        document.head.appendChild(script);
    });

    return vietmapLoadPromise;
};

export default function VietMap({
    center,
    zoom = 15,
    className = '',
    onLoad,
    showMarker = true,
    markerPosition,
}: VietMapProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<any>(null);
    const marker = useRef<any>(null);
    const [isLoaded, setIsLoaded] = useState(isVietMapScriptLoaded);
    const [isInitialized, setIsInitialized] = useState(false);

    // Load VietMap script
    useEffect(() => {
        loadVietMapScript()
            .then(() => {
                setIsLoaded(true);
            })
            .catch((error) => {
                console.error('Failed to load VietMap:', error);
            });
    }, []);

    const initMap = () => {
        if (!mapContainer.current || !window.vietmapgl || isInitialized) return;

        // Clean up old map if exists
        if (map.current) {
            map.current.remove();
            map.current = null;
        }

        // Initialize map
        map.current = new window.vietmapgl.Map({
            container: mapContainer.current,
            style: `https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=${VIETMAP_API_KEY}`,
            center: center,
            zoom: zoom,
        });

        // Add navigation controls
        map.current.addControl(new window.vietmapgl.NavigationControl(), 'top-right');

        // Add marker if enabled
        if (showMarker) {
            const markerPos = markerPosition || center;

            // Create custom dot marker
            const dot = document.createElement('div');
            dot.style.width = '14px';
            dot.style.height = '14px';
            dot.style.backgroundColor = '#ff0000';
            dot.style.borderRadius = '50%';
            dot.style.border = '2px solid #ffffff';

            marker.current = new window.vietmapgl.Marker(dot)
                .setLngLat(markerPos)
                .addTo(map.current);
        }

        // Call onLoad callback when map is ready
        map.current.on('load', () => {
            if (onLoad) {
                onLoad(map.current);
            }
        });

        setIsInitialized(true);
    };

    // Initialize map when script is loaded
    useEffect(() => {
        if (isLoaded) {
            initMap();
        }

        // Cleanup
        return () => {
            try {
                if (marker.current) {
                    marker.current.remove();
                    marker.current = null;
                }
            } catch (error) {
                console.warn('Error removing marker:', error);
            }

            // Capture and null the ref immediately to prevent re-use
            const mapInstance = map.current;
            map.current = null;

            if (mapInstance) {
                // map.remove() aborts pending tile/style fetches internally.
                // Those fetch-promise rejections are async, so they escape a
                // synchronous try/catch and surface as unhandled rejections in
                // Next.js's dev overlay.  Suppress them for the brief window
                // while removal is in progress.
                const suppressAbort = (e: PromiseRejectionEvent) => {
                    if (e.reason?.name === 'AbortError') e.preventDefault();
                };
                window.addEventListener('unhandledrejection', suppressAbort);

                try {
                    mapInstance.remove();
                } catch (error: any) {
                    if (error?.name !== 'AbortError') {
                        console.warn('Error removing map:', error);
                    }
                } finally {
                    setTimeout(
                        () => window.removeEventListener('unhandledrejection', suppressAbort),
                        200,
                    );
                }
            }

            setIsInitialized(false);
        };
    }, [isLoaded]);

    // Update marker position when prop changes
    useEffect(() => {
        if (marker.current && markerPosition && isInitialized) {
            marker.current.setLngLat(markerPosition);
        }
    }, [markerPosition, isInitialized]);

    // Update center when prop changes
    useEffect(() => {
        if (map.current && center && isInitialized) {
            map.current.flyTo({
                center: center,
                zoom: zoom,
                duration: 1000,
            });
        }
    }, [center, zoom, isInitialized]);

    return (
        <div
            ref={mapContainer}
            className={`vietmap-container ${className}`}
            style={{ width: '100%', height: '100%' }}
        />
    );
}
