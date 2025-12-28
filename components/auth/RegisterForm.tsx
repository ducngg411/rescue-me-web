'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface RegisterFormProps {
    onSubmit: (data: RegisterData) => Promise<void>;
}

interface RegisterData {
    name: string;
    email: string;
    password: string;
    userType: 'user' | 'provider';
}

export function RegisterForm({ onSubmit }: RegisterFormProps) {
    const [formData, setFormData] = useState<RegisterData>({
        name: '',
        email: '',
        password: '',
        userType: 'user',
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSubmit(formData);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium mb-2">Full Name</label>
                <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border rounded-md"
                    required
                />
            </div>
            <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border rounded-md"
                    required
                />
            </div>
            <div>
                <label className="block text-sm font-medium mb-2">Password</label>
                <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 border rounded-md"
                    required
                />
            </div>
            <div>
                <label className="block text-sm font-medium mb-2">User Type</label>
                <select
                    value={formData.userType}
                    onChange={(e) => setFormData({ ...formData, userType: e.target.value as 'user' | 'provider' })}
                    className="w-full px-4 py-2 border rounded-md"
                    required
                >
                    <option value="user">User</option>
                    <option value="provider">Provider</option>
                </select>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating account...' : 'Register'}
            </Button>
        </form>
    );
}
