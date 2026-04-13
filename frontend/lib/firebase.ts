import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, type Messaging } from 'firebase/messaging';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Prevent re-initializing during hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Use initializeFirestore with experimentalForceLongPolling to fix:
// - Firebase SDK 12.x "INTERNAL ASSERTION FAILED: Unexpected state (ca9)" bug
// - React StrictMode double-mount race condition on onSnapshot listeners
// Falls back to getFirestore if already initialized (hot reload safe)
let db: ReturnType<typeof getFirestore>;
try {
    db = initializeFirestore(app, {
        experimentalForceLongPolling: true,
    });
} catch {
    // Already initialized (hot reload) — just get existing instance
    db = getFirestore(app);
}

export { db };
export const auth = getAuth(app);
export default app;

/**
 * Returns a Firebase Messaging instance, or null in unsupported environments
 * (SSR, or browsers without service worker support).
 */
export function getFirebaseMessaging(): Messaging | null {
    if (typeof window === 'undefined') return null;
    if (!('serviceWorker' in navigator)) return null;
    try {
        return getMessaging(app);
    } catch {
        return null;
    }
}
