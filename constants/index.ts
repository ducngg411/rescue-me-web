export const APP_NAME = 'RescueMe';
export const APP_DESCRIPTION = 'Emergency assistance when you need it most';

export const VEHICLE_TYPES = {
    CAR: 'Ô tô',
    TRUCK: 'Xe tải',
    MOTORCYCLE: 'Xe máy',
} as const;

export const VEHICLE_COLORS = [
    'Trắng',
    'Đen',
    'Xám',
    'Bạc',
    'Đỏ',
    'Xanh dương',
    'Xanh lá',
    'Vàng',
    'Nâu',
    'Cam',
] as const;

export const SERVICE_TYPES = {
    tow: 'Tow Service',
    mechanic: 'Mechanic',
    tire: 'Tire Change',
    fuel: 'Fuel Delivery',
    locksmith: 'Locksmith',
} as const;

export const REQUEST_STATUS = {
    pending: 'Pending',
    accepted: 'Accepted',
    'in-progress': 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
} as const;

export const USER_ROLES = {
    user: 'User',
    provider: 'Provider',
} as const;

export const ROUTES = {
    home: '/',
    login: '/login',
    register: '/register',
    completeProfile: '/complete-profile',

    // User routes
    userDashboard: '/dashboard',
    createRequest: '/request/create',
    requestDetail: (id: string) => `/request/${id}`,
    history: '/history',

    // Provider routes
    providerDashboard: '/dashboard',
    providerRequests: '/requests',
    earnings: '/earnings',
} as const;

export const DEFAULT_LOCATION = {
    lat: 21.028511, // Hanoi
    lng: 105.804817,
};
