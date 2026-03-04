'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useProviderStatus } from '@/lib/hooks/useProviderStatus';
import { usePendingRequests } from '@/lib/hooks/usePendingRequests';
import { useProviderLocation } from '@/lib/hooks/useProviderLocation';
import OnlineToggle from '@/components/provider/OnlineToggle';
import WaitingState from '@/components/provider/WaitingState';
import IncomingRequestModal from '@/components/provider/IncomingRequestModal';
import ProviderSettings from '@/components/provider/ProviderSettings';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function ProviderActivePage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { isOnline, isLoading: statusLoading, toggleOnlineStatus, setIsOnline } = useProviderStatus();
    const { requests } = usePendingRequests({
        enabled: isOnline,
        pollInterval: 5000,
    });

    // Track GPS location when online
    const { location } = useProviderLocation({
        enabled: isOnline,
        updateInterval: 30000, // Update every 30 seconds
    });

    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeTab, setActiveTab] = useState<'active' | 'history' | 'settings'>('active');
    // Track declined request IDs locally to prevent spam
    const [declinedRequestIds, setDeclinedRequestIds] = useState<Set<string>>(new Set());
    // Track request history for resume functionality
    const [requestHistory, setRequestHistory] = useState<any[]>([]);

    // Filter out declined requests
    const filteredRequests = requests.filter(req => !declinedRequestIds.has(req.id));

    // Load request history from localStorage on mount and when switching to history tab
    useEffect(() => {
        try {
            const saved = localStorage.getItem('provider_request_history');
            if (saved) {
                const history = JSON.parse(saved);
                // Only keep requests from last 24 hours
                const cutoff = Date.now() - 24 * 60 * 60 * 1000;
                const filtered = history.filter((item: any) => item.timestamp > cutoff);
                setRequestHistory(filtered);
                console.log('📚 [History] Loaded', filtered.length, 'items from localStorage');
            }
        } catch (err) {
            console.error('Error loading request history:', err);
        }
    }, [activeTab]); // Reload whenever activeTab changes

    // Save request history to localStorage
    const saveToHistory = (request: any) => {
        try {
            const historyItem = {
                id: request.id,
                timestamp: Date.now(),
                incidentType: request.incidentType,
                vehicleType: request.vehicleType,
                pickupLocation: request.pickupLocation,
                distance: request.distance,
                estimatedEarnings: request.estimatedEarnings,
            };

            const newHistory = [historyItem, ...requestHistory.filter(item => item.id !== request.id)];
            const limited = newHistory.slice(0, 10); // Keep only last 10 requests

            setRequestHistory(limited);
            localStorage.setItem('provider_request_history', JSON.stringify(limited));
        } catch (err) {
            console.error('Error saving request history:', err);
        }
    };

    // Remove from history
    const removeFromHistory = (requestId: string) => {
        const newHistory = requestHistory.filter(item => item.id !== requestId);
        setRequestHistory(newHistory);
        localStorage.setItem('provider_request_history', JSON.stringify(newHistory));
    };

    // Initialize online status from user profile
    useEffect(() => {
        if (user && user.isOnline !== undefined) {
            setIsOnline(user.isOnline);
        }
    }, [user, setIsOnline]);

    // Auto-show modal when new request arrives
    useEffect(() => {
        if (filteredRequests.length > 0 && !selectedRequest) {
            setSelectedRequest(filteredRequests[0]);

            // Play notification sound
            // TODO: Add notification.mp3 to public folder
            // const audio = new Audio('/notification.mp3');
            // audio.play().catch(() => {
            //     // Ignore if user hasn't interacted with page yet
            // });
        }
    }, [filteredRequests, selectedRequest]);

    // Guard: Check authentication
    if (authLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!user) {
        router.push('/auth/login');
        return null;
    }

    // Guard: Check provider role
    if (user.role !== 'PROVIDER') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-sm p-8 max-w-md">
                    <h2 className="text-xl font-bold text-red-600 mb-4">Truy cập bị từ chối</h2>
                    <p className="text-gray-700 mb-4">Trang này chỉ dành cho Providers.</p>
                    <button
                        onClick={() => router.push('/')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Quay lại trang chủ
                    </button>
                </div>
            </div>
        );
    }

    // Guard: Check verification status
    if (user.verificationStatus !== 'APPROVED') {
        return (
            <div className="min-h-screen bg-gray-50">
                <OnlineToggle
                    isOnline={false}
                    isLoading={false}
                    onToggle={async () => { }}
                />
                <div className="max-w-4xl mx-auto px-4 py-8">
                    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6">
                        <div className="flex items-start gap-4">
                            <div className="text-4xl"></div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-yellow-900 mb-2">
                                    Tài khoản chưa được xác minh
                                </h3>
                                <p className="text-yellow-800 mb-4">
                                    Bạn cần hoàn thành xác minh trước khi có thể nhận yêu cầu cứu hộ.
                                </p>
                                <div className="text-sm text-yellow-700 mb-4">
                                    <strong>Trạng thái hiện tại:</strong>{' '}
                                    {user.verificationStatus === 'DRAFT' && 'Bản nháp'}
                                    {user.verificationStatus === 'PENDING' && 'Đang chờ duyệt'}
                                    {user.verificationStatus === 'REJECTED' && 'Bị từ chối'}
                                </div>
                                <button
                                    onClick={() => router.push('/provider/verification')}
                                    className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                                >
                                    Hoàn thiện xác minh
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const handleToggle = async (newStatus: boolean) => {
        const result = await toggleOnlineStatus(newStatus);
        if (result.success) {
            toast.success(result.message);
        } else {
            toast.error(`Lỗi: ${result.message}`);
        }
    };

    const handleViewDetails = () => {
        if (!selectedRequest) return;

        const requestId = selectedRequest.id;

        // Save to history for resume functionality
        saveToHistory(selectedRequest);

        // Add to declined list to prevent modal from showing again when user comes back
        // (Detail page will call decline API if user backs without sending quote)
        setDeclinedRequestIds(prev => new Set(prev).add(requestId));

        // Navigate to detail page where provider can view full details and send quote
        router.push(`/provider/requests/${requestId}`);
        setSelectedRequest(null);
    };

    const handleSkip = async () => {
        if (!selectedRequest) return;

        const requestId = selectedRequest.id;

        // Optimistically add to declined list to prevent modal from showing again
        setDeclinedRequestIds(prev => new Set(prev).add(requestId));

        // Dismiss the modal immediately
        setSelectedRequest(null);

        try {
            // Call decline API in background
            await api.post(`/rescue-requests/${requestId}/decline`);
            console.log(`🚫 Declined request ${requestId}`);
        } catch (err) {
            console.error('Error declining request:', err);
            // Keep in declined list anyway to prevent spam
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <OnlineToggle
                isOnline={isOnline}
                isLoading={statusLoading}
                onToggle={handleToggle}
            />

            {/* Tabs Navigation */}
            <div className="bg-white border-b sticky top-[73px] z-10">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="flex gap-6">
                        <button
                            onClick={() => setActiveTab('active')}
                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'active'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            Hoạt động
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'history'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            Lịch sử
                            {requestHistory.length > 0 && (
                                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full">
                                    {requestHistory.length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'settings'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            Cài đặt
                        </button>
                    </div>
                </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'active' ? (
                <>
                    {!isOnline ? (
                        <div className="max-w-6xl mx-auto px-6 py-8">
                            <div className="bg-white border rounded-lg p-8 text-center">
                                <div className="max-w-md mx-auto">
                                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                                        Bạn đang ngoại tuyến
                                    </h2>
                                    <p className="text-gray-600 mb-6">
                                        Bật trạng thái online ở trên để bắt đầu nhận yêu cầu cứu hộ từ khách hàng
                                    </p>

                                    {/* Stats */}
                                    <div className="grid grid-cols-3 gap-4 mt-8">
                                        <div className="border rounded-lg p-4">
                                            <div className="text-2xl font-semibold text-gray-900 mb-1">0</div>
                                            <div className="text-xs text-gray-600">Yêu cầu</div>
                                        </div>
                                        <div className="border rounded-lg p-4">
                                            <div className="text-2xl font-semibold text-gray-900 mb-1">0đ</div>
                                            <div className="text-xs text-gray-600">Doanh thu</div>
                                        </div>
                                        <div className="border rounded-lg p-4">
                                            <div className="text-2xl font-semibold text-gray-900 mb-1">—</div>
                                            <div className="text-xs text-gray-600">Đánh giá</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* GPS Location Warning */}
                            {location.error && (
                                <div className="max-w-6xl mx-auto px-6 pt-6">
                                    <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                                        <div className="flex items-start gap-3">
                                            <span className="text-2xl"></span>
                                            <div className="flex-1">
                                                <h4 className="font-semibold text-red-900 mb-1">
                                                    Không thể truy cập vị trí GPS
                                                </h4>
                                                <p className="text-sm text-red-700 mb-2">{location.error}</p>
                                                <p className="text-xs text-red-600">
                                                    Bạn sẽ không nhận được yêu cầu nếu không bật GPS.
                                                    Vui lòng cho phép truy cập vị trí trong cài đặt trình duyệt.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* GPS Location Success */}
                            {location.isTracking && location.lat && location.lng && (
                                <div className="max-w-6xl mx-auto px-6 pt-6">
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="text-green-600">📍</span>
                                            <span className="text-green-700">
                                                GPS đang hoạt động - Vị trí: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <WaitingState />
                        </>
                    )}
                </>
            ) : activeTab === 'history' ? (
                <div className="max-w-6xl mx-auto px-6 py-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Lịch sử yêu cầu</h2>

                    {requestHistory.length === 0 ? (
                        <div className="bg-white border rounded-lg p-8 text-center">
                            <div className="text-5xl mb-4">📋</div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                Chưa có lịch sử
                            </h3>
                            <p className="text-gray-600">
                                Các yêu cầu bạn đã xem sẽ xuất hiện ở đây
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {requestHistory.map((item) => {
                                const incidentTypeLabels: Record<string, string> = {
                                    BREAKDOWN: 'Hỏng xe',
                                    ACCIDENT: 'Tai nạn',
                                    FLAT_TIRE: 'Lốp xe hỏng',
                                    BATTERY_DEAD: 'Hết bình điện',
                                    OUT_OF_FUEL: 'Hết nhiên liệu',
                                    LOCKED_OUT: 'Khóa xe',
                                    OTHER: 'Khác',
                                };
                                const vehicleTypeLabels: Record<string, string> = {
                                    CAR: 'Ô tô',
                                    MOTORCYCLE: 'Xe máy',
                                };

                                const timeAgo = Math.floor((Date.now() - item.timestamp) / 60000); // minutes
                                const timeStr = timeAgo < 60
                                    ? `${timeAgo} phút trước`
                                    : `${Math.floor(timeAgo / 60)} giờ trước`;

                                return (
                                    <div key={item.id} className="bg-white border rounded-lg p-6 hover:shadow-md transition-shadow">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <span className="text-2xl"></span>
                                                    <div>
                                                        <h3 className="font-semibold text-gray-900">
                                                            {incidentTypeLabels[item.incidentType] || item.incidentType}
                                                        </h3>
                                                        <p className="text-sm text-gray-600">
                                                            {vehicleTypeLabels[item.vehicleType] || item.vehicleType} • {timeStr}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-3 gap-3 mb-4">
                                                    <div className="bg-blue-50 rounded-lg p-3">
                                                        <div className="text-xs text-blue-600 mb-1">Khoảng cách</div>
                                                        <div className="font-semibold text-blue-900">
                                                            {item.distance < 1
                                                                ? `${(item.distance * 1000).toFixed(0)} m`
                                                                : `${item.distance.toFixed(2)} km`
                                                            }
                                                        </div>
                                                    </div>
                                                    <div className="bg-green-50 rounded-lg p-3">
                                                        <div className="text-xs text-green-600 mb-1">Dự kiến thu nhập</div>
                                                        <div className="font-semibold text-green-900">
                                                            {item.estimatedEarnings.toLocaleString()}₫
                                                        </div>
                                                    </div>
                                                    <div className="bg-gray-50 rounded-lg p-3">
                                                        <div className="text-xs text-gray-600 mb-1">Vị trí</div>
                                                        <div className="font-semibold text-gray-900 text-xs truncate">
                                                            {item.pickupLocation.address}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-2">
                                                <button
                                                    onClick={() => {
                                                        router.push(`/provider/requests/${item.id}`);
                                                    }}
                                                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                                >
                                                    Tiếp tục
                                                </button>
                                                <button
                                                    onClick={() => removeFromHistory(item.id)}
                                                    className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                                                >
                                                    Xóa
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            ) : (
                <ProviderSettings />
            )}

            {/* Incoming Request Modal */}
            {selectedRequest && activeTab === 'active' && (
                <IncomingRequestModal
                    request={selectedRequest}
                    onViewDetails={handleViewDetails}
                    onDecline={handleSkip}
                    isProcessing={isProcessing}
                />
            )}
        </div>
    );
}
