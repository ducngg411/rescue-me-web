import api from './api';
import { jwtDecode } from 'jwt-decode';

export interface User {
    id: string;
    email: string;
    name: string | null;
    fullName?: string | null;
    avatar: string | null;
    role: string;
    authProvider: string;
    profileCompleted: boolean;
    phoneNumber?: string | null;
    vehicleType?: 'CAR' | 'MOTORCYCLE' | null;
    licensePlate?: string | null;
    vehicleColor?: string | null;
    verificationStatus?: string;
    isOnline?: boolean;
    averageRating?: number | null;
    reviewCount?: number;
    rescueVehicles?: any[];
}

export interface AuthResponse {
    user: User;
    tokens: {
        accessToken: string;
        refreshToken: string;
    };
    requiresProfileCompletion: boolean;
}

// ==================== EMAIL REGISTRATION ====================
export const registerWithEmail = async (email: string, password: string, name?: string): Promise<AuthResponse> => {
    const response = await api.post('/auth/register/email', { email, password, name });

    // Store tokens
    localStorage.setItem('accessToken', response.data.tokens.accessToken);
    localStorage.setItem('refreshToken', response.data.tokens.refreshToken);

    return response.data;
};

// ==================== EMAIL LOGIN ====================
export const loginWithEmail = async (email: string, password: string): Promise<AuthResponse> => {
    const response = await api.post('/auth/login/email', { email, password });

    // Store tokens
    localStorage.setItem('accessToken', response.data.tokens.accessToken);
    localStorage.setItem('refreshToken', response.data.tokens.refreshToken);

    return response.data;
};

// ==================== GOOGLE LOGIN ====================
export const loginWithGoogle = async (idToken: string): Promise<AuthResponse> => {
    const response = await api.post('/auth/login/google', { idToken });

    // Store tokens
    localStorage.setItem('accessToken', response.data.tokens.accessToken);
    localStorage.setItem('refreshToken', response.data.tokens.refreshToken);

    return response.data;
};

// ==================== PROFILE COMPLETION ====================
export const selectRole = async (role: 'USER' | 'PROVIDER'): Promise<User> => {
    const response = await api.post('/auth/profile/select-role', { role });
    return response.data.user;
};

export interface UpdateUserProfileData {
    fullName: string;
    phoneNumber: string;
    contactEmail?: string;
    defaultAddress?: {
        addressText: string;
        lat: number;
        lng: number;
    };
    vehicleType: 'CAR' | 'MOTORCYCLE';
    licensePlate: string;
    vehicleColor: string;
}

export const updateUserProfile = async (data: UpdateUserProfileData): Promise<User> => {
    const response = await api.put('/me/profile', data);
    return response.data;
};

export const completeProfile = async (data: {
    name: string;
    phone: string;
    address: string;
    emergencyContact: string;
}): Promise<User> => {
    const response = await api.post('/auth/profile/complete', data);
    return response.data;
};

// ==================== GET CURRENT USER ====================
export const getCurrentUser = async (): Promise<User> => {
    const response = await api.get('/auth/me');
    return response.data;
};

// ==================== LOGOUT ====================
export const logout = async (): Promise<void> => {
    try {
        await api.post('/auth/logout');
    } finally {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
    }
};

// ==================== TOKEN VALIDATION ====================
export const isTokenValid = (token: string): boolean => {
    try {
        const decoded: any = jwtDecode(token);
        return decoded.exp * 1000 > Date.now();
    } catch {
        return false;
    }
};

/** Trả về true nếu accessToken hết hạn trong vòng 60 giây tới */
export const isTokenExpiringSoon = (token: string, bufferMs = 60_000): boolean => {
    try {
        const decoded: any = jwtDecode(token);
        return decoded.exp * 1000 - Date.now() < bufferMs;
    } catch {
        return true; // token lỗi => coi như sắp hết hạn
    }
};

export const getStoredToken = (): string | null => {
    const token = localStorage.getItem('accessToken');
    if (token && isTokenValid(token)) {
        return token;
    }
    return null;
};

// ==================== REFRESH TOKENS ====================
let _refreshPromise: Promise<string> | null = null;

/**
 * Đổi refreshToken lấy cặp token mới.
 * Deduplication: nhiều request gọi đồng thời chỉ tạo 1 lần call thực sự.
 */
export const refreshTokens = async (): Promise<string> => {
    if (_refreshPromise) return _refreshPromise;

    _refreshPromise = (async () => {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
            throw new Error('Không có refresh token');
        }

        // Dùng fetch thô để tránh đệ quy qua axios interceptor
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        const res = await fetch(`${baseUrl}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
        });

        if (!res.ok) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            throw new Error('Refresh token không hợp lệ hoặc đã hết hạn');
        }

        const data = await res.json();
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        return data.accessToken as string;
    })().finally(() => {
        _refreshPromise = null;
    });

    return _refreshPromise;
};

// ==================== PROVIDER PROFILE ====================
export interface RescueVehicle {
    type: 'CAR' | 'MOTORCYCLE';
    plateNumber: string;
    isPrimary: boolean;
}

export interface UpdateProviderProfileData {
    providerType: 'INDIVIDUAL' | 'BUSINESS';
    fullName: string;
    phoneNumber: string;
    businessName?: string;
    serviceTypes: string[];
    supportedVehicleTypes: string[];
    serviceRadiusKm: number;
    permanentAddress?: {
        addressText: string;
        lat: number;
        lng: number;
    };
    businessAddress?: {
        addressText: string;
        lat: number;
        lng: number;
    };
    rescueVehicles: RescueVehicle[];
}

export const updateProviderProfile = async (data: UpdateProviderProfileData): Promise<User> => {
    const response = await api.put('/me/provider/profile', data);
    return response.data;
};

// ==================== FORGOT PASSWORD ====================
export const forgotPasswordByEmail = async (email: string): Promise<{ message: string }> => {
    const response = await api.post('/auth/forgot-password/email', { email });
    return response.data;
};

export const forgotPasswordByPhone = async (firebaseIdToken: string): Promise<{ message: string; resetToken: string }> => {
    const response = await api.post('/auth/forgot-password/phone', { firebaseIdToken });
    return response.data;
};

export const resetPassword = async (token: string, newPassword: string): Promise<{ message: string }> => {
    const response = await api.post('/auth/reset-password', { token, newPassword });
    return response.data;
};
