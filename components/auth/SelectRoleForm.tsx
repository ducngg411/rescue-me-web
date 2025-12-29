'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface SelectRoleFormProps {
    onSubmit: (role: 'user' | 'provider') => Promise<void>;
}

export function SelectRoleForm({ onSubmit }: SelectRoleFormProps) {
    const [selectedRole, setSelectedRole] = useState<'user' | 'provider' | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!selectedRole) {
            setError('Please select a role');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await onSubmit(selectedRole);
        } catch (err: any) {
            setError(err.message || 'Failed to update role');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {error && (
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-md text-sm">
                    {error}
                </div>
            )}

            <div className="space-y-4">
                <button
                    type="button"
                    onClick={() => setSelectedRole('user')}
                    disabled={loading}
                    className={`w-full p-6 border-2 rounded-lg text-left transition-all ${selectedRole === 'user'
                            ? 'border-primary bg-primary/5'
                            : 'border-gray-200 hover:border-gray-300'
                        } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                    <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0 mt-1">
                            <div
                                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedRole === 'user'
                                        ? 'border-primary'
                                        : 'border-gray-300'
                                    }`}
                            >
                                {selectedRole === 'user' && (
                                    <div className="w-3 h-3 bg-primary rounded-full"></div>
                                )}
                            </div>
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg mb-1">I Need Help</h3>
                            <p className="text-gray-600 text-sm">
                                Request rescue and emergency services when you need assistance
                            </p>
                        </div>
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => setSelectedRole('provider')}
                    disabled={loading}
                    className={`w-full p-6 border-2 rounded-lg text-left transition-all ${selectedRole === 'provider'
                            ? 'border-primary bg-primary/5'
                            : 'border-gray-200 hover:border-gray-300'
                        } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                    <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0 mt-1">
                            <div
                                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedRole === 'provider'
                                        ? 'border-primary'
                                        : 'border-gray-300'
                                    }`}
                            >
                                {selectedRole === 'provider' && (
                                    <div className="w-3 h-3 bg-primary rounded-full"></div>
                                )}
                            </div>
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg mb-1">I Provide Help</h3>
                            <p className="text-gray-600 text-sm">
                                Offer rescue and emergency services to help people in need
                            </p>
                        </div>
                    </div>
                </button>
            </div>

            <Button
                onClick={handleSubmit}
                className="w-full"
                disabled={!selectedRole || loading}
            >
                {loading ? 'Saving...' : 'Continue'}
            </Button>
        </div>
    );
}
