'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
    GuestSession,
    GuestAuthResponse,
    getStoredGuestToken,
    storeGuestToken,
    clearGuestToken,
    getStoredGuestSession,
    storeGuestSession,
    logoutGuest,
} from '@/lib/guest-auth';

interface GuestContextType {
    guestToken: string | null;
    guestSession: GuestSession | null;
    isGuest: boolean;
    loading: boolean;
    setGuestAuth: (response: GuestAuthResponse) => void;
    clearGuest: () => Promise<void>;
}

const GuestContext = createContext<GuestContextType | undefined>(undefined);

export const GuestProvider = ({ children }: { children: React.ReactNode }) => {
    const [guestToken, setGuestToken] = useState<string | null>(null);
    const [guestSession, setGuestSession] = useState<GuestSession | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = getStoredGuestToken();
        const session = getStoredGuestSession();

        if (token && session) {
            // Check if session is still valid
            if (new Date(session.expiresAt) > new Date()) {
                setGuestToken(token);
                setGuestSession(session);
            } else {
                clearGuestToken();
            }
        }
        setLoading(false);
    }, []);

    const setGuestAuth = useCallback((response: GuestAuthResponse) => {
        const session: GuestSession = {
            guestSessionId: response.guestSessionId,
            phone: response.phone,
            expiresAt: response.expiresAt,
        };
        storeGuestToken(response.accessToken);
        storeGuestSession(session);
        setGuestToken(response.accessToken);
        setGuestSession(session);
    }, []);

    const clearGuest = useCallback(async () => {
        await logoutGuest();
        clearGuestToken();
        setGuestToken(null);
        setGuestSession(null);
    }, []);

    return (
        <GuestContext.Provider
            value={{
                guestToken,
                guestSession,
                isGuest: !!guestToken && !!guestSession,
                loading,
                setGuestAuth,
                clearGuest,
            }}
        >
            {children}
        </GuestContext.Provider>
    );
};

export const useGuest = () => {
    const context = useContext(GuestContext);
    if (context === undefined) {
        throw new Error('useGuest must be used within a GuestProvider');
    }
    return context;
};
