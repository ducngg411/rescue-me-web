'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { SelectRoleForm } from '@/components/auth/SelectRoleForm';

export default function SelectRolePage() {
    const router = useRouter();
    const { user, updateUserRole, loading } = useAuth();

    console.log('SelectRolePage - user:', user);
    console.log('SelectRolePage - loading:', loading);
    console.log('SelectRolePage - role:', user?.role);

    // Redirect if not logged in
    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
            return;
        }
        // Redirect if role already selected
        if (user && user.role !== null) {
            if (!user.profileCompleted) {
                router.push('/complete-profile');
            } else {
                router.push('/');
            }
        }
    }, [user, loading, router]);

    const handleRoleSubmit = async (role: 'user' | 'provider') => {
        await updateUserRole(role);
        // Check if profile needs to be completed
        if (user && !user.profileCompleted) {
            router.push('/complete-profile');
        } else {
            router.push('/');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    // Don't render if no user or if role is already selected
    if (!user || user.role !== null) {
        return null;
    }

    return (
        <div className="w-full max-w-md mx-auto">
            <div className="bg-card p-8 rounded-lg shadow-lg">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2">Choose Your Role</h1>
                    <p className="text-gray-600">
                        Let us know how you'll be using RescueMe
                    </p>
                </div>

                <SelectRoleForm onSubmit={handleRoleSubmit} />
            </div>
        </div>
    );
}
