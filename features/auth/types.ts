export interface User {
    uid: string;
    email: string | null;
    displayName: string | null;
    role: 'user' | 'provider' | 'admin';
    profileCompleted: boolean;
    photoURL?: string | null;
    createdAt?: any;
    updatedAt?: any;
}

export interface AuthState {
    user: User | null;
    loading: boolean;
    error: string | null;
}
