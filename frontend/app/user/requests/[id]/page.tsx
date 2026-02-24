'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUserGuard } from '@/lib/guards';
import { useRequestTracking } from '@/lib/hooks/useRequestTracking';
import MatchingStatus from '@/components/MatchingStatus';
import AssignedProvider from '@/components/AssignedProvider';
import ExpiredRetry from '@/components/ExpiredRetry';

const STATUS_LABELS: Record<string, string> = {
    CREATED: 'Đã tạo',
    MATCHING: 'Đang tìm provider',
    SEARCHING: 'Đang tìm provider',
    MATCHED: 'Đã ghép đôi',
    ASSIGNED: 'Đã có provider',
    ACCEPTED: 'Đã chấp nhận',
    IN_PROGRESS: 'Đang thực hiện',
    COMPLETED: 'Hoàn thành',
    CANCELLED: 'Đã hủy',
    REJECTED: 'Bị từ chối',
    EXPIRED: 'Hết hạn',
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

export default function RequestTrackingPage() {
    const router = useRouter();
    const params = useParams();
    const requestId = params.id as string;
    const { isReady } = useUserGuard();
    const [isRetrying, setIsRetrying] = useState(false);

    const { status, isLoading, error, timeRemaining, cancelRequest, retryRequest } = useRequestTracking({
        requestId,
        enabled: isReady,
    });

    // Debug: Log status data
    if (status) {
        console.log('📊 [User Request Page] Status:', {
            status: status.status,
            matchedDistance: status.matchedDistance,
            matchedEta: status.matchedEta,
            hasProvider: !!status.assignedProvider,
        });
    }

    const handleCancel = async () => {
        const confirmed = window.confirm('Bạn có chắc muốn huỷ yêu cầu này?');
        if (!confirmed) return;

        const success = await cancelRequest();
        if (success) {
            alert('Đã huỷ yêu cầu thành công');
            router.push('/user/requests');
        }
    };

    const handleRetry = async () => {
        setIsRetrying(true);
        try {
            const newRequest = await retryRequest();
            alert('Đã tạo yêu cầu mới!');
            router.push(`/user/requests/${newRequest.id}`);
        } catch (err) {
            alert('Không thể thử lại. Vui lòng thử lại sau.');
        } finally {
            setIsRetrying(false);
        }
    };

    const handleGoBack = () => {
        router.push('/user/requests');
    };

    if (!isReady || isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error && !status) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="bg-white rounded-lg shadow-sm p-8 max-w-md mx-4">
                    <h3 className="text-lg font-semibold text-red-600 mb-2">Lỗi</h3>
                    <p className="text-gray-700">{error}</p>
                    <button
                        onClick={handleGoBack}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Quay lại
                    </button>
                </div>
            </div>
        );
    }

    if (!status) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b shadow-sm">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleGoBack}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold text-gray-900">Yêu cầu cứu hộ</h1>
                            <p className="text-sm text-gray-600 mt-1">
                                Mã: {requestId.slice(0, 8)}... • {STATUS_LABELS[status.status] || status.status}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-4 py-6">
                {/* Show different components based on status */}
                {status.status === 'MATCHING' && (
                    <MatchingStatus
                        timeRemaining={timeRemaining}
                        searchPhase={status.searchPhase}
                        onCancel={handleCancel}
                    />
                )}

                {status.status === 'ASSIGNED' && status.assignedProvider && (
                    <AssignedProvider
                        provider={status.assignedProvider}
                        distance={status.matchedDistance}
                        eta={status.matchedEta}
                    />
                )}

                {status.status === 'EXPIRED' && (
                    <ExpiredRetry
                        onRetry={handleRetry}
                        onCancel={handleCancel}
                        isRetrying={isRetrying}
                    />
                )}

                {status.status === 'CANCELLED' && (
                    <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                        <div className="inline-flex items-center justify-center h-16 w-16 bg-red-100 rounded-full mb-4">
                            <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Đã huỷ yêu cầu</h3>
                        <p className="text-gray-600 mb-6">Yêu cầu của bạn đã được huỷ</p>
                        <button
                            onClick={handleGoBack}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            Quay lại danh sách
                        </button>
                    </div>
                )}

                {['IN_PROGRESS', 'COMPLETED', 'ACCEPTED'].includes(status.status) && (
                    <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                            {STATUS_LABELS[status.status]}
                        </h3>
                        <p className="text-gray-600 mb-6">
                            Yêu cầu đang được xử lý
                        </p>
                        {status.assignedProvider && (
                            <AssignedProvider provider={status.assignedProvider} />
                        )}
                    </div>
                )}

                {/* Debug info (remove in production) */}
                {process.env.NODE_ENV === 'development' && (
                    <div className="mt-6 bg-gray-100 rounded-lg p-4">
                        <h4 className="font-mono text-xs text-gray-600 mb-2">Debug Info:</h4>
                        <pre className="text-xs text-gray-700 overflow-auto">
                            {JSON.stringify(status, null, 2)}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}
