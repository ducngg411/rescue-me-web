'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { LoginForm } from '@/components/auth/LoginForm';
import Link from 'next/link';

export default function LoginPage() {
    const router = useRouter();
    const { user, login, loginWithGoogle, loading } = useAuth();

    // Redirect if already logged in
    useEffect(() => {
        if (user && !loading) {
            console.log('Login page - user:', user);
            console.log('Login page - role:', user.role);
            // If no role selected, go to select-role page
            if (user.role === null) {
                console.log('Redirecting to /select-role');
                router.push('/select-role');
            } else if (!user.profileCompleted) {
                console.log('Redirecting to /complete-profile');
                router.push('/complete-profile');
            } else {
                console.log('Redirecting to /');
                router.push('/');
            }
        }
    }, [user, loading, router]);

    const handleLogin = async (email: string, password: string) => {
        await login(email, password);
        // Redirect will be handled by the useEffect above
    };

    const handleGoogleLogin = async () => {
        await loginWithGoogle();
        // Redirect will be handled by the useEffect above
    };

    if (loading && !user) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md mx-auto">
            <div className="bg-card p-8 rounded-lg shadow-lg">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
                    <p className="text-gray-600">Login to your RescueMe account</p>
                </div>

                <LoginForm onSubmit={handleLogin} onGoogleLogin={handleGoogleLogin} />

                <p className="mt-6 text-center text-sm text-gray-600">
                    Don't have an account?{' '}
                    <Link href="/register" className="text-primary font-medium hover:underline">
                        Create one now
                    </Link>
                </p>
            </div>
        </div>
    );
}
