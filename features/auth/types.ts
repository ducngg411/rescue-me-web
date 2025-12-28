export interface User {
    uid: string;
    email: string;
    displayName: string;
    role: 'user' | 'provider';
    profileCompleted: boolean;
}

export interface AuthState {
    user: User | null;
    loading: boolean;
    error: string | null;
}
