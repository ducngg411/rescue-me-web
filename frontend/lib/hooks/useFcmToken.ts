'use client';

import { useEffect, useRef } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { getFirebaseMessaging } from '@/lib/firebase';
import api from '@/lib/api';

interface UseFcmTokenOptions {
    /** Only request permission and register token when true (provider is online) */
    enabled: boolean;
    /** Called when a foreground FCM message is received — use to refresh request list */
    onNewRequest?: (requestId: string) => void;
}

/**
 * useFcmToken — registers an FCM push token with the backend and listens for
 * foreground messages. Background messages are handled by the service worker.
 */
export function useFcmToken({ enabled, onNewRequest }: UseFcmTokenOptions) {
    const registeredRef = useRef(false);
    const unsubscribeRef = useRef<(() => void) | null>(null);
    // Stable ref for onNewRequest so the effect doesn't re-run on every render
    const onNewRequestRef = useRef(onNewRequest);
    useEffect(() => { onNewRequestRef.current = onNewRequest; }, [onNewRequest]);

    useEffect(() => {
        if (!enabled) return;
        if (registeredRef.current) return; // already registered this session

        let cancelled = false;

        async function register() {
            // Read VAPID key at call time (not at module load) to avoid Next.js env caching issues
            const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
            if (!vapidKey || vapidKey === 'YOUR_VAPID_KEY_HERE') {
                console.warn('[FCM] VAPID key not configured — skipping FCM registration');
                return;
            }

            const messaging = getFirebaseMessaging();
            if (!messaging) {
                console.warn('[FCM] Messaging not supported in this environment');
                return;
            }

            // 1. Request notification permission
            const permission = await Notification.requestPermission();
            console.log('[FCM] Notification permission:', permission);
            if (permission !== 'granted') return;
            if (cancelled) return;

            // 2. Register service worker
            let swReg: ServiceWorkerRegistration | undefined;
            try {
                swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
                await navigator.serviceWorker.ready;
                console.log('[FCM] Service worker ready');
            } catch (err) {
                console.error('[FCM] Service worker registration failed:', err);
                return;
            }
            if (cancelled) return;

            // 3. Get FCM token
            let token: string;
            try {
                token = await getToken(messaging, {
                    vapidKey,
                    serviceWorkerRegistration: swReg,
                });
                console.log('[FCM] Token obtained:', token.slice(0, 20) + '...');
            } catch (err) {
                console.error('[FCM] getToken failed:', err);
                return;
            }
            if (cancelled) return;

            // 4. Send token to backend
            try {
                await api.patch('/me/provider/fcm-token', { fcmToken: token });
                registeredRef.current = true;
                console.log('[FCM] ✅ Token registered with backend — FCM active');
            } catch (err) {
                console.error('[FCM] Failed to register token with backend:', err);
                return;
            }

            // 5. Listen for foreground messages (tab is open + focused)
            // onMessage only fires when the page is in the foreground
            unsubscribeRef.current = onMessage(messaging, (payload) => {
                console.log('[FCM] 📨 Foreground message received:', payload);
                const data = payload.data ?? {};

                if (data.type === 'NEW_RESCUE_REQUEST') {
                    onNewRequestRef.current?.(data.requestId ?? '');

                    // Show browser notification even in foreground (requires granted permission)
                    if (Notification.permission === 'granted') {
                        new Notification(payload.notification?.title ?? '🚨 Yêu cầu cứu hộ mới', {
                            body: payload.notification?.body ?? '',
                            icon: '/RescueMe_Logo.svg',
                            tag: data.requestId ?? 'rescue-request',
                        });
                    }
                }
            });
        }

        register();

        return () => {
            cancelled = true;
        };
    // Only re-run if `enabled` changes — stable registration for the session
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled]);

    // Cleanup onUnmount
    useEffect(() => {
        return () => {
            unsubscribeRef.current?.();
            unsubscribeRef.current = null;
            registeredRef.current = false;
        };
    }, []);
}
