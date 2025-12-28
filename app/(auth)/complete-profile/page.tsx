'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function CompleteProfilePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        // Add profile completion logic here
        setLoading(false);
    };

    return (
        <div className="bg-card p-8 rounded-lg shadow-lg">
            <h1 className="text-2xl font-bold mb-6 text-center">Complete Your Profile</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-2">Phone Number</label>
                    <input
                        type="tel"
                        className="w-full px-4 py-2 border rounded-md"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-2">Address</label>
                    <input
                        type="text"
                        className="w-full px-4 py-2 border rounded-md"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-2">City</label>
                    <input
                        type="text"
                        className="w-full px-4 py-2 border rounded-md"
                        required
                    />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Saving...' : 'Complete Profile'}
                </Button>
            </form>
        </div>
    );
}
