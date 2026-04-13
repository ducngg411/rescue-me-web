// Firebase Cloud Messaging Service Worker
// Required for background push notifications (when app tab is closed / not focused)
// This file MUST be at /public/firebase-messaging-sw.js (served as /firebase-messaging-sw.js)

importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: 'AIzaSyCc1N765LY5JBFXLzpuERJ5zkM65bBJI64',
    authDomain: 'rescue-me-web.firebaseapp.com',
    projectId: 'rescue-me-web',
    storageBucket: 'rescue-me-web.firebasestorage.app',
    messagingSenderId: '1001827050744',
    appId: '1:1001827050744:web:8d3417180dcb5ef69b870d',
});

const messaging = firebase.messaging();

// Handle background messages — shows native OS notification when the app is not in foreground
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background message received:', payload);

    const { title, body } = payload.notification ?? {};
    const data = payload.data ?? {};

    self.registration.showNotification(title ?? '🚨 Yêu cầu cứu hộ mới', {
        body: body ?? 'Có yêu cầu mới gần bạn',
        icon: '/RescueMe_Logo.svg',
        badge: '/RescueMe_Logo.svg',
        tag: data.requestId ?? 'rescue-request',     // collapse duplicate notifications
        requireInteraction: true,                     // stays visible until user interacts
        vibrate: [200, 100, 200],
        data: {
            url: data.url ?? '/provider/active',
            requestId: data.requestId,
        },
    });
});

// When user taps the notification → navigate to the request detail page
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const url = event.notification.data?.url ?? '/provider/active';
    const fullUrl = self.location.origin + url;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // If app is already open in a tab, focus it and navigate
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.focus();
                    client.navigate(fullUrl);
                    return;
                }
            }
            // App is closed — open a new window
            if (clients.openWindow) {
                return clients.openWindow(fullUrl);
            }
        })
    );
});
