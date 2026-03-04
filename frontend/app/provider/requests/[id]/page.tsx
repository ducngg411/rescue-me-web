'use client';

import { useState, useEffect, lazy, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import { useChat } from '@/lib/hooks/useChat';

const ChatModal = lazy(() => import('@/components/ChatModal'));

const ProviderNavigationView = dynamic(
    () => import('@/components/ProviderNavigationView'),
    { ssr: false, loading: () => <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" /></div> }
);

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
        licensePlate?: string | null;
        vehicleColor?: string | null;
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
    const [showNavigationMap, setShowNavigationMap] = useState(false);
    const [isStartingNav, setIsStartingNav] = useState(false);
    const [selectedConfirmImage, setSelectedConfirmImage] = useState<string | null>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);

    // Quote window timer
    const [timeLeft, setTimeLeft] = useState<number | null>(null);

    // Chat hook — subscribe for unread count as soon as we have user.id + requestId
    // (enabled independently of request loading so the badge shows immediately)
    const { sendMessage: sendChatMessage, unreadCount: chatUnreadCount } = useChat({
        requestId: requestId ?? '__none__',
        currentUserId: user?.id ?? '',
        currentUserRole: 'PROVIDER',
        currentUserName: user?.name ?? 'Provider',
        enabled: !!(user?.id && requestId),
    });


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
            console.log(' Quote submitted successfully, updating UI directly...');

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
            console.log(' Set hasPendingQuote = true, myQuoteDetails updated');

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

    // Confirmation + Navigation flow: show details first, map after "Bắt đầu di chuyển"
    const isAssignedToMe = request && (
        (request.status === 'ASSIGNED' && request.assignedProviderId === user?.id) ||
        quoteAccepted
    );

    if (isAssignedToMe && showNavigationMap) {
        return (
            <ProviderNavigationView
                pickupLocation={request!.pickupLocation}
                user={{ name: request!.user?.name, phoneNumber: request!.contactPhone }}
                eta={myQuoteDetails?.estimatedArrivalMinutes ?? null}
                requestId={requestId}
                customerName={request!.user?.name ?? 'Khách hàng'}
                onBack={() => setShowNavigationMap(false)}
                onCompleted={() => router.push('/provider/active')}
            />
        );
    }

    if (isAssignedToMe && !showNavigationMap) {
        const req = request!;
        const C = {
            orange: '#f97316', orangeDark: '#ea6c0a', orangeLight: '#fff7ed',
            navy: '#1a1a2e', gray: '#6b7280', border: '#f1f5f9', bg: '#f8fafc',
        };
        return (
            <div className="min-h-screen" style={{ background: C.bg, fontFamily: 'Poppins, sans-serif' }}>
                {/* Header */}
                <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center gap-3" style={{ borderColor: C.border }}>
                    <div className="flex-1">
                        <p className="text-xs font-semibold" style={{ color: C.gray }}>Báo giá được chấp nhận</p>
                        <h1 className="text-sm font-bold" style={{ color: C.navy }}>Yêu cầu cứu hộ #{req.id.slice(0, 8).toUpperCase()}</h1>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        Được chọn
                    </div>
                </div>

                <div className="px-4 py-5 max-w-lg mx-auto space-y-4">

                    {/* Celebration card */}
                    <div className="bg-white rounded-2xl p-5 text-center" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                        <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-3xl" style={{ background: '#f0fdf4' }}>
                            🎉
                        </div>
                        <h2 className="text-base font-bold mb-1" style={{ color: C.navy }}>Bạn được chọn!</h2>
                        <p className="text-sm" style={{ color: C.gray }}>Khách hàng đã chấp nhận báo giá của bạn. Hãy xem thông tin bên dưới và chuẩn bị xuất phát.</p>
                    </div>

                    {/* Customer info */}
                    <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                        <p className="text-xs font-semibold mb-3" style={{ color: C.gray }}>THÔNG TIN KHÁCH HÀNG</p>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold" style={{ background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})` }}>
                                {(req.user?.name || 'K').charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <p className="text-sm font-bold" style={{ color: C.navy }}>{req.user?.name || 'Khách hàng'}</p>
                                <p className="text-xs" style={{ color: C.gray }}>{req.contactPhone}</p>
                            </div>
                            <a
                                href={`tel:${req.contactPhone}`}
                                className="ml-auto w-9 h-9 rounded-xl flex items-center justify-center"
                                style={{ background: '#f0fdf4' }}
                            >
                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                            </a>
                        </div>
                    </div>

                    {/* Rescue details */}
                    <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                        <p className="text-xs font-semibold mb-3" style={{ color: C.gray }}>THÔNG TIN CỨU HỘ</p>
                        <div className="space-y-3">
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.orangeLight }}>
                                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-[10px] font-medium" style={{ color: C.gray }}>Loại sự cố</p>
                                    <p className="text-sm font-semibold" style={{ color: C.navy }}>{incidentTypeLabels[req.incidentType] || req.incidentType}</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.orangeLight }}>
                                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 1M13 16H7m6 0l2 1m0-1h1a2 2 0 002-2V9a1 1 0 00-.293-.707L20 7H13v9z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-[10px] font-medium" style={{ color: C.gray }}>Loại xe</p>
                                    <p className="text-sm font-semibold" style={{ color: C.navy }}>{vehicleTypeLabels[req.vehicleType] || req.vehicleType}</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.orangeLight }}>
                                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-medium" style={{ color: C.gray }}>Vị trí đón</p>
                                    <p className="text-sm font-semibold" style={{ color: C.navy }}>{req.pickupLocation.addressText}</p>
                                </div>
                            </div>
                            {req.description && (
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.orangeLight }}>
                                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-medium" style={{ color: C.gray }}>Mô tả</p>
                                        <p className="text-sm" style={{ color: C.navy }}>{req.description}</p>
                                    </div>
                                </div>
                            )}
                            {req.user?.licensePlate && (
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.orangeLight }}>
                                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2}>
                                            <rect x="2" y="7" width="20" height="10" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 11h.01M18 11h.01M9 11h6" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-medium" style={{ color: C.gray }}>Biển số xe</p>
                                        <p className="text-sm font-semibold" style={{ color: C.navy }}>{req.user.licensePlate}</p>
                                    </div>
                                </div>
                            )}
                            {req.user?.vehicleColor && (
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.orangeLight }}>
                                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-medium" style={{ color: C.gray }}>Màu xe</p>
                                        <p className="text-sm font-semibold" style={{ color: C.navy }}>{req.user.vehicleColor}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Media / Photos & Videos */}
                    {req.media && req.media.length > 0 && (
                        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                            <p className="text-xs font-semibold mb-3" style={{ color: C.gray }}>MEDIA TỪ KHÁCH ({req.media.length})</p>
                            <div className="grid grid-cols-3 gap-2">
                                {req.media.map((item, idx) => {
                                    if (item.mediaType === 'IMAGE') {
                                        const imageOnlyIndex = req.media
                                            .filter(m => m.mediaType === 'IMAGE')
                                            .findIndex(m => m.publicUrl === item.publicUrl);
                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => setSelectedImageIndex(imageOnlyIndex)}
                                                className="aspect-square rounded-xl overflow-hidden relative"
                                                style={{ background: C.bg }}
                                            >
                                                <img
                                                    src={item.publicUrl}
                                                    alt={`Ảnh ${idx + 1}`}
                                                    className="w-full h-full object-cover"
                                                />
                                                {/* Overlay hint */}
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.3)' }}>
                                                    <svg width="20" height="20" fill="white" viewBox="0 0 24 24">
                                                        <path d="M15 3l2.3 2.3-2.89 2.87 1.42 1.42L18.7 6.7 21 9V3h-6zM3 9l2.3-2.3 2.87 2.89 1.42-1.42L6.7 5.3 9 3H3v6zM9 21l-2.3-2.3 2.89-2.87-1.42-1.42L5.3 17.3 3 15v6h6zm12-6l-2.3 2.3-2.87-2.89-1.42 1.42 2.89 2.87L15 21h6v-6z" />
                                                    </svg>
                                                </div>
                                            </button>
                                        );
                                    } else {
                                        return (
                                            <div key={idx} className="aspect-square rounded-xl overflow-hidden" style={{ background: '#000' }}>
                                                <video
                                                    src={item.publicUrl}
                                                    controls
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        );
                                    }
                                })}
                            </div>
                        </div>
                    )}

                    {/* My quote summary */}
                    {myQuoteDetails && (
                        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                            <p className="text-xs font-semibold mb-3" style={{ color: C.gray }}>BÁO GIÁ CỦA BẠN</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-xl p-3" style={{ background: C.bg }}>
                                    <p className="text-[10px]" style={{ color: C.gray }}>Giá</p>
                                    <p className="text-base font-bold" style={{ color: C.navy }}>{Number(myQuoteDetails.price).toLocaleString('vi-VN')}₫</p>
                                </div>
                                <div className="rounded-xl p-3" style={{ background: C.bg }}>
                                    <p className="text-[10px]" style={{ color: C.gray }}>Thời gian đến</p>
                                    <p className="text-base font-bold" style={{ color: C.navy }}>{myQuoteDetails.estimatedArrivalMinutes} phút</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CTA */}
                    <div className="pb-4">
                        <button
                            onClick={async () => {
                                setIsStartingNav(true);
                                try {
                                    await api.patch(`/rescue-requests/${requestId}/start-navigation`);
                                    // Send automatic chat message to customer
                                    const etaText = myQuoteDetails?.estimatedArrivalMinutes
                                        ? `khoảng ${myQuoteDetails.estimatedArrivalMinutes} phút`
                                        : 'sớm nhất có thể';
                                    await sendChatMessage(
                                        `Xin chào! Provider đang bắt đầu di chuyển đến vị trí của bạn. Tôi sẽ có mặt trong ${etaText}. Vui lòng ở lại vị trí và chờ tôi nhé! `
                                    );
                                } catch (err: any) {
                                    // Ignore if already IN_PROGRESS
                                    console.warn('start-navigation:', err?.response?.data?.message);
                                } finally {
                                    setIsStartingNav(false);
                                }
                                setShowNavigationMap(true);
                            }}
                            disabled={isStartingNav}
                            className="w-full py-4 rounded-2xl text-base font-bold text-white flex items-center justify-center gap-3 active:scale-[0.98] transition-transform"
                            style={{
                                background: `linear-gradient(135deg, ${C.orange} 0%, ${C.orangeDark} 100%)`,
                                boxShadow: `0 6px 20px ${C.orange}50`,
                                opacity: isStartingNav ? 0.7 : 1,
                            }}
                        >
                            {isStartingNav ? (
                                <>
                                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                                        <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8H4z" />
                                    </svg>
                                    Đang xác nhận...
                                </>
                            ) : (
                                <>
                                    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                    </svg>
                                    Bắt đầu di chuyển
                                </>
                            )}
                        </button>
                        <p className="text-center text-xs mt-2" style={{ color: C.gray }}>
                            Bản đồ điều hướng sẽ mở sau khi bạn bấm
                        </p>
                    </div>

                    {/* Chat button for provider (before navigation) */}
                    <button
                        onClick={() => setIsChatOpen(true)}
                        className="relative w-full py-3.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                        style={{ background: C.orangeLight, color: C.orange, border: `1.5px solid ${C.orange}30` }}
                    >
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        Nhắn tin với khách hàng
                        {chatUnreadCount > 0 && (
                            <span
                                className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                                style={{ background: '#ef4444', boxShadow: '0 1px 4px rgba(239,68,68,0.5)' }}
                            >
                                {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
                            </span>
                        )}
                    </button>

                </div>

                {/* Image Viewer Modal (for isAssignedToMe view) */}
                {selectedImageIndex !== null && imageUrls.length > 0 && (
                    <div
                        className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center p-4"
                        onClick={() => setSelectedImageIndex(null)}
                    >
                        <div className="relative max-w-6xl max-h-[90vh] w-full h-full flex items-center justify-center">
                            {/* Close Button */}
                            <button
                                onClick={() => setSelectedImageIndex(null)}
                                className="absolute top-4 right-4 rounded-full p-2.5 transition-all z-10 flex items-center justify-center"
                                style={{ background: 'rgba(0,0,0,0.6)', border: '1.5px solid rgba(255,255,255,0.3)' }}
                                title="Đóng"
                            >
                                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>

                            {/* Previous Button */}
                            {selectedImageIndex > 0 && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setSelectedImageIndex(selectedImageIndex - 1); }}
                                    className="absolute left-4 rounded-full p-2.5 transition-all flex items-center justify-center"
                                    style={{ background: 'rgba(0,0,0,0.5)', border: '1.5px solid rgba(255,255,255,0.25)' }}
                                >
                                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                            )}

                            {/* Image */}
                            <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
                                <img
                                    src={imageUrls[selectedImageIndex]}
                                    alt={`Image ${selectedImageIndex + 1}`}
                                    className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                                />
                                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-60 text-white px-4 py-2 rounded-full text-sm">
                                    {selectedImageIndex + 1} / {imageUrls.length}
                                </div>
                            </div>

                            {/* Next Button */}
                            {selectedImageIndex < imageUrls.length - 1 && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setSelectedImageIndex(selectedImageIndex + 1); }}
                                    className="absolute right-4 rounded-full p-2.5 transition-all flex items-center justify-center"
                                    style={{ background: 'rgba(0,0,0,0.5)', border: '1.5px solid rgba(255,255,255,0.25)' }}
                                >
                                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Chat Modal for provider */}
                {isChatOpen && user && request && (
                    <Suspense fallback={null}>
                        <ChatModal
                            requestId={requestId}
                            currentUserId={user.id}
                            currentUserRole="PROVIDER"
                            currentUserName={user.name ?? 'Provider'}
                            otherPartyName={request.user?.name ?? 'Khách hàng'}
                            onClose={() => setIsChatOpen(false)}
                        />
                    </Suspense>
                )}
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
                                    Đã được chọn
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

                        {request.user?.licensePlate && (
                            <div>
                                <div className="text-sm text-gray-500">Biển số xe</div>
                                <div className="font-medium">{request.user.licensePlate}</div>
                            </div>
                        )}

                        {request.user?.vehicleColor && (
                            <div>
                                <div className="text-sm text-gray-500">Màu xe</div>
                                <div className="font-medium">{request.user.vehicleColor}</div>
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
                            className="absolute top-4 right-4 rounded-full p-2.5 transition-all z-10 flex items-center justify-center"
                            style={{ background: 'rgba(0,0,0,0.6)', border: '1.5px solid rgba(255,255,255,0.3)' }}
                            title="Đóng"
                        >
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        {/* Previous Button */}
                        {selectedImageIndex > 0 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedImageIndex(selectedImageIndex - 1);
                                }}
                                className="absolute left-4 rounded-full p-2.5 transition-all flex items-center justify-center"
                                style={{ background: 'rgba(0,0,0,0.5)', border: '1.5px solid rgba(255,255,255,0.25)' }}
                            >
                                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
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
                                className="absolute right-4 rounded-full p-2.5 transition-all flex items-center justify-center"
                                style={{ background: 'rgba(0,0,0,0.5)', border: '1.5px solid rgba(255,255,255,0.25)' }}
                            >
                                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
