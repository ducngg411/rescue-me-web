'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Filter, User, Phone, Briefcase, Car, Bike, Clock, CheckCircle, XCircle, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useAdminGuard } from '@/lib/guards';
import { adminApi } from '@/lib/api';

interface Provider {
    id: string;
    fullName: string;
    phoneNumber: string;
    email: string;
    providerType: 'INDIVIDUAL' | 'BUSINESS';
    businessName?: string;
    serviceTypes: string[];
    supportedVehicleTypes: string[];
    verificationStatus: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
    submittedAt: string | null;
    isActive: boolean;
    rescueVehicles?: Array<{
        type: 'CAR' | 'MOTORCYCLE';
        plateNumber: string;
        isPrimary: boolean;
    }>;
}

const STATUS_CONFIG = {
    DRAFT: {
        label: 'Nháp',
        icon: RefreshCw,
        color: 'text-gray-600',
        bgColor: 'bg-gray-100',
    },
    PENDING: {
        label: 'Chờ duyệt',
        icon: Clock,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100',
    },
    APPROVED: {
        label: 'Đã duyệt',
        icon: CheckCircle,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
    },
    REJECTED: {
        label: 'Bị từ chối',
        icon: XCircle,
        color: 'text-red-600',
        bgColor: 'bg-red-100',
    },
    SUSPENDED: {
        label: 'Bị khóa',
        icon: AlertTriangle,
        color: 'text-orange-600',
        bgColor: 'bg-orange-100',
    },
};

const SERVICE_TYPE_LABELS: Record<string, string> = {
    TOWING: 'Kéo xe',
    BATTERY_JUMP: 'Cứu hộ bình điện',
    TIRE_CHANGE: 'Thay lốp xe',
    FUEL_DELIVERY: 'Tiếp nhiên liệu',
    LOCKOUT: 'Mở khóa xe',
    BREAKDOWN_REPAIR: 'Sửa chữa tại chỗ',
};

export default function AdminDashboard() {
    const router = useRouter();
    const { isReady } = useAdminGuard();
    const [providers, setProviders] = useState<Provider[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');

    useEffect(() => {
        if (isReady) {
            loadProviders();
        }
    }, [isReady, statusFilter]);

    const loadProviders = async () => {
        try {
            setLoading(true);
            const params: any = {};
            if (statusFilter !== 'ALL') {
                params.status = statusFilter;
            }
            const data = await adminApi.getProviders(params);
            setProviders(data);
        } catch (err) {
            console.error('Failed to load providers:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredProviders = providers.filter(provider => {
        const searchLower = search.toLowerCase();
        return (
            provider.fullName?.toLowerCase().includes(searchLower) ||
            provider.phoneNumber?.includes(searchLower) ||
            provider.email?.toLowerCase().includes(searchLower) ||
            provider.businessName?.toLowerCase().includes(searchLower) ||
            (provider.rescueVehicles?.some(v => v.plateNumber.toLowerCase().includes(searchLower)) ?? false)
        );
    });

    if (!isReady || loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
                    <p className="mt-4 text-sm text-gray-600">Đang tải...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-semibold text-gray-900 mb-2">Admin Dashboard</h1>
                    <p className="text-sm text-gray-600">Quản lý và duyệt hồ sơ nhà cung cấp</p>
                </div>

                {/* Filters */}
                <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Search */}
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Tìm kiếm theo tên, SĐT, email, biển số..."
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        {/* Status Filter */}
                        <div className="flex items-center gap-2">
                            <Filter className="w-5 h-5 text-gray-400" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="ALL">Tất cả</option>
                                <option value="DRAFT">Nháp</option>
                                <option value="PENDING">Chờ duyệt</option>
                                <option value="APPROVED">Đã duyệt</option>
                                <option value="REJECTED">Bị từ chối</option>
                                <option value="SUSPENDED">Bị khóa</option>
                            </select>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {Object.entries(STATUS_CONFIG).map(([status, config]) => {
                                const count = providers.filter(p => p.verificationStatus === status).length;
                                const Icon = config.icon;
                                return (
                                    <div key={status} className="text-center">
                                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${config.bgColor} rounded-lg`}>
                                            <Icon className={`w-4 h-4 ${config.color}`} />
                                            <span className={`text-sm font-medium ${config.color}`}>{count}</span>
                                        </div>
                                        <p className="text-xs text-gray-600 mt-1">{config.label}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Providers List */}
                <div className="space-y-4">
                    {filteredProviders.length === 0 ? (
                        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
                            <User className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-600">Không tìm thấy nhà cung cấp nào</p>
                        </div>
                    ) : (
                        filteredProviders.map((provider) => {
                            const StatusIcon = STATUS_CONFIG[provider.verificationStatus].icon;
                            return (
                                <div
                                    key={provider.id}
                                    onClick={() => router.push(`/admin/providers/${provider.id}`)}
                                    className="bg-white border border-gray-200 rounded-lg p-6 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            {/* Header */}
                                            <div className="flex items-start gap-3 mb-3">
                                                <div className="flex-1">
                                                    <h3 className="text-lg font-semibold text-gray-900">{provider.fullName}</h3>
                                                    {provider.providerType === 'BUSINESS' && provider.businessName && (
                                                        <p className="text-sm text-gray-600 mt-0.5">{provider.businessName}</p>
                                                    )}
                                                </div>
                                                <div className={`flex items-center gap-1.5 px-3 py-1.5 ${STATUS_CONFIG[provider.verificationStatus].bgColor} rounded-lg`}>
                                                    <StatusIcon className={`w-4 h-4 ${STATUS_CONFIG[provider.verificationStatus].color}`} />
                                                    <span className={`text-sm font-medium ${STATUS_CONFIG[provider.verificationStatus].color}`}>
                                                        {STATUS_CONFIG[provider.verificationStatus].label}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Info Grid */}
                                            <div className="grid md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <Phone className="w-4 h-4 text-gray-400" />
                                                    <span className="text-gray-700">{provider.phoneNumber}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Briefcase className="w-4 h-4 text-gray-400" />
                                                    <span className="text-gray-700">
                                                        {provider.providerType === 'INDIVIDUAL' ? 'Cá nhân' : 'Doanh nghiệp'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Rescue Vehicles */}
                                            {provider.rescueVehicles && provider.rescueVehicles.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {provider.rescueVehicles.map((vehicle, index) => (
                                                        <span key={index} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                                                            {vehicle.type === 'CAR' ? <Car className="w-3 h-3" /> : <Bike className="w-3 h-3" />}
                                                            <span className="font-mono">{vehicle.plateNumber}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Services & Vehicles */}
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {provider.serviceTypes.slice(0, 3).map((service) => (
                                                    <span key={service} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                                                        {SERVICE_TYPE_LABELS[service]}
                                                    </span>
                                                ))}
                                                {provider.serviceTypes.length > 3 && (
                                                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                                                        +{provider.serviceTypes.length - 3} khác
                                                    </span>
                                                )}
                                            </div>

                                            {/* Timestamp */}
                                            {provider.submittedAt && (
                                                <p className="text-xs text-gray-500 mt-3">
                                                    Nộp hồ sơ: {new Date(provider.submittedAt).toLocaleString('vi-VN')}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
