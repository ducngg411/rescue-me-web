'use client';

import { useAuth as useAuthContext } from '@/contexts/AuthContext';

/**
 * Custom hook to access authentication context
 * Re-export from AuthContext for convenience
 */
export const useAuth = () => {
    return useAuthContext();
};

/**
 * Hook to check if user has specific role
 */
export const useRole = () => {
    const { user } = useAuthContext();

    return {
        isUser: user?.role === 'user',
        isProvider: user?.role === 'provider',
        isAdmin: user?.role === 'admin',
        role: user?.role,
    };
};

/**
 * Hook to require authentication
 * Redirects to login if not authenticated
 */
export const useRequireAuth = () => {
    const { user, loading } = useAuthContext();

    return {
        user,
        loading,
        isAuthenticated: !!user,
    };
};
