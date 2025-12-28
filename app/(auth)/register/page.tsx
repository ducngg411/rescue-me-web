'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { RegisterForm, RegisterData } from '@/components/auth/RegisterForm';
import Link from 'next/link';

export default function RegisterPage() {
    const router = useRouter();
    const { user, register, loginWithGoogle, loading } = useAuth();

    // Redirect if already logged in
    useEffect(() => {
        if (user && !loading) {
            if (!user.profileCompleted) {
                router.push('/complete-profile');
            } else {
                router.push('/');
            }
        }
    }, [user, loading, router]);

    const handleRegister = async (data: RegisterData) => {
        await register(data.email, data.password, data.displayName, data.role);
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
                    <h1 className="text-3xl font-bold mb-2">Join RescueMe</h1>
                    <p className="text-gray-600">Create your account to get started</p>
                </div>

                <RegisterForm onSubmit={handleRegister} onGoogleLogin={handleGoogleLogin} />

                <p className="mt-6 text-center text-sm text-gray-600">
                    Already have an account?{' '}
                    <Link href="/login" className="text-primary font-medium hover:underline">
                        Login here
                    </Link>
                </p>

                <p className="mt-4 text-center text-xs text-gray-500">
                    By creating an account, you agree to our{' '}
                    <Link href="/terms" className="text-primary hover:underline">
                        Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link href="/privacy" className="text-primary hover:underline">
                        Privacy Policy
                    </Link>
                </p>
            </div>
        </div>
    );
}
