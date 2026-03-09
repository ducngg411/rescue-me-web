'use client';

import { useState, useEffect, lazy, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import { useChat } from '@/lib/hooks/useChat';
import VietMap from '@/components/VietMap';

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

            // Check provider's quote for all active statuses (needed to pre-fill PaymentSheet)
            const shouldFetchQuotes = ['MATCHING', 'ASSIGNED', 'IN_PROGRESS', 'ARRIVED', 'WORKING', 'PAYMENT_PENDING', 'PAID'].includes(requestData.status);
            if (shouldFetchQuotes) {
                try {
                    const quotesResponse = await api.get(`/rescue-requests/${requestId}/quotes`);
                    const quotes = quotesResponse.data;

                    // Check if current provider has a quote
                    const myQuote = quotes.find((q: any) => q.providerId === user?.id);
                    if (myQuote) {
                        console.log(' [Provider View] Found existing quote:', myQuote.status, 'price:', myQuote.price);
                        setMyQuoteDetails(myQuote);
                        if (requestData.status === 'MATCHING') {
                            if (myQuote.status === 'PENDING') {
                                console.log(' Setting hasPendingQuote = true');
                                setHasPendingQuote(true);
                            } else if (myQuote.status === 'REJECTED') {
                                console.log(' Setting hasRejectedQuote = true');
                                setHasRejectedQuote(true);
                            } else if (myQuote.status === 'ACCEPTED') {
                                console.log(' Setting quoteAccepted = true');
                                setQuoteAccepted(true);
                            }
                        }
                    }
                } catch (quoteErr) {
                    console.log('ℹ️ [Provider View] Could not fetch quotes');
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
                requestDetails={{
                    incidentType: request!.incidentType,
                    vehicleType: request!.vehicleType,
                    description: request!.description,
                    pickupLocation: request!.pickupLocation,
                    contactPhone: request!.contactPhone,
                }}
                acceptedQuotePrice={myQuoteDetails?.price ?? null}
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
        <div className="min-h-screen bg-gray-50 pb-20 md:pb-12">
            {/* Header */}
            <div className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 py-3 md:py-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleCancel}
                            className="flex items-center justify-center w-10 h-10 bg-gray-50 rounded-xl text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors flex-shrink-0 border-transparent"
                            title="Quay lại danh sách"
                        >
                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="flex flex-col">
                            <h1 className="text-base md:text-lg font-bold text-gray-900 leading-tight">Yêu cầu cứu hộ</h1>
                            <p className="text-xs md:text-sm font-medium text-gray-500">#{request.id.slice(0, 8).toUpperCase()}</p>
                        </div>
                    </div>
                    {/* Status Pill */}
                    <div className="flex items-center">
                        {request.status === 'MATCHING' && !hasPendingQuote && (
                            <span className="px-2.5 md:px-3 py-1 bg-orange-50/70 text-[#f97316] text-[11px] md:text-[13px] font-bold rounded-full flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#f97316]"></span>
                                Đang tìm provider
                            </span>
                        )}
                        {request.status === 'MATCHING' && hasPendingQuote && (
                            <span className="px-2.5 md:px-3 py-1 bg-yellow-50/70 text-yellow-600 text-[11px] md:text-[13px] font-bold rounded-full flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                                Đang chờ KH
                            </span>
                        )}
                        {request.status === 'ASSIGNED' && request.assignedProviderId === user?.id && (
                            <span className="px-2.5 md:px-3 py-1 bg-green-50/70 text-green-600 text-[11px] md:text-[13px] font-bold rounded-full flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                Đã được chọn
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 py-4 md:py-6">
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Left Column: Details */}
                    <div className="flex-1 space-y-4">
                        {/* Status Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Status Card */}
                            <div className="bg-white rounded-2xl p-4 md:p-5 border border-gray-100 shadow-sm flex items-center gap-3 md:gap-4">
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                                    {request.status === 'MATCHING' && !hasPendingQuote ? (
                                        <svg width="20" height="20" className="md:w-6 md:h-6" fill="none" stroke="#f97316" viewBox="0 0 24 24" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    ) : hasPendingQuote ? (
                                        <svg width="20" height="20" className="md:w-6 md:h-6" fill="none" stroke="#eab308" viewBox="0 0 24 24" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                        </svg>
                                    ) : (
                                        <svg width="20" height="20" className="md:w-6 md:h-6" fill="none" stroke="#6b7280" viewBox="0 0 24 24" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                        </svg>
                                    )}
                                </div>
                                <div>
                                    <div className="text-[10px] md:text-xs font-semibold text-gray-500 mb-0.5">Trạng thái hiện tại</div>
                                    <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                                        <span className="text-sm md:text-base font-bold text-[#1a1a2e]">
                                            {request.status === 'MATCHING' && !hasPendingQuote && 'Đang chờ báo giá'}
                                            {request.status === 'MATCHING' && hasPendingQuote && 'Đã gửi báo giá, chờ KH'}
                                            {request.status !== 'MATCHING' && request.assignedProviderId !== user?.id && 'Không khả dụng'}
                                            {request.status === 'ASSIGNED' && request.assignedProviderId === user?.id && 'Đã được chọn'}
                                        </span>
                                        {request.status === 'MATCHING' && (
                                            <div className="flex items-center gap-1.5 md:gap-2">
                                                <span className="px-1.5 md:px-2 py-0.5 bg-orange-100 text-[#f97316] text-[8px] md:text-[10px] font-bold rounded uppercase border border-[#fed7aa] flex-shrink-0">
                                                    Ưu tiên cao
                                                </span>
                                                <span className="px-1.5 md:px-2 py-0.5 bg-blue-50 text-blue-600 text-[8px] md:text-[10px] font-bold rounded uppercase border border-blue-200 flex-shrink-0 flex items-center gap-1">
                                                    <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                    </svg>
                                                    {request.quoteCount || 0}/{request.maxQuotes || 3} Báo giá
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Timer Card */}
                            {request.status === 'MATCHING' && !hasPendingQuote && timeLeft !== null && timeLeft > 0 ? (
                                <div className="rounded-2xl p-4 md:p-5 shadow-sm text-white flex items-center justify-between" style={{ background: '#f97316' }}>
                                    <div className="text-xs md:text-sm font-semibold opacity-90">
                                        THỜI GIAN CÒN LẠI<br />
                                        <span className="text-[9px] md:text-[10px] font-normal opacity-80 mt-1 block">Yêu cầu báo giá nhanh</span>
                                    </div>
                                    <div className="flex items-center gap-2 md:gap-3 text-center">
                                        <div className="flex flex-col">
                                            <span className="text-2xl md:text-3xl font-black leading-none">{Math.floor(timeLeft / 60)}</span>
                                            <span className="text-[8px] md:text-[10px] uppercase font-bold mt-1">Phút</span>
                                        </div>
                                        <div className="text-xl md:text-2xl font-bold opacity-70 mb-2 md:mb-3">:</div>
                                        <div className="flex flex-col">
                                            <span className="text-2xl md:text-3xl font-black leading-none">{String(timeLeft % 60).padStart(2, '0')}</span>
                                            <span className="text-[8px] md:text-[10px] uppercase font-bold mt-1">Giây</span>
                                        </div>
                                    </div>
                                </div>
                            ) : request.status === 'MATCHING' && hasPendingQuote ? (
                                <div className="rounded-2xl p-5 shadow-sm text-white flex items-center justify-between bg-yellow-500">
                                    <div className="text-sm font-semibold opacity-90">CHỜ KHÁCH HÀNG CHỌN</div>
                                    <svg className="w-8 h-8 animate-spin opacity-80" viewBox="0 0 24 24" fill="none">
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                                        <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" />
                                    </svg>
                                </div>
                            ) : null}
                        </div>

                        {/* Customer & Vehicle Info Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Customer Info */}
                            <div className="bg-white rounded-2xl p-4 md:p-5 border border-gray-100 shadow-sm space-y-3 md:space-y-4">
                                <div className="flex items-center gap-2 text-[#1a1a2e] font-semibold text-[13px] md:text-sm border-b pb-2 md:pb-3 border-gray-50">
                                    <svg width="16" height="16" className="md:w-[18px] md:h-[18px]" fill="none" stroke="#f97316" viewBox="0 0 24 24" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    Thông tin khách hàng
                                </div>
                                <div className="flex items-center gap-3 md:gap-4">
                                    <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-orange-100 flex-shrink-0 flex items-center justify-center text-lg md:text-xl font-bold text-orange-600">
                                        {request.user.name?.charAt(0).toUpperCase() || 'K'}
                                    </div>
                                    <div>
                                        <div className="font-bold text-[#1a1a2e] text-[15px] md:text-base mb-0.5 md:mb-1">{request.user.name}</div>
                                        <div className="flex items-center gap-1.5 text-xs md:text-sm font-medium text-gray-500">
                                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                            </svg>
                                            {request.contactPhone ? request.contactPhone.replace(/(\d{3})\d{4}(\d{3})/, '$1 *** $2') : 'Chưa có SĐT'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Vehicle Info */}
                            <div className="bg-white rounded-2xl p-4 md:p-5 border border-gray-100 shadow-sm space-y-3 md:space-y-4">
                                <div className="flex items-center gap-2 text-[#1a1a2e] font-semibold text-[13px] md:text-sm border-b pb-2 md:pb-3 border-gray-50">
                                    <svg width="16" height="16" className="md:w-[18px] md:h-[18px]" fill="none" stroke="#f97316" viewBox="0 0 24 24" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                    </svg>
                                    Thông tin phương tiện
                                </div>
                                <div className="grid grid-cols-2 gap-3 md:gap-4">
                                    <div>
                                        <p className="text-[9px] md:text-[10px] uppercase font-bold text-gray-400 mb-0.5 md:mb-1">Loại xe</p>
                                        <p className="text-[13px] md:text-sm font-bold text-[#1a1a2e] truncate">{vehicleTypeLabels[request.vehicleType] || request.vehicleType}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] md:text-[10px] uppercase font-bold text-gray-400 mb-0.5 md:mb-1">Biển số</p>
                                        <p className="text-[13px] md:text-sm font-bold text-[#1a1a2e] uppercase">{request.user.licensePlate || 'Không rõ'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] md:text-[10px] uppercase font-bold text-gray-400 mb-0.5 md:mb-1">Màu sắc</p>
                                        <p className="text-[13px] md:text-sm font-bold text-[#1a1a2e]">{request.user.vehicleColor || 'Không rõ'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] md:text-[10px] uppercase font-bold text-gray-400 mb-0.5 md:mb-1">Vấn đề</p>
                                        <p className="text-[13px] md:text-sm font-bold text-red-600 line-clamp-1">{incidentTypeLabels[request.incidentType] || request.incidentType}</p>
                                    </div>
                                </div>
                                {request.description && (
                                    <div className="pt-2">
                                        <p className="text-[9px] md:text-[10px] uppercase font-bold text-gray-400 mb-0.5 md:mb-1">Mô tả thêm</p>
                                        <p className="text-[13px] md:text-sm text-gray-700 italic border-l-2 border-gray-200 pl-2 line-clamp-2 md:line-clamp-none">"{request.description}"</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-2 text-[#1a1a2e] font-semibold text-sm mb-4">
                                <svg width="18" height="18" fill="none" stroke="#f97316" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                Vị trí cứu hộ
                            </div>
                            <p className="text-sm text-gray-700 mb-4 font-medium">{request.pickupLocation.addressText}</p>

                            {/* VietMap Component */}
                            <div className="w-full h-48 rounded-xl bg-gray-50 overflow-hidden relative border border-gray-100">
                                <VietMap
                                    center={[request.pickupLocation.lng, request.pickupLocation.lat]}
                                    zoom={15}
                                    showMarker={true}
                                />
                            </div>
                        </div>

                        {/* Media Section */}
                        {request.media && request.media.length > 0 && (
                            <div className="bg-white rounded-2xl p-4 md:p-5 border border-gray-100 shadow-sm">
                                <h2 className="text-[13px] md:text-sm font-semibold text-[#1a1a2e] mb-3 md:mb-4 flex items-center gap-2">
                                    <svg width="16" height="16" className="md:w-[18px] md:h-[18px]" fill="none" stroke="#f97316" viewBox="0 0 24 24" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    Hình ảnh sự cố ({request.media.length})
                                </h2>
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 md:gap-3">
                                    {request.media.map((item, index) => (
                                        <div key={index} className="aspect-square relative group">
                                            {item.mediaType === 'IMAGE' ? (
                                                <div
                                                    onClick={() => setSelectedImageIndex(request.media.filter(m => m.mediaType === 'IMAGE').findIndex(m => m.publicUrl === item.publicUrl))}
                                                    className="cursor-pointer w-full h-full rounded-xl overflow-hidden border border-gray-200 bg-gray-50"
                                                >
                                                    <img src={item.publicUrl} alt={`Media ${index}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                                                        <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                                        </svg>
                                                    </div>
                                                </div>
                                            ) : (
                                                <video src={item.publicUrl} controls className="w-full h-full object-cover rounded-xl border border-gray-200 bg-black" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Quoting Form / Actions */}
                    <div className="w-full lg:w-[380px] flex-shrink-0 mt-2 md:mt-0">
                        {request.status === 'MATCHING' && !hasPendingQuote ? (
                            <div className="bg-white rounded-3xl p-5 md:p-6 border border-gray-100 shadow-lg md:sticky top-24">
                                <div className="flex items-center gap-3 mb-5 md:mb-6">
                                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                                        <svg width="20" height="20" fill="none" stroke="#f97316" viewBox="0 0 24 24" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                        </svg>
                                    </div>
                                    <h2 className="text-base md:text-lg font-bold text-[#1a1a2e]">Gửi báo giá nhanh</h2>
                                </div>

                                <form onSubmit={handleSubmitQuote} className="space-y-4 md:space-y-5">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase">Giá dịch vụ dự kiến (VNĐ)</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={price}
                                                onChange={(e) => setPrice(e.target.value)}
                                                placeholder="Ví dụ: 300000"
                                                min="10000"
                                                required
                                                className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#f97316] outline-none transition-colors text-sm font-semibold"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">₫</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase">Thời gian đến dự kiến</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={estimatedArrivalMinutes}
                                                onChange={(e) => setEstimatedArrivalMinutes(e.target.value)}
                                                placeholder="Ví dụ: 15"
                                                min="1"
                                                max="300"
                                                required
                                                className="w-full pl-4 pr-14 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#f97316] outline-none transition-colors text-sm font-semibold"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-semibold">Phút</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase">Ghi chú cho khách hàng</label>
                                        <textarea
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            placeholder="Mô tả sơ bộ phương án cứu hộ..."
                                            rows={3}
                                            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#f97316] outline-none transition-colors text-sm resize-none"
                                        />
                                    </div>

                                    <div className="pt-2">
                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="w-full py-3.5 rounded-xl font-bold text-white uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                            style={{
                                                background: 'linear-gradient(135deg, #f97316 0%, #ea6c0a 100%)',
                                                boxShadow: '0 4px 14px rgba(249,115,22,0.3)'
                                            }}
                                        >
                                            {isSubmitting ? 'Đang gửi...' : 'GỬI BÁO GIÁ'}
                                            {!isSubmitting && (
                                                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                                                </svg>
                                            )}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleCancel}
                                            disabled={isSubmitting}
                                            className="w-full mt-3 py-3 rounded-xl font-semibold text-gray-500 hover:text-gray-800 transition-colors text-sm"
                                        >
                                            Hủy bỏ yêu cầu
                                        </button>
                                    </div>

                                    <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex gap-3">
                                        <svg width="16" height="16" fill="none" stroke="#f97316" viewBox="0 0 24 24" className="flex-shrink-0 mt-0.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <p className="text-[10px] text-gray-600 leading-relaxed">
                                            Bằng việc gửi báo giá, bạn cam kết có mặt đúng thời hạn và mức giá đã đề xuất. Phí hệ thống (10%) sẽ được trừ sau khi hoàn tất giao dịch.
                                        </p>
                                    </div>
                                </form>
                            </div>
                        ) : request.status === 'MATCHING' && hasPendingQuote && myQuoteDetails ? (
                            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-lg sticky top-24">
                                <div className="text-center pb-6 border-b border-gray-100">
                                    <div className="w-16 h-16 mx-auto bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-4">
                                        <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <h2 className="text-xl font-bold text-[#1a1a2e] mb-2">Đã gửi báo giá!</h2>
                                    <p className="text-sm text-gray-500">Hệ thống đang chờ khách hàng xem xét và lựa chọn.</p>
                                </div>

                                <div className="py-6 space-y-4">
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Mức giá đề xuất</p>
                                        <p className="text-xl font-black text-green-600">{myQuoteDetails.price.toLocaleString()}đ</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Thời gian đến</p>
                                        <p className="text-base font-bold text-[#1a1a2e]">{myQuoteDetails.estimatedArrivalMinutes} phút</p>
                                    </div>
                                    {myQuoteDetails.message && (
                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Lời nhắn của bạn</p>
                                            <p className="text-sm font-medium italic text-gray-700">"{myQuoteDetails.message}"</p>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                                    <p className="text-xs font-semibold text-blue-800 text-center animate-pulse">
                                        Vui lòng giữ màn hình này và không rời đi...
                                    </p>
                                </div>
                            </div>
                        ) : request.status !== 'MATCHING' && request.assignedProviderId !== user?.id ? (
                            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-lg sticky top-24">
                                <div className="text-center pb-6">
                                    <div className="w-16 h-16 mx-auto bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
                                        <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">Yêu cầu đã kết thúc!</h2>
                                    <p className="text-sm text-gray-500 mb-6">Yêu cầu này đã được tài xế khác nhận hoặc đã quá hạn gửi báo giá.</p>
                                    <button
                                        onClick={handleCancel}
                                        className="w-full py-3.5 rounded-xl font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                                    >
                                        Quay về màn hình chính
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
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
