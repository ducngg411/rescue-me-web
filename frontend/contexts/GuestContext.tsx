'use client';

/**
 * GuestContext — Quản lý state phiên khách toàn app.
 *
 * Cung cấp:
 * - guestToken: JWT để đính vào Authorization header
 * - guestSession: metadata (guestSessionId, phone, expiresAt)
 * - isGuest: true khi cả hai trường trên đều tồn tại
 * - setGuestAuth: gọi sau khi verifyOtpAndCreateSession() thành công
 * - clearGuest: logout — gọi API backend rồi xóa localStorage
 *
 * Khởi tạo (useEffect): đọc lại từ localStorage khi app load,
 * tự động dọn dẹp nếu session đã hết hạn.
 */

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

    // Khôi phục session từ localStorage khi app khởi động
    useEffect(() => {
        const token = getStoredGuestToken();
        const session = getStoredGuestSession();

        if (token && session) {
            // Kiểm tra expiry ở client để tránh gọi API rồi mới biết session hết hạn
            if (new Date(session.expiresAt) > new Date()) {
                setGuestToken(token);
                setGuestSession(session);
            } else {
                clearGuestToken();
            }
        }
        setLoading(false);
    }, []);

    /** Lưu token và session vào cả localStorage lẫn React state sau khi xác minh OTP thành công. */
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

    /** Gọi API logout để vô hiệu hóa session trên server, sau đó xóa toàn bộ state và localStorage. */
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

/** Hook để dùng GuestContext trong component. Throw nếu dùng ngoài GuestProvider. */
export const useGuest = () => {
    const context = useContext(GuestContext);
    if (context === undefined) {
        throw new Error('useGuest must be used within a GuestProvider');
    }
    return context;
};
