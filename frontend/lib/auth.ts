import api from './api';
import { jwtDecode } from 'jwt-decode';

export interface User {
    id: string;
    email: string;
    name: string | null;
    avatar: string | null;
    role: string;
    authProvider: string;
    profileCompleted: boolean;
    verificationStatus?: string;
    isOnline?: boolean; // Provider only
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

export const getStoredToken = (): string | null => {
    const token = localStorage.getItem('accessToken');
    if (token && isTokenValid(token)) {
        return token;
    }
    return null;
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
