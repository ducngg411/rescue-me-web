import axios from 'axios';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor để thêm token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor để handle errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Only force-logout when the token itself is missing/invalid/expired.
            // Authorization errors (user lacks permission) should NOT log the user out.
            const message: string = error.response?.data?.message || '';
            const isTokenError = !message || // No message = no token at all
                message.toLowerCase().includes('token') ||
                message.toLowerCase().includes('invalid') ||
                message.toLowerCase().includes('expired') ||
                message.toLowerCase().includes('jwt') ||
                message === 'Unauthorized'; // raw JWT guard rejection

            if (isTokenError) {
                const isAuthPage = typeof window !== 'undefined' &&
                    (window.location.pathname.startsWith('/auth/') ||
                        window.location.pathname === '/auth');

                if (!isAuthPage) {
                    localStorage.removeItem('accessToken');
                    localStorage.removeItem('refreshToken');
                    window.location.href = '/auth/login';
                }
            }
        }
        return Promise.reject(error);
    }
);

// Admin API helpers
export const adminApi = {
    // Get all providers with filters
    getProviders: async (params?: {
        status?: string;
        search?: string;
        page?: number;
        limit?: number;
    }) => {
        const response = await api.get('/admin/providers', { params });
        return response.data;
    },

    // Get provider detail
    getProviderDetail: async (providerId: string) => {
        const response = await api.get(`/admin/providers/${providerId}`);
        return response.data;
    },

    // Approve provider
    approveProvider: async (providerId: string) => {
        const response = await api.post(`/admin/providers/${providerId}/approve`);
        return response.data;
    },

    // Reject provider
    rejectProvider: async (providerId: string, data: {
        rejectReasonCode: string;
        rejectReasonDetail: string;
    }) => {
        const response = await api.post(`/admin/providers/${providerId}/reject`, data);
        return response.data;
    },

    // Suspend provider
    suspendProvider: async (providerId: string, reason?: string) => {
        const response = await api.post(`/admin/providers/${providerId}/suspend`, { reason });
        return response.data;
    },

    // Unsuspend provider
    unsuspendProvider: async (providerId: string) => {
        const response = await api.post(`/admin/providers/${providerId}/unsuspend`);
        return response.data;
    },

    // Get provider verification history
    getProviderHistory: async (providerId: string) => {
        const response = await api.get(`/admin/providers/${providerId}/history`);
        return response.data;
    },
};

export default api;
