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

export default function ProviderActivePage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { isOnline, isLoading: statusLoading, toggleOnlineStatus, setIsOnline } = useProviderStatus();
    const { requests, acceptRequest, declineRequest } = usePendingRequests({
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
    const [activeTab, setActiveTab] = useState<'active' | 'settings'>('active');

    // Initialize online status from user profile
    useEffect(() => {
        if (user && user.isOnline !== undefined) {
            setIsOnline(user.isOnline);
        }
    }, [user, setIsOnline]);

    // Auto-show modal when new request arrives
    useEffect(() => {
        if (requests.length > 0 && !selectedRequest) {
            setSelectedRequest(requests[0]);

            // Play notification sound
            // TODO: Add notification.mp3 to public folder
            // const audio = new Audio('/notification.mp3');
            // audio.play().catch(() => {
            //     // Ignore if user hasn't interacted with page yet
            // });
        }
    }, [requests, selectedRequest]);

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
                            <div className="text-4xl">⚠️</div>
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
            // Show toast notification
            alert(result.message);
        } else {
            alert(`Lỗi: ${result.message}`);
        }
    };

    const handleAccept = async () => {
        if (!selectedRequest) return;

        setIsProcessing(true);
        const result = await acceptRequest(selectedRequest.id);
        setIsProcessing(false);

        if (result.success) {
            setSelectedRequest(null);
            alert('Đã nhận yêu cầu thành công!');
            router.push(`/provider/requests/${selectedRequest.id}`);
        } else {
            alert(`Lỗi: ${result.message}`);
        }
    };

    const handleDecline = async () => {
        if (!selectedRequest) return;

        setIsProcessing(true);
        await declineRequest(selectedRequest.id);
        setIsProcessing(false);
        setSelectedRequest(null);
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
                                            <span className="text-2xl">⚠️</span>
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
            ) : (
                <ProviderSettings />
            )}

            {/* Incoming Request Modal */}
            {selectedRequest && activeTab === 'active' && (
                <IncomingRequestModal
                    request={selectedRequest}
                    onAccept={handleAccept}
                    onDecline={handleDecline}
                    isProcessing={isProcessing}
                />
            )}
        </div>
    );
}
