import { auth } from '@/lib/firebase';
import {
    signInWithPhoneNumber,
    RecaptchaVerifier,
    ConfirmationResult,
} from 'firebase/auth';
import api from '@/lib/api';

export interface GuestSession {
    guestSessionId: string;
    phone: string;
    expiresAt: string;
}

export interface GuestAuthResponse {
    accessToken: string;
    expiresAt: string;
    guestSessionId: string;
    phone: string;
}

let recaptchaVerifier: RecaptchaVerifier | null = null;

export function getRecaptchaVerifier(containerId: string): RecaptchaVerifier {
    if (recaptchaVerifier) {
        return recaptchaVerifier;
    }
    recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
        size: 'invisible',
        callback: () => {},
    });
    return recaptchaVerifier;
}

export function clearRecaptchaVerifier() {
    if (recaptchaVerifier) {
        recaptchaVerifier.clear();
        recaptchaVerifier = null;
    }
}

export async function sendPhoneOtp(
    phone: string,
    recaptchaContainerId: string,
): Promise<ConfirmationResult> {
    const verifier = getRecaptchaVerifier(recaptchaContainerId);
    const formattedPhone = formatPhoneForFirebase(phone);
    return signInWithPhoneNumber(auth, formattedPhone, verifier);
}

export async function verifyOtpAndCreateSession(
    confirmationResult: ConfirmationResult,
    code: string,
    deviceId?: string,
): Promise<GuestAuthResponse> {
    const credential = await confirmationResult.confirm(code);
    const firebaseIdToken = await credential.user.getIdToken();

    const response = await api.post<GuestAuthResponse>('/guest/auth/verify-phone', {
        firebaseIdToken,
        deviceId,
    });

    return response.data;
}

export async function refreshGuestToken(): Promise<GuestAuthResponse | null> {
    try {
        const response = await api.post<GuestAuthResponse>('/guest/auth/refresh');
        return response.data;
    } catch {
        return null;
    }
}

export async function logoutGuest(): Promise<void> {
    try {
        await api.delete('/guest/auth/logout');
    } catch {
        // ignore errors on logout
    }
}

export async function convertGuestToUser(userAccessToken: string): Promise<{ message: string; userId: string }> {
    const response = await api.post('/guest/auth/convert', { userAccessToken });
    return response.data;
}

function formatPhoneForFirebase(phone: string): string {
    const cleaned = phone.replace(/\s+/g, '');
    if (cleaned.startsWith('0') && !cleaned.startsWith('+')) {
        return '+84' + cleaned.slice(1);
    }
    if (!cleaned.startsWith('+')) {
        return '+84' + cleaned;
    }
    return cleaned;
}

export function getStoredGuestToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('guestAccessToken');
}

export function storeGuestToken(token: string) {
    localStorage.setItem('guestAccessToken', token);
}

export function clearGuestToken() {
    localStorage.removeItem('guestAccessToken');
    localStorage.removeItem('guestSession');
}

export function getStoredGuestSession(): GuestSession | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem('guestSession');
        if (!raw) return null;
        return JSON.parse(raw) as GuestSession;
    } catch {
        return null;
    }
}

export function storeGuestSession(session: GuestSession) {
    localStorage.setItem('guestSession', JSON.stringify(session));
}
