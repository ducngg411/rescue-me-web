import axios from 'axios';
import { isTokenExpiringSoon, refreshTokens } from './auth';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

/** Guest JWT: /guest/* API và /chatbot/guest/* (axios chỉ nhận path tương đối). */
function isGuestApiPath(url: string): boolean {
    if (!url) return false;
    let path = url;
    if (url.startsWith('http')) {
        try {
            path = new URL(url).pathname;
        } catch {
            /* keep url as-is */
        }
    }
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    if (path.startsWith(base)) {
        path = path.slice(base.length) || '/';
    }
    if (!path.startsWith('/')) path = `/${path}`;
    // Pathname đầy đủ có thể là /api/chatbot/guest/... tùy axios / server
    return path.startsWith('/guest/') || path.includes('/chatbot/guest');
}

// Request interceptor — gắn token + proactive refresh
api.interceptors.request.use(
    async (config) => {
        const url = config.url || '';
        const isGuestRoute = isGuestApiPath(url);

        if (isGuestRoute) {
            const guestToken = localStorage.getItem('guestAccessToken');
            if (guestToken) {
                config.headers.Authorization = `Bearer ${guestToken}`;
            }
        } else {
            let token = localStorage.getItem('accessToken');

            // Proactive refresh: nếu token sắp hết hạn (< 60s), đổi trước khi gửi
            if (token && isTokenExpiringSoon(token)) {
                try {
                    token = await refreshTokens();
                } catch {
                    // refresh thất bại => để request tiếp tục với token cũ, interceptor 401 sẽ xử lý
                }
            }

            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor — fallback 401 retry
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401) {
            const message: string = error.response?.data?.message || '';
            const isTokenError = !message ||
                message.toLowerCase().includes('token') ||
                message.toLowerCase().includes('invalid') ||
                message.toLowerCase().includes('expired') ||
                message.toLowerCase().includes('jwt') ||
                message === 'Unauthorized';

            const reqUrl = originalRequest?.url || '';
            const isGuestRoute = isGuestApiPath(reqUrl);

            if (isGuestRoute) {
                // Guest: xóa token và redirect
                localStorage.removeItem('guestAccessToken');
                localStorage.removeItem('guestSession');
                const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
                if (!pathname.startsWith('/guest/rescue/new')) {
                    window.location.href = '/guest/rescue/new';
                }
            } else if (isTokenError && !originalRequest?._retry) {
                // Thử refresh một lần duy nhất
                originalRequest._retry = true;
                try {
                    const newToken = await refreshTokens();
                    originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
                    return api(originalRequest); // retry request gốc
                } catch {
                    // Refresh thất bại => đăng xuất
                    localStorage.removeItem('accessToken');
                    localStorage.removeItem('refreshToken');
                    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
                    const isAuthPage = pathname.startsWith('/auth/') || pathname === '/auth';
                    if (!isAuthPage) {
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

    // ── Withdrawals ─────────────────────────────────────────────────────────

    getWithdrawals: async (params?: any) => {
        const response = await api.get('/admin/withdrawals', { params });
        return response.data;
    },

    getWithdrawalStats: async () => {
        const response = await api.get('/admin/withdrawals/stats');
        return response.data;
    },

    approveWithdrawal: async (id: string, userType: string) => {
        const response = await api.post(`/admin/withdrawals/${id}/approve`, { userType });
        return response.data;
    },

    rejectWithdrawal: async (id: string, userType: string, reason?: string) => {
        const response = await api.post(`/admin/withdrawals/${id}/reject`, { userType, reason });
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

    // ── Billing & Fee ─────────────────────────────────────────────────────────

    getBillingConfig: async () => {
        const response = await api.get('/admin/billing');
        return response.data as {
            commissionRate: number;
            totalCommission: number;
            commissionThisMonth: number;
            sepayApiKey: string | null;
            sepayBankAccount: string | null;
            sepayBankCode: string | null;
        };
    },

    updateFee: async (commissionRate: number, note?: string) => {
        const response = await api.patch('/admin/billing/fee', { commissionRate, note });
        return response.data as { success: boolean; commissionRate: number };
    },

    updateBankAccount: async (dto: {
        bankAccount: string;
        bankCode: string;
        apiKey?: string;
        note?: string;
    }) => {
        const response = await api.patch('/admin/billing/account', dto);
        return response.data as { success: boolean };
    },

    getBillingAuditLog: async (params?: { skip?: number; take?: number }) => {
        const response = await api.get('/admin/billing/audit-log', { params });
        return response.data as {
            items: {
                id: string;
                adminId: string;
                adminName: string;
                changeType: 'FEE_RATE' | 'BANK_ACCOUNT';
                oldValue: string | null;
                newValue: string;
                note: string | null;
                createdAt: string;
            }[];
            total: number;
            skip: number;
            take: number;
        };
    },

    // ── Settings ──────────────────────────────────────────────────────────────
    getSettings: async () => {
        const response = await api.get('/admin/settings');
        return response.data as { platformName: string };
    },

    updateSettings: async (platformName: string) => {
        const response = await api.patch('/admin/settings', { platformName });
        return response.data as { success: boolean };
    },

    // ── Charts ────────────────────────────────────────────────────────────────
    getTopUsersByRequests: async () => {
        const res = await api.get('/admin/charts/top-users-by-requests');
        return res.data as { rank: number; label: string; sublabel?: string; value: number }[];
    },
    getTopProvidersByCommission: async () => {
        const res = await api.get('/admin/charts/top-providers-by-commission');
        return res.data as { rank: number; label: string; value: number; displayValue: string }[];
    },
    getProviderServiceDistribution: async () => {
        const res = await api.get('/admin/charts/provider-service-distribution');
        return res.data as { label: string; value: number; key: string }[];
    },
    getProviderVehicleDistribution: async () => {
        const res = await api.get('/admin/charts/provider-vehicle-distribution');
        return res.data as { label: string; value: number; color: string }[];
    },
    getDisputeResolutionDistribution: async () => {
        const res = await api.get('/admin/charts/dispute-resolution-distribution');
        return res.data as { label: string; value: number; key: string }[];
    },
    getRequestStatusTrend: async () => {
        const res = await api.get('/admin/charts/request-status-trend');
        return res.data as { label: string; total: number; completed: number; cancelled: number }[];
    },
    getTopUsersBySpending: async () => {
        const res = await api.get('/admin/charts/top-users-by-spending');
        return res.data as { rank: number; label: string; sublabel?: string; value: number; displayValue: string }[];
    },
    getWithdrawalTrend: async () => {
        const res = await api.get('/admin/charts/withdrawal-trend');
        return res.data as { label: string; total: number; completed: number; amount: number }[];
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
