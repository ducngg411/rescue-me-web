'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook to protect routes that require authentication and profile completion
 * 
 * Usage:
 * ```tsx
 * export default function ProtectedPage() {
 *   const { isReady } = useAuthGuard();
 *   
 *   if (!isReady) return <Loading />;
 *   
 *   return <YourComponent />;
 * }
 * ```
 */
export function useAuthGuard(options?: {
    requireAuth?: boolean;
    requireProfileCompleted?: boolean;
    redirectTo?: string;
}) {
    const {
        requireAuth = true,
        requireProfileCompleted = false,
        redirectTo,
    } = options || {};

    const router = useRouter();
    const { user, loading } = useAuth();

    useEffect(() => {
        if (loading) return;

        // Check authentication
        if (requireAuth && !user) {
            router.push(redirectTo || '/auth/login');
            return;
        }

        // Check profile completion
        if (requireProfileCompleted && user && !user.profileCompleted) {
            router.push('/onboarding/role');
            return;
        }
    }, [user, loading, requireAuth, requireProfileCompleted, redirectTo, router]);

    return {
        user,
        loading,
        isReady: !loading && (!requireAuth || !!user),
    };
}

/**
 * Hook to redirect users who haven't completed onboarding
 * 
 * Usage in app layout or protected pages:
 * ```tsx
 * useOnboardingGuard();
 * ```
 */
export function useOnboardingGuard() {
    const router = useRouter();
    const { user, loading } = useAuth();

    useEffect(() => {
        if (loading || !user) return;

        // If user is authenticated but hasn't completed profile, send to onboarding
        if (!user.profileCompleted) {
            router.push('/onboarding/role');
        }
    }, [user, loading, router]);
}

/**
 * Component wrapper for protected routes
 * 
 * Usage:
 * ```tsx
 * <ProtectedRoute requireProfileCompleted>
 *   <YourComponent />
 * </ProtectedRoute>
 * ```
 */
export function ProtectedRoute({
    children,
    requireAuth = true,
    requireProfileCompleted = false,
    loadingComponent,
}: {
    children: React.ReactNode;
    requireAuth?: boolean;
    requireProfileCompleted?: boolean;
    loadingComponent?: React.ReactNode;
}) {
    const { isReady, loading } = useAuthGuard({
        requireAuth,
        requireProfileCompleted,
    });

    if (loading || !isReady) {
        return loadingComponent || (
            <div className="min-h-screen flex items-center justify-center" >
                <div className="text-center" >
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" > </div>
                        < p className = "mt-4 text-gray-600" > Đang tải...</p>
                            </div>
                            </div>
        );
    }

    return <>{ children } </>;
}
