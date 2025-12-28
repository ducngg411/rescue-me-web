'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        // Add login logic here
        setLoading(false);
    };

    return (
        <div className="bg-card p-8 rounded-lg shadow-lg">
            <h1 className="text-2xl font-bold mb-6 text-center">Login to RescueMe</h1>
            <form onSubmit={handleLogin} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-2">Email</label>
                    <input
                        type="email"
                        className="w-full px-4 py-2 border rounded-md"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-2">Password</label>
                    <input
                        type="password"
                        className="w-full px-4 py-2 border rounded-md"
                        required
                    />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Logging in...' : 'Login'}
                </Button>
            </form>
            <p className="mt-4 text-center text-sm">
                Don't have an account?{' '}
                <a href="/register" className="text-primary hover:underline">
                    Register
                </a>
            </p>
        </div>
    );
}
