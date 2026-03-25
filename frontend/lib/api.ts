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
        const url = config.url || '';
        const isGuestRoute = url.startsWith('/guest/');

        if (isGuestRoute) {
            const guestToken = localStorage.getItem('guestAccessToken');
            if (guestToken) {
                config.headers.Authorization = `Bearer ${guestToken}`;
            }
        } else {
            const token = localStorage.getItem('accessToken');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
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
                const isGuestRoute = error.config?.url?.startsWith('/guest/');
                const pathname = typeof window !== 'undefined' ? window.location.pathname : '';

                if (isGuestRoute) {
                    localStorage.removeItem('guestAccessToken');
                    localStorage.removeItem('guestSession');
                    if (!pathname.startsWith('/guest/rescue/new')) {
                        window.location.href = '/guest/rescue/new';
                    }
                } else {
                    const isAuthPage = typeof window !== 'undefined' &&
                        (pathname.startsWith('/auth/') || pathname === '/auth');

                    if (!isAuthPage) {
                        localStorage.removeItem('accessToken');
                        localStorage.removeItem('refreshToken');
                        window.location.href = '/auth/login';
                    }
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

    // Get provider stats
    getProviderStats: async () => {
        const response = await api.get('/admin/providers/stats');
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

    getDisputes: async (params?: { status?: string; skip?: number; take?: number }) => {
        const response = await api.get('/admin/disputes', { params });
        return response.data as {
            items: unknown[];
            total: number;
            skip: number;
            take: number;
        };
    },

    getDisputeStats: async () => {
        const response = await api.get('/admin/disputes/stats');
        return response.data as {
            new: number;
            inProgress: number;
            resolved: number;
            total: number;
        };
    },

    getDisputeDetail: async (caseId: string) => {
        const response = await api.get(`/admin/disputes/${caseId}`);
        return response.data;
    },

    getRequestDetail: async (requestId: string) => {
        const response = await api.get(`/admin/requests/${requestId}`);
        return response.data;
    },

    updateDisputeStatus: async (caseId: string, status: string) => {
        const response = await api.patch(`/admin/disputes/${caseId}/status`, { status });
        return response.data;
    },

    requestDisputeEvidence: async (
        caseId: string,
        message: string,
        targetRole: 'PROVIDER' | 'CUSTOMER',
    ) => {
        const response = await api.post(`/admin/disputes/${caseId}/request-evidence`, {
            message,
            targetRole,
        });
        return response.data;
    },

    resolveDispute: async (
        caseId: string,
        body: {
            resolutionType: string;
            resolutionAmountCustomer?: number;
            resolutionAmountProvider?: number;
            resolutionNote?: string;
        },
    ) => {
        const response = await api.post(`/admin/disputes/${caseId}/resolve`, body);
        return response.data;
    },

    rejectDispute: async (caseId: string, resolutionNote?: string) => {
        const response = await api.post(`/admin/disputes/${caseId}/reject`, { resolutionNote });
        return response.data;
    },

    addDisputeEvidence: async (caseId: string, url: string, note?: string) => {
        const response = await api.post(`/admin/disputes/${caseId}/evidence`, { url, note });
        return response.data;
    },

    // ── Transactions ────────────────────────────────────────────────────────

    getTransactionSummary: async () => {
        const response = await api.get('/admin/transactions/summary');
        return response.data;
    },

    // ── Wallets ─────────────────────────────────────────────────────────────

    getProviderWallets: async (params?: any) => {
        const response = await api.get('/admin/wallets/provider', { params });
        return response.data;
    },

    getProviderWallet: async (id: string) => {
        const response = await api.get(`/admin/wallets/provider/${id}`);
        return response.data;
    },

    getUserWallets: async (params?: any) => {
        const response = await api.get('/admin/wallets/user', { params });
        return response.data;
    },

    getUserWallet: async (id: string) => {
        const response = await api.get(`/admin/wallets/user/${id}`);
        return response.data;
    },

    getWalletTransactions: async (params?: any) => {
        const response = await api.get('/admin/transactions/wallet', { params });
        return response.data;
    },

    getTopupTransactions: async (params?: any) => {
        const response = await api.get('/admin/transactions/topup', { params });
        return response.data;
    },

    getJobPaymentTransactions: async (params?: any) => {
        const response = await api.get('/admin/transactions/job-payment', { params });
        return response.data;
    },

    getPayments: async (params?: any) => {
        const response = await api.get('/admin/payments', { params });
        return response.data;
    },

    getUsers: async (params?: {
        search?: string;
        role?: string;
        status?: string;
        dateFrom?: string;
        dateTo?: string;
        skip?: number;
        take?: number;
    }) => {
        const response = await api.get('/admin/users', { params });
        return response.data as {
            items: unknown[];
            total: number;
            skip: number;
            take: number;
        };
    },

    getUserStats: async () => {
        const response = await api.get('/admin/users/stats');
        return response.data as {
            total: number;
            active: number;
            inactive: number;
            newThisMonth: number;
        };
    },

    getUserDetail: async (id: string) => {
        const response = await api.get(`/admin/users/${id}`);
        return response.data;
    },

    suspendUser: async (id: string, banReason: string) => {
        const response = await api.post(`/admin/users/${id}/suspend`, { banReason });
        return response.data;
    },

    activateUser: async (id: string) => {
        const response = await api.post(`/admin/users/${id}/activate`);
        return response.data;
    },

    deleteUser: async (id: string) => {
        const response = await api.delete(`/admin/users/${id}`);
        return response.data;
    },

    getRescueRequests: async (params?: {
        search?: string;
        status?: string;
        incidentType?: string;
        dateFrom?: string;
        dateTo?: string;
        hasDispute?: boolean;
        skip?: number;
        take?: number;
    }) => {
        const response = await api.get('/admin/requests', { params });
        return response.data as { items: unknown[]; total: number; skip: number; take: number };
    },

    getRescueRequestStats: async () => {
        const response = await api.get('/admin/requests/stats');
        return response.data as { total: number; completed: number; cancelled: number; newThisMonth: number; disputed: number };
    },

    getRescueRequestDetail: async (id: string) => {
        const response = await api.get(`/admin/requests/${id}`);
        return response.data;
    },
};


// User-facing dispute API helpers
export const userDisputeApi = {
    getMyDisputes: async () => {
        const response = await api.get('/disputes/my');
        return response.data as { items: unknown[]; total: number };
    },
    getDisputeDetail: async (id: string) => {
        const response = await api.get(`/disputes/${id}`);
        return response.data;
    },
    openDispute: async (dto: {
        orderId: string;
        paymentId: string;
        targetAmount: number;
        reason: string;
        description?: string;
        expectedOutcome?: string;
        attachmentUrls?: string[];
    }) => {
        const response = await api.post('/disputes', dto);
        return response.data as { disputeId: string; status: string; firstResponseDueAt: string; resolutionDueAt: string };
    },
    sendMessage: async (id: string, body?: string, attachmentUrls?: string[]) => {
        const response = await api.post(`/disputes/${id}/messages`, { body, attachmentUrls });
        return response.data;
    },
};

// Provider-facing dispute API helpers
export const providerDisputeApi = {
    getMyDisputes: async () => {
        const response = await api.get('/disputes/provider');
        return response.data as { items: unknown[]; total: number };
    },
    getDisputeDetail: async (id: string) => {
        const response = await api.get(`/disputes/${id}`);
        return response.data;
    },
    openDispute: async (dto: {
        orderId: string;
        paymentId: string;
        targetAmount: number;
        reason: string;
        description?: string;
        expectedOutcome?: string;
        attachmentUrls?: string[];
    }) => {
        const response = await api.post('/disputes', dto);
        return response.data as { disputeId: string; status: string; firstResponseDueAt: string; resolutionDueAt: string };
    },
    sendMessage: async (id: string, body?: string, attachmentUrls?: string[]) => {
        const response = await api.post(`/disputes/${id}/messages`, { body, attachmentUrls });
        return response.data;
    },
};

export default api;
