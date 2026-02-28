'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface RescueRequest {
    id: string;
    incidentType: string;
    vehicleType: string;
    description: string;
    contactPhone: string;
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
    status: string;
    assignedProviderId?: string | null;
    createdAt: string;
    user: {
        id: string;
        name: string;
        phoneNumber: string;
    };
    media: Array<{
        mediaType: string;
        publicUrl: string;
    }>;
    // Quote window info
    quoteWindowOpen?: boolean;
    quoteWindowTimeRemaining?: number;
    quoteWindowExpiresAt?: string | null;
    quoteCount?: number;
    maxQuotes?: number;
}

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

export default function ProviderRequestDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { user, loading: authLoading } = useAuth();
    const requestId = params.id as string;

    const [request, setRequest] = useState<RescueRequest | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Track if provider has a pending quote for this request
    const [hasPendingQuote, setHasPendingQuote] = useState(false);
    const [hasRejectedQuote, setHasRejectedQuote] = useState(false);
    const [myQuoteDetails, setMyQuoteDetails] = useState<any>(null);
    const [quoteAccepted, setQuoteAccepted] = useState(false);

    // Quote window timer
    const [timeLeft, setTimeLeft] = useState<number | null>(null);

    // Quote form state
    const [price, setPrice] = useState<string>('');
    const [estimatedArrivalMinutes, setEstimatedArrivalMinutes] = useState<string>('');
    const [message, setMessage] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Image viewer state
    const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
    const imageUrls = request?.media.filter(m => m.mediaType === 'IMAGE').map(m => m.publicUrl) || [];

    useEffect(() => {
        if (user && user.role === 'PROVIDER') {
            fetchRequestDetail();
        }
    }, [user, requestId]);

    // Poll for quote status updates when we have a pending quote
    useEffect(() => {
        if (!hasPendingQuote || !request) return;

        const pollInterval = setInterval(() => {
            checkQuoteStatus();
        }, 5000); // Check every 5 seconds

        return () => clearInterval(pollInterval);
    }, [hasPendingQuote, request]);

    const checkQuoteStatus = async () => {
        try {
            const quotesResponse = await api.get(`/rescue-requests/${requestId}/quotes`);
            const quotes = quotesResponse.data;
            const myQuote = quotes.find((q: any) => q.providerId === user?.id);

            if (myQuote) {
                setMyQuoteDetails(myQuote);

                if (myQuote.status === 'ACCEPTED') {
                    // My quote was accepted!
                    setQuoteAccepted(true);
                    setHasPendingQuote(false);
                    // Refresh request to get ASSIGNED status
                    fetchRequestDetail();
                    // Remove from history
                    removeFromHistoryStorage(requestId);
                } else if (myQuote.status === 'REJECTED') {
                    // My quote was rejected
                    setHasPendingQuote(false);
                    setHasRejectedQuote(true);
                    toast.error('❌ Báo giá của bạn bị từ chối', { duration: 3000 });
                    // Remove from history
                    removeFromHistoryStorage(requestId);
                }
            }

            // Check if request was assigned to someone else
            const requestResponse = await api.get(`/rescue-requests/${requestId}/provider-view`);
            if (requestResponse.data.status === 'ASSIGNED' && requestResponse.data.assignedProviderId !== user?.id) {
                // Another provider was chosen
                setHasPendingQuote(false);
                toast.error('💔 Khách hàng đã chọn provider khác', { duration: 4000 });
                // Remove from history
                removeFromHistoryStorage(requestId);
                // Redirect after delay
                setTimeout(() => {
                    router.push('/provider/active');
                }, 2000);
            }
        } catch (err) {
            console.error('Error checking quote status:', err);
        }
    };

    const removeFromHistoryStorage = (reqId: string) => {
        try {
            const saved = localStorage.getItem('provider_request_history');
            if (saved) {
                const history = JSON.parse(saved);
                const newHistory = history.filter((item: any) => item.id !== reqId);
                localStorage.setItem('provider_request_history', JSON.stringify(newHistory));
                console.log(`🗑️ Removed request ${reqId} from history`);
            }
        } catch (err) {
            console.error('Error removing from history:', err);
        }
    };

    // Timer countdown effect
    useEffect(() => {
        if (request?.quoteWindowTimeRemaining && request?.quoteWindowOpen) {
            // Initialize timer only if not already set
            if (timeLeft === null) {
                setTimeLeft(request.quoteWindowTimeRemaining);
            }
        }

        if (timeLeft === null || timeLeft <= 0) {
            return;
        }

        const interval = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev === null || prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [request?.quoteWindowTimeRemaining, request?.quoteWindowOpen, timeLeft]);

    // Keyboard navigation for image viewer
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (selectedImageIndex === null) return;

            if (e.key === 'Escape') {
                setSelectedImageIndex(null);
            } else if (e.key === 'ArrowLeft' && selectedImageIndex > 0) {
                setSelectedImageIndex(selectedImageIndex - 1);
            } else if (e.key === 'ArrowRight' && selectedImageIndex < imageUrls.length - 1) {
                setSelectedImageIndex(selectedImageIndex + 1);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedImageIndex, imageUrls.length]);

    const fetchRequestDetail = async () => {
        try {
            setIsLoading(true);

            // Reset quote states before fetching
            setHasPendingQuote(false);
            setHasRejectedQuote(false);
            setQuoteAccepted(false);
            setMyQuoteDetails(null);

            const response = await api.get(`/rescue-requests/${requestId}/provider-view`);
            const requestData = response.data;
            setRequest(requestData);

            console.log('📋 [Provider View] Request status:', requestData.status);
            console.log('📋 [Provider View] Assigned to:', requestData.assignedProviderId);
            console.log('📋 [Provider View] Current provider:', user?.id);

            // Check if provider has already sent a quote for this request
            if (requestData.status === 'MATCHING') {
                try {
                    const quotesResponse = await api.get(`/rescue-requests/${requestId}/quotes`);
                    const quotes = quotesResponse.data;

                    // Check if current provider has a quote
                    const myQuote = quotes.find((q: any) => q.providerId === user?.id);
                    if (myQuote) {
                        console.log('💰 [Provider View] Found existing quote:', myQuote.status);
                        setMyQuoteDetails(myQuote);
                        if (myQuote.status === 'PENDING') {
                            console.log('🟡 Setting hasPendingQuote = true');
                            setHasPendingQuote(true);
                        } else if (myQuote.status === 'REJECTED') {
                            console.log('🔴 Setting hasRejectedQuote = true');
                            setHasRejectedQuote(true);
                        } else if (myQuote.status === 'ACCEPTED') {
                            console.log('🟢 Setting quoteAccepted = true');
                            setQuoteAccepted(true);
                        }
                    }
                } catch (quoteErr) {
                    console.log('ℹ️ [Provider View] Could not fetch quotes (user endpoint)');
                }
            }

            setError(null);
        } catch (err: any) {
            console.error('Error fetching request:', err);

            const errorMessage = err.response?.data?.message || '';

            // Handle quote window closed errors
            if (errorMessage.includes('QUOTE_WINDOW_CLOSED')) {
                toast.error('⏰ Yêu cầu này đã hết hạn nhận báo giá!\n\nCửa sổ nhận báo giá đã đóng. Vui lòng tìm yêu cầu khác.', {
                    duration: 5000,
                });
                // Redirect back after a short delay
                setTimeout(() => {
                    router.push('/provider/active');
                }, 2000);
            } else if (errorMessage.includes('SLOTS_FULL')) {
                toast.error('📋 Đã đủ số lượng báo giá!\n\nYêu cầu này đã nhận đủ 3 báo giá.', {
                    duration: 4000,
                });
                setTimeout(() => {
                    router.push('/provider/active');
                }, 2000);
            } else {
                setError(errorMessage || 'Không thể tải thông tin request');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmitQuote = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        const priceNum = parseInt(price);
        const etaNum = parseInt(estimatedArrivalMinutes);

        if (!priceNum || priceNum < 10000) {
            toast.error('Giá báo giá phải từ 10,000 VNĐ trở lên');
            return;
        }

        if (!etaNum || etaNum < 1 || etaNum > 300) {
            toast.error('Thời gian đến phải từ 1-300 phút');
            return;
        }

        try {
            setIsSubmitting(true);

            await api.post(`/rescue-requests/${requestId}/quotes`, {
                price: priceNum,
                estimatedArrivalMinutes: etaNum,
                message: message || undefined,
            });

            toast.success('Đã gửi báo giá thành công! Chờ khách hàng phản hồi.');
            console.log('✅ Quote submitted successfully, updating UI directly...');

            // Remove from history after successful quote
            removeFromHistoryStorage(requestId);

            // Set pending quote state directly (don't wait for API fetch)
            setHasPendingQuote(true);
            setMyQuoteDetails({
                price: priceNum,
                estimatedArrivalMinutes: etaNum,
                message: message || '',
                status: 'PENDING',
                providerId: user?.id,
            });
            console.log('✅ Set hasPendingQuote = true, myQuoteDetails updated');

            // Reset form
            setPrice('');
            setEstimatedArrivalMinutes('');
            setMessage('');

            // Scroll to top to show the waiting UI
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err: any) {
            console.error('Error submitting quote:', err);

            const errorMessage = err.response?.data?.message || '';

            // Handle specific error cases
            if (errorMessage.includes('QUOTE_WINDOW_CLOSED')) {
                toast.error('⏰ Hết thời gian nhận báo giá!\n\nYêu cầu này đã đóng cửa sổ nhận báo giá (hết 90 giây hoặc đã đủ số lượng).\n\nVui lòng tìm yêu cầu khác!', {
                    duration: 6000,
                });
            } else if (errorMessage.includes('SLOTS_FULL')) {
                toast.error('📋 Đã đủ số lượng báo giá!\n\nYêu cầu này đã nhận đủ 3 báo giá rồi.\n\nVui lòng tìm yêu cầu khác!', {
                    duration: 5000,
                });
            } else if (errorMessage.includes('already sent a quote')) {
                toast.error('✋ Bạn đã gửi báo giá cho yêu cầu này rồi!');
            } else if (errorMessage.includes('not available for quotes')) {
                toast.error('❌ Yêu cầu này không còn nhận báo giá nữa.');
            } else {
                toast.error(errorMessage || 'Không thể gửi báo giá. Vui lòng thử lại!');
            }

            // Don't refresh if quotes endpoint is having issues
            // fetchRequestDetail();
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = async () => {
        // If provider hasn't sent a quote yet, decline to prevent spam
        if (request && request.status === 'MATCHING' && !hasPendingQuote) {
            try {
                await api.post(`/rescue-requests/${requestId}/decline`);
                console.log(`🚫 Declined request ${requestId} on cancel`);
            } catch (err) {
                console.error('Error declining request:', err);
                // Continue anyway
            }
        }

        router.push('/provider/active');
    };

    // Guard: Check authentication
    if (authLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!user || user.role !== 'PROVIDER') {
        router.push('/auth/login');
        return null;
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error || !request) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-sm p-8 max-w-md">
                    <h2 className="text-xl font-bold text-red-600 mb-4">Lỗi</h2>
                    <p className="text-gray-700 mb-4">{error || 'Không tìm thấy request'}</p>
                    <button
                        onClick={handleCancel}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Quay lại
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    {/* Only show back button if not waiting for quote response */}
                    {!hasPendingQuote && (
                        <button
                            onClick={handleCancel}
                            className="flex items-center text-gray-600 hover:text-gray-900 mb-2"
                        >
                            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Quay lại
                        </button>
                    )}
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold text-gray-900">Chi tiết yêu cầu cứu hộ</h1>
                        {/* Status Badge */}
                        <div className="flex items-center gap-2">
                            {request.status === 'MATCHING' && !hasPendingQuote && (
                                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                                    📋 Có thể gửi báo giá
                                </span>
                            )}
                            {request.status === 'MATCHING' && hasPendingQuote && (
                                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                                    ⏳ Đã gửi báo giá
                                </span>
                            )}
                            {request.status === 'ASSIGNED' && request.assignedProviderId === user?.id && (
                                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                                    ✅ Đã được chọn
                                </span>
                            )}
                            {request.status !== 'MATCHING' && request.assignedProviderId !== user?.id && (
                                <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
                                    🚫 Không khả dụng
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Quote Window Timer */}
            {request.status === 'MATCHING' && !hasPendingQuote && timeLeft !== null && timeLeft > 0 && (
                <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 px-4 shadow-md">
                    <div className="max-w-4xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="text-2xl">⏰</div>
                            <div>
                                <div className="text-sm font-medium">Thời gian còn lại để gửi báo giá</div>
                                <div className="text-xs opacity-90">Vui lòng gửi báo giá trước khi hết thời gian</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-3xl font-bold font-mono">
                                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                            </div>
                            <div className="text-xs opacity-90">
                                {timeLeft < 60 ? '⚠️ Còn ít thời gian!' : `${request.quoteCount || 0}/${request.maxQuotes || 3} báo giá`}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                {/* Request Info Card */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Thông tin yêu cầu</h2>

                    <div className="space-y-3">
                        <div>
                            <div className="text-sm text-gray-500">Khách hàng</div>
                            <div className="font-medium">{request.user.name}</div>
                            <div className="text-sm text-gray-600">{request.user.phoneNumber}</div>
                        </div>

                        <div>
                            <div className="text-sm text-gray-500">Loại sự cố</div>
                            <div className="font-medium">{incidentTypeLabels[request.incidentType] || request.incidentType}</div>
                        </div>

                        <div>
                            <div className="text-sm text-gray-500">Loại xe</div>
                            <div className="font-medium">{vehicleTypeLabels[request.vehicleType] || request.vehicleType}</div>
                        </div>

                        {request.description && (
                            <div>
                                <div className="text-sm text-gray-500">Mô tả</div>
                                <div className="text-gray-700">{request.description}</div>
                            </div>
                        )}

                        <div>
                            <div className="text-sm text-gray-500">Số điện thoại liên hệ</div>
                            <div className="font-medium">{request.contactPhone}</div>
                        </div>

                        <div>
                            <div className="text-sm text-gray-500">Vị trí đón</div>
                            <div className="text-gray-700">{request.pickupLocation.addressText}</div>
                        </div>

                        {request.dropoffLocation && (
                            <div>
                                <div className="text-sm text-gray-500">Vị trí trả</div>
                                <div className="text-gray-700">{request.dropoffLocation.addressText}</div>
                            </div>
                        )}

                        <div>
                            <div className="text-sm text-gray-500">Thời gian tạo</div>
                            <div className="text-gray-700">
                                {new Date(request.createdAt).toLocaleString('vi-VN')}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Media */}
                {request.media && request.media.length > 0 && (
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Hình ảnh & Video</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {request.media.map((item, index) => (
                                <div key={index} className="relative group">
                                    {item.mediaType === 'IMAGE' ? (
                                        <div
                                            onClick={() => {
                                                const imageIndex = request.media
                                                    .filter(m => m.mediaType === 'IMAGE')
                                                    .findIndex(m => m.publicUrl === item.publicUrl);
                                                setSelectedImageIndex(imageIndex);
                                            }}
                                            className="cursor-pointer overflow-hidden rounded-lg"
                                        >
                                            <img
                                                src={item.publicUrl}
                                                alt={`Media ${index + 1}`}
                                                className="w-full h-48 object-cover rounded-lg transition-transform group-hover:scale-110"
                                            />
                                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center">
                                                <span className="text-white opacity-0 group-hover:opacity-100 text-sm font-medium">Nhấn để xem</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <video
                                            src={item.publicUrl}
                                            controls
                                            className="w-full h-48 object-cover rounded-lg"
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Debug info - remove after testing */}
                {console.log('🔍 [Render] request.status:', request?.status, 'hasPendingQuote:', hasPendingQuote, 'myQuoteDetails:', myQuoteDetails ? 'exists' : 'null')}

                {/* Provider has pending quote - waiting for user response */}
                {request.status === 'MATCHING' && hasPendingQuote && myQuoteDetails && (
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6 shadow-lg">
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                                    <svg className="h-10 w-10 text-blue-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-xl font-bold text-blue-900 mb-2">
                                    ⏳ Đang chờ khách hàng phản hồi
                                </h3>
                                <p className="text-blue-800 mb-4">
                                    Bạn đã gửi báo giá cho yêu cầu này. Vui lòng chờ khách hàng xem xét và phản hồi.
                                </p>

                                {/* Quote Details */}
                                <div className="bg-white rounded-lg p-4 border border-blue-100 mb-4 space-y-3">
                                    <h4 className="font-semibold text-gray-900 mb-3">📝 Thông tin báo giá của bạn:</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-green-50 rounded-lg p-3">
                                            <div className="text-xs text-green-600 mb-1">Giá dịch vụ</div>
                                            <div className="text-lg font-bold text-green-900">
                                                {myQuoteDetails.price.toLocaleString()}₫
                                            </div>
                                        </div>
                                        <div className="bg-blue-50 rounded-lg p-3">
                                            <div className="text-xs text-blue-600 mb-1">Thời gian đến</div>
                                            <div className="text-lg font-bold text-blue-900">
                                                {myQuoteDetails.estimatedArrivalMinutes} phút
                                            </div>
                                        </div>
                                    </div>
                                    {myQuoteDetails.message && (
                                        <div className="pt-2 border-t border-gray-100">
                                            <div className="text-xs text-gray-600 mb-1">Lời nhắn</div>
                                            <div className="text-sm text-gray-800 italic">"{myQuoteDetails.message}"</div>
                                        </div>
                                    )}
                                    <div className="pt-2 border-t border-gray-100">
                                        <div className="text-xs text-gray-500">
                                            Trạng thái: <span className="font-semibold text-yellow-600">CHỞ PHẢN HỔI</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Status Info */}
                                <div className="bg-blue-100 rounded-lg p-4 flex items-start gap-3">
                                    <svg className="h-5 w-5 text-blue-700 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div className="text-sm text-blue-900">
                                        <p className="font-medium mb-1">🔄 Hệ thống đang tự động kiểm tra trạng thái</p>
                                        <p className="text-xs text-blue-800">Bạn sẽ nhận thông báo ngay khi khách hàng chấp nhận hoặc từ chối báo giá.</p>
                                        <p className="text-xs text-blue-700 font-semibold mt-2">⚠️ Vui lòng giữ màn hình này mở để nhận cập nhật</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Debug Quote Form check */}
                {console.log('🔍 [Render] Show quote form?', request?.status === 'MATCHING' && !hasPendingQuote)}

                {/* Quote Form - Only show if MATCHING and no pending quote */}
                {request.status === 'MATCHING' && !hasPendingQuote && (
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Gửi báo giá</h2>
                        <form onSubmit={handleSubmitQuote} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Giá dịch vụ (VNĐ) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    placeholder="Ví dụ: 300000"
                                    min="10000"
                                    required
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <div className="text-xs text-gray-500 mt-1">Tối thiểu 10,000 VNĐ</div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Thời gian đến (phút) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    value={estimatedArrivalMinutes}
                                    onChange={(e) => setEstimatedArrivalMinutes(e.target.value)}
                                    placeholder="Ví dụ: 15"
                                    min="1"
                                    max="300"
                                    required
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <div className="text-xs text-gray-500 mt-1">Từ 1-300 phút</div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Lời nhắn cho khách hàng
                                </label>
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Ví dụ: Tôi có kinh nghiệm 5 năm, xe cứu hộ đầy đủ trang thiết bị..."
                                    rows={3}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                                >
                                    {isSubmitting ? 'Đang gửi...' : 'Gửi báo giá'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    disabled={isSubmitting}
                                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                >
                                    Hủy
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Provider has been assigned - show success message */}
                {request.status === 'ASSIGNED' && request.assignedProviderId === user?.id && (
                    <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0">
                                <svg className="h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-green-900 mb-2">
                                    🎉 Bạn đã được khách hàng chọn!
                                </h3>
                                <p className="text-green-800 mb-1 font-medium">
                                    Báo giá của bạn đã được khách hàng chấp nhận.
                                </p>
                                <p className="text-green-700 mb-4 text-sm">
                                    Trạng thái: <span className="font-semibold">ASSIGNED</span> - Yêu cầu đã được gán cho bạn
                                </p>
                                <div className="bg-white rounded-lg p-4 space-y-3 border border-green-100">
                                    <p className="font-semibold text-gray-900">📝 Các bước tiếp theo:</p>
                                    <div className="flex items-start gap-3">
                                        <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                                            1
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">Liên hệ với khách hàng</p>
                                            <p className="text-sm text-gray-600">
                                                Gọi điện <a href={`tel:${request.contactPhone}`} className="text-blue-600 font-semibold">{request.contactPhone}</a> để xác nhận chi tiết
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                                            2
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">Chuẩn bị và xuất phát</p>
                                            <p className="text-sm text-gray-600">
                                                Kiểm tra thiết bị, phương tiện và di chuyển đến địa điểm
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                                            3
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">Cập nhật trạng thái</p>
                                            <p className="text-sm text-gray-600">
                                                Giữ liên lạc với khách hàng trong suốt quá trình
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-4 flex gap-3">
                                    <a
                                        href={`tel:${request.contactPhone}`}
                                        className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-center"
                                    >
                                        📞 Gọi khách hàng
                                    </a>
                                    <a
                                        href={`sms:${request.contactPhone}`}
                                        className="px-4 py-3 bg-white border-2 border-green-600 text-green-600 rounded-lg hover:bg-green-50 font-medium"
                                    >
                                        💬 Nhắn tin
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Request not available (assigned to another provider or other status) */}
                {request.status !== 'MATCHING' && request.assignedProviderId !== user?.id && (
                    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6">
                        <div className="flex items-start gap-3">
                            <svg className="h-6 w-6 text-yellow-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div className="flex-1">
                                <h3 className="font-semibold text-yellow-900 mb-2">
                                    ⚠️ Yêu cầu không còn khả dụng
                                </h3>
                                <p className="text-yellow-800 mb-3">
                                    Yêu cầu này không còn ở trạng thái MATCHING. Có thể đã có provider khác được khách hàng chọn hoặc yêu cầu đã hết hạn.
                                </p>
                                <div className="bg-white rounded-lg p-3 border border-yellow-100">
                                    <div className="text-sm text-gray-700">
                                        <span className="font-medium">Trạng thái hiện tại:</span> <span className="font-semibold text-yellow-800">{request.status}</span>
                                    </div>
                                    {request.assignedProviderId && request.assignedProviderId !== user?.id && (
                                        <div className="text-sm text-gray-700 mt-1">
                                            <span className="font-medium">Lý do:</span> Yêu cầu đã được gán cho provider khác
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => router.push('/provider/active')}
                                    className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium"
                                >
                                    Quay lại trang chủ
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Image Viewer Modal */}
            {selectedImageIndex !== null && imageUrls.length > 0 && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center p-4"
                    onClick={() => setSelectedImageIndex(null)}
                >
                    <div className="relative max-w-6xl max-h-[90vh] w-full h-full flex items-center justify-center">
                        {/* Close Button */}
                        <button
                            onClick={() => setSelectedImageIndex(null)}
                            className="absolute top-4 right-4 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-full p-3 transition-all z-10"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        {/* Previous Button */}
                        {selectedImageIndex > 0 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedImageIndex(selectedImageIndex - 1);
                                }}
                                className="absolute left-4 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-full p-3 transition-all"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                        )}

                        {/* Image */}
                        <div
                            className="relative max-w-full max-h-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img
                                src={imageUrls[selectedImageIndex]}
                                alt={`Image ${selectedImageIndex + 1}`}
                                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                            />
                            {/* Image Counter */}
                            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-60 text-white px-4 py-2 rounded-full text-sm">
                                {selectedImageIndex + 1} / {imageUrls.length}
                            </div>
                        </div>

                        {/* Next Button */}
                        {selectedImageIndex < imageUrls.length - 1 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedImageIndex(selectedImageIndex + 1);
                                }}
                                className="absolute right-4 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-full p-3 transition-all"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
