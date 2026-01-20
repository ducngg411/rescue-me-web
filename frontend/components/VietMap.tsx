'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

const VIETMAP_API_KEY = '70791b5e522854f73ccb831a7f015bde93dfc4b58bd2d444';

interface VietMapProps {
    center: [number, number]; // [lng, lat]
    zoom?: number;
    className?: string;
    onLoad?: (map: any) => void;
    showMarker?: boolean;
    markerPosition?: [number, number]; // [lng, lat]
}

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
    const [isLoaded, setIsLoaded] = useState(false);

    const initMap = () => {
        if (!mapContainer.current || map.current || !window.vietmapgl) return;

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
    };

    useEffect(() => {
        if (isLoaded) {
            initMap();
        }

        // Cleanup
        return () => {
            if (marker.current) {
                marker.current.remove();
            }
            if (map.current) {
                map.current.remove();
            }
        };
    }, [isLoaded]);

    // Update marker position when prop changes
    useEffect(() => {
        if (marker.current && markerPosition) {
            marker.current.setLngLat(markerPosition);
        }
    }, [markerPosition]);

    // Update center when prop changes
    useEffect(() => {
        if (map.current && center) {
            map.current.flyTo({
                center: center,
                zoom: zoom,
                duration: 1000,
            });
        }
    }, [center, zoom]);

    return (
        <>
            <link
                href="https://unpkg.com/@vietmap/vietmap-gl-js@6.0.0/dist/vietmap-gl.css"
                rel="stylesheet"
            />
            <Script
                src="https://unpkg.com/@vietmap/vietmap-gl-js@6.0.0/dist/vietmap-gl.js"
                onLoad={() => setIsLoaded(true)}
            />
            <div
                ref={mapContainer}
                className={`vietmap-container ${className}`}
                style={{ width: '100%', height: '100%' }}
            />
        </>
    );
}
