'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function RegisterPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        // Add registration logic here
        setLoading(false);
    };

    return (
        <div className="bg-card p-8 rounded-lg shadow-lg">
            <h1 className="text-2xl font-bold mb-6 text-center">Create Account</h1>
            <form onSubmit={handleRegister} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-2">Full Name</label>
                    <input
                        type="text"
                        className="w-full px-4 py-2 border rounded-md"
                        required
                    />
                </div>
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
                <div>
                    <label className="block text-sm font-medium mb-2">User Type</label>
                    <select className="w-full px-4 py-2 border rounded-md" required>
                        <option value="">Select...</option>
                        <option value="user">User</option>
                        <option value="provider">Provider</option>
                    </select>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Creating account...' : 'Register'}
                </Button>
            </form>
            <p className="mt-4 text-center text-sm">
                Already have an account?{' '}
                <a href="/login" className="text-primary hover:underline">
                    Login
                </a>
            </p>
        </div>
    );
}
