'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserGuard } from '@/lib/guards';
import api from '@/lib/api';

interface RescueRequest {
    id: string;
    incidentType: string;
    vehicleType: string;
    status: string;
    pickupLocation: {
        addressText: string;
        lat: number;
        lng: number;
    };
    dropoffLocation?: {
        addressText: string;
        lat: number;
        lng: number;
    };
    description?: string;
    createdAt: string;
    media: any[];
}

const STATUS_LABELS: Record<string, string> = {
    CREATED: 'Đã tạo',
    MATCHING: 'Đang tìm provider',
    SEARCHING: 'Đang tìm kiếm',
    MATCHED: 'Đã ghép đôi',
    ASSIGNED: 'Đã có provider',
    ACCEPTED: 'Đã chấp nhận',
    IN_PROGRESS: 'Đang thực hiện',
    COMPLETED: 'Hoàn thành',
    CANCELLED: 'Đã hủy',
    REJECTED: 'Bị từ chối',
    EXPIRED: 'Hết hạn',
};

const STATUS_COLORS: Record<string, string> = {
    CREATED: 'bg-blue-100 text-blue-800',
    MATCHING: 'bg-yellow-100 text-yellow-800 animate-pulse',
    SEARCHING: 'bg-yellow-100 text-yellow-800',
    MATCHED: 'bg-purple-100 text-purple-800',
    ASSIGNED: 'bg-green-100 text-green-800',
    ACCEPTED: 'bg-green-100 text-green-800',
    IN_PROGRESS: 'bg-indigo-100 text-indigo-800',
    COMPLETED: 'bg-gray-100 text-gray-800',
    CANCELLED: 'bg-red-100 text-red-800',
    REJECTED: 'bg-red-100 text-red-800',
    EXPIRED: 'bg-orange-100 text-orange-800',
};

const INCIDENT_LABELS: Record<string, string> = {
    BREAKDOWN: 'Hỏng xe',
    ACCIDENT: 'Tai nạn',
    FLAT_TIRE: 'Lốp xe hỏng',
    BATTERY_DEAD: 'Hết bình điện',
    OUT_OF_FUEL: 'Hết nhiên liệu',
    LOCKED_OUT: 'Khóa xe',
    OTHER: 'Khác',
};

export default function UserRequestsPage() {
    const router = useRouter();
    const { isReady, user } = useUserGuard();
    const [requests, setRequests] = useState<RescueRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        try {
            const response = await api.get('/rescue-requests');
            setRequests(response.data);
        } catch (error) {
            console.error('Error fetching requests:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleViewRequest = (requestId: string) => {
        router.push(`/user/requests/${requestId}`);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (!isReady || isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b shadow-sm">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Yêu cầu cứu hộ</h1>
                            <p className="text-sm text-gray-600 mt-1">Quản lý các yêu cầu của bạn</p>
                        </div>
                        <button
                            onClick={() => router.push('/user/create-request')}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Tạo yêu cầu mới
                        </button>
                    </div>
                </div>
            </div>

            {/* Requests List */}
            <div className="max-w-4xl mx-auto px-4 py-6">
                {requests.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                        <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <h3 className="mt-4 text-lg font-medium text-gray-900">Chưa có yêu cầu nào</h3>
                        <p className="mt-2 text-sm text-gray-600">Tạo yêu cầu cứu hộ đầu tiên của bạn</p>
                        <button
                            onClick={() => router.push('/user/create-request')}
                            className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Tạo yêu cầu
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {requests.map((request) => (
                            <div
                                key={request.id}
                                onClick={() => handleViewRequest(request.id)}
                                className="bg-white rounded-lg shadow-sm p-6 cursor-pointer hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-lg font-semibold text-gray-900">
                                                {INCIDENT_LABELS[request.incidentType] || request.incidentType}
                                            </h3>
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[request.status]}`}>
                                                {STATUS_LABELS[request.status] || request.status}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 mt-1">{formatDate(request.createdAt)}</p>
                                    </div>
                                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-start gap-2">
                                        <svg className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">Điểm đón</p>
                                            <p className="text-sm text-gray-600">{request.pickupLocation.addressText}</p>
                                        </div>
                                    </div>

                                    {request.dropoffLocation && (
                                        <div className="flex items-start gap-2">
                                            <svg className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            <div>
                                                <p className="text-sm font-medium text-gray-700">Điểm đến</p>
                                                <p className="text-sm text-gray-600">{request.dropoffLocation.addressText}</p>
                                            </div>
                                        </div>
                                    )}

                                    {request.description && (
                                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">{request.description}</p>
                                    )}
                                </div>

                                {request.media && request.media.length > 0 && (
                                    <div className="mt-4 flex gap-2">
                                        {request.media.slice(0, 3).map((media, index) => (
                                            <img
                                                key={index}
                                                src={media.publicUrl}
                                                alt={`Photo ${index + 1}`}
                                                className="w-16 h-16 object-cover rounded"
                                            />
                                        ))}
                                        {request.media.length > 3 && (
                                            <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center text-sm text-gray-600">
                                                +{request.media.length - 3}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
