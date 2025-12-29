'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export function Navbar() {
    const { user, logout, loading } = useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        try {
            await logout();
            router.push('/');
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const getRoleBadge = (role: string) => {
        const badges = {
            admin: 'bg-red-500 text-white',
            provider: 'bg-blue-500 text-white',
            user: 'bg-green-500 text-white',
        };
        return badges[role as keyof typeof badges] || badges.user;
    };

    return (
        <nav className="border-b bg-background sticky top-0 z-50 backdrop-blur-sm bg-background/95">
            <div className="container mx-auto px-4 py-4 flex justify-between items-center">
                <Link href="/" className="text-xl font-bold hover:text-primary transition-colors">
                    RescueMe
                </Link>

                <div className="flex items-center gap-4">
                    {loading ? (
                        <div className="animate-pulse h-10 w-24 bg-gray-200 rounded"></div>
                    ) : user ? (
                        <>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-medium hidden sm:inline">
                                    {user.displayName || user.email}
                                </span>
                                {user.role && (
                                    <span className={`text-xs px-2 py-1 rounded-full ${getRoleBadge(user.role)}`}>
                                        {user.role.toUpperCase()}
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                {user.role === 'admin' && (
                                    <Link href="/admin">
                                        <Button variant="outline" size="sm">
                                            Admin Panel
                                        </Button>
                                    </Link>
                                )}
                                {user.role === 'provider' && (
                                    <Link href="/provider/dashboard">
                                        <Button variant="outline" size="sm">
                                            Dashboard
                                        </Button>
                                    </Link>
                                )}
                                <Link href="/profile">
                                    <Button variant="outline" size="sm">
                                        Profile
                                    </Button>
                                </Link>
                                <Button onClick={handleLogout} variant="destructive" size="sm">
                                    Logout
                                </Button>
                            </div>
                        </>
                    ) : (
                        <div className="flex gap-2">
                            <Link href="/login">
                                <Button variant="outline" size="sm">
                                    Login
                                </Button>
                            </Link>
                            <Link href="/register">
                                <Button size="sm">
                                    Sign Up
                                </Button>
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}

