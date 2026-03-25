'use client';

import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import api from '@/lib/api';
import { displayOrderCode } from '@/lib/reconciliation';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import { useChat } from '@/lib/hooks/useChat';
import VietMap from '@/components/VietMap';
import AvatarImage from '@/components/AvatarImage';
import { matchingQuoteWindowSecondsRemaining } from '@/lib/matchingQuoteWindowCountdown';

const ChatModal = lazy(() => import('@/components/ChatModal'));

// Translate raw vehicle color values to Vietnamese
const VEHICLE_COLOR_LABELS: Record<string, string> = {
    black: 'Đen', white: 'Trắng', red: 'Đỏ', blue: 'Xanh dương',
    green: 'Xanh lá', silver: 'Bạc', gray: 'Xám', grey: 'Xám',
    yellow: 'Vàng', orange: 'Cam', brown: 'Nâu', purple: 'Tím',
    pink: 'Hồng', gold: 'Vàng đồng', beige: 'Be',
};
const translateColor = (color: string) =>
    VEHICLE_COLOR_LABELS[color?.toLowerCase()] ?? color;

const ProviderNavigationView = dynamic(
    () => import('@/components/ProviderNavigationView'),
    { ssr: false, loading: () => <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" /></div> }
);

interface RescueRequest {
    id: string;
    orderCode?: string | null;
    incidentType: string;
    vehicleType: string;
    /** Snapshot on the request (guests); falls back to user profile for older rows */
    licensePlate?: string | null;
    vehicleColor?: string | null;
    description: string;
    contactPhone: string;
    requesterType?: 'USER' | 'GUEST';
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
        avatar?: string | null;
        licensePlate?: string | null;
        vehicleColor?: string | null;
    } | null;
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
    expiresAt?: string | null;
}

/** Plate/color stored on the request (guest) or legacy User profile */
function requesterPlate(r: RescueRequest) {
    return r.licensePlate?.trim() || r.user?.licensePlate || null;
}
function requesterVehicleColorRaw(r: RescueRequest) {
    return r.vehicleColor?.trim() || r.user?.vehicleColor || null;
}

export default function ProviderRequestDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { user, loading: authLoading } = useAuth();
    const { t } = useLanguage();
    const requestId = params.id as string;

    const [request, setRequest] = useState<RescueRequest | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Track if provider has a pending quote for this request
    const [hasPendingQuote, setHasPendingQuote] = useState(false);
    const [hasRejectedQuote, setHasRejectedQuote] = useState(false);
    const [myQuoteDetails, setMyQuoteDetails] = useState<any>(null);
    const [quoteAccepted, setQuoteAccepted] = useState(false);
    /** Customer accepted another provider; this quote was superseded (CANCELLED) */
    const [lostSelection, setLostSelection] = useState(false);
    /** Initial load 403 — no request payload; still show message + manual back */
    const [lostAccessWithoutRequest, setLostAccessWithoutRequest] = useState(false);
    const [showNavigationMap, setShowNavigationMap] = useState(false);
    const [isStartingNav, setIsStartingNav] = useState(false);
    const [selectedConfirmImage, setSelectedConfirmImage] = useState<string | null>(null);
    const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);

    // Quote window timer
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const requestRef = useRef<RescueRequest | null>(null);
    requestRef.current = request;
    const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);

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
        setLostAccessWithoutRequest(false);
    }, [requestId]);

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
        }, 3000); // Quote slots + customer decision — refresh often enough to stay in sync

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
                    setLostSelection(false);
                    // Refresh request to get ASSIGNED status
                    fetchRequestDetail();
                    // Remove from history
                    removeFromHistoryStorage(requestId);
                    return;
                } else if (myQuote.status === 'REJECTED') {
                    // My quote was rejected
                    setHasPendingQuote(false);
                    setHasRejectedQuote(true);
                    setLostSelection(false);
                    toast.error('❌ ' + t('provider.requestDetail.quoteRejected'), { duration: 3000 });
                    // Remove from history
                    removeFromHistoryStorage(requestId);
                    return;
                } else if (myQuote.status === 'CANCELLED' || myQuote.status === 'EXPIRED') {
                    // Another provider was chosen (or quote expired)
                    setHasPendingQuote(false);
                    setLostSelection(true);
                    toast.error(t('provider.requestDetail.otherProviderChosenToast'), { duration: 5000 });
                    removeFromHistoryStorage(requestId);
                    try {
                        const rr = await api.get(`/rescue-requests/${requestId}/provider-view`);
                        setRequest((prev) => (prev ? { ...prev, ...rr.data } : rr.data));
                    } catch {
                        /* giữ UI hiện tại + banner */
                    }
                    return;
                }
            }

            const requestResponse = await api.get(`/rescue-requests/${requestId}/provider-view`);
            const rd = requestResponse.data;

            // While MATCHING: keep "x/y báo giá" in sync when other providers submit
            if (rd.status === 'MATCHING') {
                setRequest((prev) =>
                    prev
                        ? {
                              ...prev,
                              status: rd.status,
                              quoteCount: rd.quoteCount,
                              maxQuotes: rd.maxQuotes ?? prev.maxQuotes,
                              quoteWindowOpen: rd.quoteWindowOpen,
                              quoteWindowTimeRemaining: rd.quoteWindowTimeRemaining,
                              quoteWindowExpiresAt: rd.quoteWindowExpiresAt ?? prev.quoteWindowExpiresAt,
                          }
                        : prev
                );
            }

            // Backup: assigned to someone else (quotes list may lag)
            if (rd.status === 'ASSIGNED' && rd.assignedProviderId !== user?.id) {
                setHasPendingQuote(false);
                setLostSelection(true);
                toast.error(t('provider.requestDetail.otherProviderChosenToast'), { duration: 5000 });
                removeFromHistoryStorage(requestId);
                setRequest((prev) => (prev ? { ...prev, ...rd } : prev));
            }
        } catch (err: any) {
            if (err.response?.status === 403) {
                setHasPendingQuote(false);
                setLostSelection(true);
                toast.error(t('provider.requestDetail.otherProviderChosenToast'), { duration: 5000 });
                removeFromHistoryStorage(requestId);
            } else {
                console.error('Error checking quote status:', err);
            }
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

    // MATCHING + chưa gửi báo giá: vẫn phải đồng bộ x/y báo giá khi provider khác đã gửi (trước đây không poll → kẹt 0/3)
    useEffect(() => {
        if (!user || user.role !== 'PROVIDER') return;
        if (hasPendingQuote || lostSelection || quoteAccepted) return;
        if (!request || request.status !== 'MATCHING') return;

        const applyMatchingFields = (rd: RescueRequest) => {
            if (rd.status !== 'MATCHING') return;
            setRequest((prev) =>
                prev
                    ? {
                          ...prev,
                          status: rd.status,
                          quoteCount: rd.quoteCount,
                          maxQuotes: rd.maxQuotes ?? prev.maxQuotes,
                          quoteWindowOpen: rd.quoteWindowOpen,
                          quoteWindowTimeRemaining: rd.quoteWindowTimeRemaining,
                          quoteWindowExpiresAt: rd.quoteWindowExpiresAt ?? prev.quoteWindowExpiresAt,
                      }
                    : prev
            );
        };

        const syncWhileDeciding = async () => {
            try {
                const { data: rd } = await api.get(`/rescue-requests/${requestId}/provider-view`);
                applyMatchingFields(rd);

                if (rd.status === 'ASSIGNED' && rd.assignedProviderId && rd.assignedProviderId !== user.id) {
                    setLostSelection(true);
                    toast.error(t('provider.requestDetail.otherProviderChosenToast'), { duration: 5000 });
                    removeFromHistoryStorage(requestId);
                    setRequest((prev) =>
                        prev
                            ? {
                                  ...prev,
                                  status: rd.status,
                                  assignedProviderId: rd.assignedProviderId,
                                  quoteCount: rd.quoteCount ?? prev.quoteCount,
                                  maxQuotes: rd.maxQuotes ?? prev.maxQuotes,
                                  quoteWindowOpen: rd.quoteWindowOpen ?? false,
                              }
                            : prev
                    );
                }
            } catch (err: any) {
                const errorMessage = err.response?.data?.message || '';
                if (errorMessage.includes('QUOTE_WINDOW_CLOSED')) {
                    toast.error('⏰ Yêu cầu này đã hết hạn nhận báo giá!\n\nCửa sổ nhận báo giá đã đóng. Vui lòng tìm yêu cầu khác.', {
                        duration: 5000,
                    });
                    setTimeout(() => router.push('/provider/active'), 2000);
                } else if (errorMessage.includes('SLOTS_FULL')) {
                    toast.error('📋 Đã đủ số lượng báo giá!\n\nYêu cầu này đã nhận đủ 3 báo giá.', {
                        duration: 4000,
                    });
                    setTimeout(() => router.push('/provider/active'), 2000);
                } else if (err.response?.status === 403) {
                    setLostSelection(true);
                    toast.error(t('provider.requestDetail.otherProviderChosenToast'), { duration: 5000 });
                    removeFromHistoryStorage(requestId);
                }
            }
        };

        void syncWhileDeciding();
        const interval = setInterval(syncWhileDeciding, 3000);
        const onFocus = () => void syncWhileDeciding();
        window.addEventListener('focus', onFocus);
        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', onFocus);
        };
    }, [requestId, user, request?.status, hasPendingQuote, lostSelection, quoteAccepted]);

    // Timer from server deadline (aligned with guest/customer countdown)
    useEffect(() => {
        const r = request;
        const active =
            r?.status === 'MATCHING' &&
            !hasPendingQuote &&
            r.quoteWindowOpen === true;

        if (!active) {
            setTimeLeft(null);
            return;
        }

        const tick = () => matchingQuoteWindowSecondsRemaining(requestRef.current);

        setTimeLeft(tick());
        const interval = setInterval(() => setTimeLeft(tick()), 1000);
        return () => clearInterval(interval);
    }, [
        request?.status,
        request?.quoteWindowOpen,
        request?.quoteWindowExpiresAt,
        request?.expiresAt,
        hasPendingQuote,
    ]);

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
            setLostSelection(false);
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
                            } else if (myQuote.status === 'CANCELLED' || myQuote.status === 'EXPIRED') {
                                setHasPendingQuote(false);
                                setLostSelection(true);
                            }
                        } else if (
                            requestData.assignedProviderId &&
                            requestData.assignedProviderId !== user?.id &&
                            (myQuote.status === 'CANCELLED' || myQuote.status === 'EXPIRED')
                        ) {
                            setHasPendingQuote(false);
                            setLostSelection(true);
                        }
                    }
                } catch (quoteErr) {
                    console.log('ℹ️ [Provider View] Could not fetch quotes');
                }
            }

            setError(null);
            setLostAccessWithoutRequest(false);
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
            } else if (err.response?.status === 403) {
                setRequest(null);
                toast.error(t('provider.requestDetail.otherProviderChosenToast'), { duration: 5000 });
                removeFromHistoryStorage(requestId);
                setLostSelection(true);
                setLostAccessWithoutRequest(true);
            } else {
                setError(errorMessage || t('provider.requestDetail.loadError'));
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
            toast.error(t('provider.requestDetail.quote.priceError'));
            return;
        }

        if (!etaNum || etaNum < 1 || etaNum > 300) {
            toast.error(t('provider.requestDetail.quote.etaError'));
            return;
        }

        try {
            setIsSubmitting(true);

            await api.post(`/rescue-requests/${requestId}/quotes`, {
                price: priceNum,
                estimatedArrivalMinutes: etaNum,
                message: message || undefined,
            });

            toast.success(t('provider.requestDetail.quoteSuccess'));
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
            try {
                const refresh = await api.get(`/rescue-requests/${requestId}/provider-view`);
                setRequest((prev) => (prev ? { ...prev, ...refresh.data } : refresh.data));
            } catch {
                /* badge refreshes on next poll */
            }
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

    const handleCancel = () => {
        // Just navigate back — request stays in inbox (Cảnh báo đến)
        // Provider must explicitly use the Decline button to remove it
        router.push('/provider/active');
    };

    const handleDeclineRequest = () => {
        setShowDeclineConfirm(true);
    };

    const confirmDeclineAction = async () => {
        setShowDeclineConfirm(false);
        try {
            await api.post(`/rescue-requests/${requestId}/decline`);
            // Persist declined id so dashboard hides it immediately
            try {
                const stored = sessionStorage.getItem('provider_declined_ids');
                const ids: string[] = stored ? JSON.parse(stored) : [];
                if (!ids.includes(requestId)) {
                    ids.push(requestId);
                    sessionStorage.setItem('provider_declined_ids', JSON.stringify(ids));
                }
            } catch { }
        } catch { }
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

    if (lostAccessWithoutRequest && !request) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div
                    className="bg-white rounded-2xl p-8 max-w-md w-full border-2"
                    style={{ borderColor: '#fed7aa', boxShadow: '0 1px 12px rgba(0,0,0,0.06)' }}
                >
                    <p className="font-bold text-[#9a3412] text-base mb-2">{t('provider.requestDetail.otherProviderChosen')}</p>
                    <p className="text-sm text-[#c2410c] mb-6">{t('provider.requestDetail.lostSelectionHint')}</p>
                    <button
                        type="button"
                        onClick={() => router.push('/provider/active')}
                        className="w-full py-3 rounded-xl text-sm font-bold text-white"
                        style={{ background: '#f97316' }}
                    >
                        {t('provider.requestDetail.backToActiveList')}
                    </button>
                </div>
            </div>
        );
    }

    if (error || !request) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-sm p-8 max-w-md">
                    <h2 className="text-xl font-bold text-red-600 mb-4">{t('provider.requestDetail.errorTitle')}</h2>
                    <p className="text-gray-700 mb-4">{error || t('provider.requestDetail.notFound')}</p>
                    <button
                        onClick={handleCancel}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        {t('provider.requestDetail.goBack')}
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
                user={{ name: request!.user?.name, phoneNumber: request!.contactPhone, avatar: request!.user?.avatar }}
                eta={myQuoteDetails?.estimatedArrivalMinutes ?? null}
                requestId={requestId}
                customerName={
                    request!.requesterType === 'GUEST'
                        ? (request!.user?.name ?? t('provider.requestDetail.walkInGuest'))
                        : (request!.user?.name ?? t('provider.requestDetail.customerFallback'))
                }
                requestDetails={{
                    incidentType: request!.incidentType,
                    vehicleType: request!.vehicleType,
                    description: request!.description,
                    pickupLocation: request!.pickupLocation,
                    contactPhone: request!.contactPhone,
                }}
                acceptedQuotePrice={myQuoteDetails?.price ?? null}
                isGuestRequest={request!.requesterType === 'GUEST'}
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
            <div className="min-h-screen" style={{ background: C.bg, fontFamily: 'Lexend, sans-serif' }}>
                {/* Header */}
                <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center gap-3" style={{ borderColor: C.border }}>
                    <div className="flex-1">
                        <p className="text-xs font-semibold" style={{ color: C.gray }}>{t('provider.requestDetail.accepted.headerSubtitle')}</p>
                        <h1 className="text-sm font-bold" style={{ color: C.navy }}>{t('provider.requestDetail.pageTitle')} #{displayOrderCode(req.orderCode, req.id)}</h1>
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
                        <h2 className="text-base font-bold mb-1" style={{ color: C.navy }}>{t('provider.requestDetail.accepted.congrats')}</h2>
                        <p className="text-sm" style={{ color: C.gray }}>{t('provider.requestDetail.accepted.congratsDesc')}</p>
                    </div>

                    {/* Customer info */}
                    <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                        <p className="text-xs font-semibold mb-3" style={{ color: C.gray }}>{t('provider.requestDetail.accepted.customerInfo')}</p>
                        <div className="flex items-center gap-3 mb-3">
                            <AvatarImage
                                name={
                                    req.requesterType === 'GUEST'
                                        ? (req.user?.name || t('provider.requestDetail.walkInGuest'))
                                        : (req.user?.name || t('provider.requestDetail.customerFallback'))
                                }
                                avatar={req.user?.avatar}
                                className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold"
                                fallbackBackground={`linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`}
                                initialsCount={1}
                            />
                            <div>
                                <p className="text-sm font-bold" style={{ color: C.navy }}>
                                    {req.requesterType === 'GUEST'
                                        ? (req.user?.name || t('provider.requestDetail.walkInGuest'))
                                        : (req.user?.name || t('provider.requestDetail.customerFallback'))}
                                </p>
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
                        <p className="text-xs font-semibold mb-3" style={{ color: C.gray }}>{t('provider.requestDetail.accepted.rescueInfo')}</p>
                        <div className="space-y-3">
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.orangeLight }}>
                                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-[10px] font-medium" style={{ color: C.gray }}>{t('provider.requestDetail.accepted.incidentType')}</p>
                                    <p className="text-sm font-semibold" style={{ color: C.navy }}>{t(`provider.requestDetail.incidentLabels.${req.incidentType}` as any) || req.incidentType}</p>
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
                                    <p className="text-[10px] font-medium" style={{ color: C.gray }}>{t('provider.requestDetail.accepted.vehicleType')}</p>
                                    <p className="text-sm font-semibold" style={{ color: C.navy }}>{t(`provider.requestDetail.vehicleLabels.${req.vehicleType}` as any) || req.vehicleType}</p>
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
                                    <p className="text-[10px] font-medium" style={{ color: C.gray }}>{t('provider.requestDetail.accepted.pickupLocation')}</p>
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
                                        <p className="text-[10px] font-medium" style={{ color: C.gray }}>{t('provider.requestDetail.accepted.description')}</p>
                                        <p className="text-sm" style={{ color: C.navy }}>{req.description}</p>
                                    </div>
                                </div>
                            )}
                            {requesterPlate(req) && (
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.orangeLight }}>
                                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2}>
                                            <rect x="2" y="7" width="20" height="10" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 11h.01M18 11h.01M9 11h6" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-medium" style={{ color: C.gray }}>{t('provider.requestDetail.accepted.licensePlate')}</p>
                                        <p className="text-sm font-semibold" style={{ color: C.navy }}>{requesterPlate(req)}</p>
                                    </div>
                                </div>
                            )}
                            {requesterVehicleColorRaw(req) && (
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.orangeLight }}>
                                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={C.orange} strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-medium" style={{ color: C.gray }}>{t('provider.requestDetail.accepted.vehicleColor')}</p>
                                        <p className="text-sm font-semibold" style={{ color: C.navy }}>{translateColor(requesterVehicleColorRaw(req) ?? '')}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Media / Photos & Videos */}
                    {req.media && req.media.length > 0 && (
                        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                            <p className="text-xs font-semibold mb-3" style={{ color: C.gray }}>{t('provider.requestDetail.accepted.mediaFromCustomer')} ({req.media.length})</p>
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
                            <p className="text-xs font-semibold mb-3" style={{ color: C.gray }}>{t('provider.requestDetail.accepted.yourQuote')}</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-xl p-3" style={{ background: C.bg }}>
                                    <p className="text-[10px]" style={{ color: C.gray }}>{t('provider.requestDetail.accepted.price')}</p>
                                    <p className="text-base font-bold" style={{ color: C.navy }}>{myQuoteDetails.price.toLocaleString()}đ</p>
                                </div>
                                <div className="rounded-xl p-3" style={{ background: C.bg }}>
                                    <p className="text-[10px]" style={{ color: C.gray }}>{t('provider.requestDetail.accepted.eta')}</p>
                                    <p className="text-base font-bold" style={{ color: C.navy }}>{myQuoteDetails.estimatedArrivalMinutes} {t('provider.requestDetail.accepted.minutes')}</p>
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
                                    {t('provider.requestDetail.accepted.startNavBtn')}
                                </>
                            )}
                        </button>
                        <p className="text-center text-xs mt-2" style={{ color: C.gray }}>
                            {t('provider.requestDetail.accepted.navHint')}
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
                        {t('provider.requestDetail.accepted.chatBtn')}
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
                            myAvatar={user.avatar}
                            otherPartyName={
                                request.requesterType === 'GUEST'
                                    ? (request.user?.name ?? t('provider.requestDetail.walkInGuest'))
                                    : (request.user?.name ?? t('provider.requestDetail.customerFallback'))
                            }
                            otherPartyAvatar={request.user?.avatar}
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
                            <h1 className="text-base md:text-lg font-bold text-gray-900 leading-tight">{t('provider.requestDetail.pageTitle')}</h1>
                            <p className="text-xs md:text-sm font-medium text-gray-500">#{displayOrderCode(request.orderCode, request.id)}</p>
                        </div>
                    </div>
                    {/* Status Pill + Decline button */}
                    <div className="flex items-center gap-2">
                        {request.status === 'MATCHING' && !hasPendingQuote && (
                            <>
                                <span className="px-2.5 md:px-3 py-1 bg-orange-50/70 text-[#f97316] text-[11px] md:text-[13px] font-bold rounded-full flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#f97316]"></span>
                                    {t('provider.requestDetail.statusBadge.searching')}
                                </span>
                                <button
                                    onClick={handleDeclineRequest}
                                    className="px-2.5 py-1 rounded-full text-[11px] md:text-[13px] font-bold flex items-center gap-1 transition-colors"
                                    style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }}
                                    title={t('provider.requestDetail.declineConfirm.title')}
                                >
                                    <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    {t('provider.requestDetail.declineConfirm.confirm')}
                                </button>
                            </>
                        )}
                        {request.status === 'MATCHING' && hasPendingQuote && (
                            <>
                                <span className="px-2.5 md:px-3 py-1 bg-yellow-50/70 text-yellow-600 text-[11px] md:text-[13px] font-bold rounded-full flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                                    {t('provider.requestDetail.statusBadge.waitingCustomer')}
                                </span>
                                <span className="px-2.5 md:px-3 py-1 bg-green-50/70 text-green-600 text-[11px] md:text-[13px] font-bold rounded-full flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                    {t('provider.requestDetail.statusBadge.selected')}
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-6xl mx-auto px-4 py-6">
                {lostSelection && (
                    <div
                        className="mb-5 rounded-2xl border p-4 md:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                        style={{ background: '#fff7ed', borderColor: '#fed7aa' }}
                    >
                        <div>
                            <p className="font-bold text-[#9a3412] text-sm md:text-base">{t('provider.requestDetail.otherProviderChosen')}</p>
                            <p className="text-xs md:text-sm text-[#c2410c] mt-1">{t('provider.requestDetail.lostSelectionHint')}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => router.push('/provider/active')}
                            className="shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
                            style={{ background: '#f97316' }}
                        >
                            {t('provider.requestDetail.backToActiveList')}
                        </button>
                    </div>
                )}
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
                                    <div className="text-[10px] md:text-xs font-semibold text-gray-500 mb-0.5">{t('provider.requestDetail.currentStatus')}</div>
                                    <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                                        <span className="text-sm md:text-base font-bold text-[#1a1a2e]">
                                            {request.status === 'MATCHING' && !hasPendingQuote && t('provider.requestDetail.statusLabel.waiting')}
                                            {request.status === 'MATCHING' && hasPendingQuote && t('provider.requestDetail.statusLabel.sent')}
                                            {request.status !== 'MATCHING' && request.assignedProviderId !== user?.id && t('provider.requestDetail.statusLabel.unavailable')}
                                            {request.status === 'ASSIGNED' && request.assignedProviderId === user?.id && t('provider.requestDetail.statusLabel.selected')}
                                        </span>
                                        {request.status === 'MATCHING' && (
                                            <div className="flex items-center gap-1.5 mt-1">
                                                {/* High priority badge */}
                                                <span className="px-1.5 md:px-2 py-0.5 bg-orange-100 text-[#f97316] text-[8px] md:text-[10px] font-bold rounded uppercase border border-[#fed7aa] flex-shrink-0">
                                                    {t('provider.requestDetail.statusBadge.highPriority')}
                                                </span>
                                                {/* Quote slots indicator */}
                                                {(() => {
                                                    const count = request.quoteCount || 0;
                                                    const max = request.maxQuotes || 3;
                                                    const pct = Math.round((count / max) * 100);
                                                    const urgentColor = count >= max - 1 ? '#dc2626' : count > 0 ? '#f97316' : '#16a34a';
                                                    return (
                                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: `${urgentColor}15`, border: `1px solid ${urgentColor}30` }}>
                                                            <div className="flex gap-0.5">
                                                                {Array.from({ length: max }).map((_, i) => (
                                                                    <div key={i} className="w-2.5 h-2.5 rounded-sm"
                                                                        style={{ background: i < count ? urgentColor : `${urgentColor}30` }}
                                                                    />
                                                                ))}
                                                            </div>
                                                            <span className="text-[9px] md:text-[10px] font-bold" style={{ color: urgentColor }}>
                                                                {count}/{max} báo giá
                                                            </span>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Timer Card */}
                            {request.status === 'MATCHING' && !hasPendingQuote && timeLeft !== null && timeLeft > 0 ? (
                                <div className="rounded-2xl p-4 md:p-5 shadow-sm text-white flex items-center justify-between" style={{ background: '#f97316' }}>
                                    <div className="text-xs md:text-sm font-semibold opacity-90">
                                        {t('provider.requestDetail.timerTitle')}<br />
                                        <span className="text-[9px] md:text-[10px] font-normal opacity-80 mt-1 block">{t('provider.requestDetail.timerSubtitle')}</span>
                                    </div>
                                    <div className="flex items-center gap-2 md:gap-3 text-center">
                                        <div className="flex flex-col">
                                            <span className="text-2xl md:text-3xl font-black leading-none">{Math.floor(timeLeft / 60)}</span>
                                            <span className="text-[8px] md:text-[10px] uppercase font-bold mt-1">{t('provider.requestDetail.minutesLabel')}</span>
                                        </div>
                                        <div className="text-xl md:text-2xl font-bold opacity-70 mb-2 md:mb-3">:</div>
                                        <div className="flex flex-col">
                                            <span className="text-2xl md:text-3xl font-black leading-none">{String(timeLeft % 60).padStart(2, '0')}</span>
                                            <span className="text-[8px] md:text-[10px] uppercase font-bold mt-1">{t('provider.requestDetail.secondsLabel')}</span>
                                        </div>
                                    </div>
                                </div>
                            ) : request.status === 'MATCHING' && hasPendingQuote ? (
                                <div className="rounded-2xl p-5 shadow-sm text-white flex items-center justify-between bg-yellow-500">
                                    <div className="text-sm font-semibold opacity-90">{t('provider.requestDetail.waitingCustomerLabel')}</div>
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
                                    {request.requesterType === 'GUEST'
                                        ? t('provider.requestDetail.customerInfoSectionWalkIn')
                                        : t('provider.requestDetail.customerInfoSection')}
                                </div>
                                <div className="flex items-center gap-3">
                                    <AvatarImage
                                        name={
                                            request.requesterType === 'GUEST'
                                                ? (request.user?.name || t('provider.requestDetail.walkInGuest'))
                                                : (request.user?.name || t('provider.requestDetail.customerFallback'))
                                        }
                                        avatar={request.user?.avatar}
                                        className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-orange-100 flex-shrink-0 flex items-center justify-center text-lg md:text-xl font-bold text-orange-600"
                                        fallbackBackground="#ffedd5"
                                        initialsCount={1}
                                    />
                                    <div>
                                        <div className="font-bold text-[#1a1a2e] text-[15px] md:text-base mb-0.5 md:mb-1">
                                            {request.requesterType === 'GUEST'
                                                ? (request.user?.name || t('provider.requestDetail.walkInGuest'))
                                                : (request.user?.name || t('provider.requestDetail.customerFallback'))}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs md:text-sm font-medium text-gray-500">
                                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                            </svg>
                                            {request.contactPhone ? request.contactPhone.replace(/(\d{3})\d{4}(\d{3})/, '$1 *** $2') : t('provider.requestDetail.noPhone')}
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
                                    {t('provider.requestDetail.vehicleInfoSection')}
                                </div>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                                    <div>
                                        <p className="text-[9px] md:text-[10px] uppercase font-bold text-gray-400 mb-0.5 md:mb-1">{t('provider.requestDetail.infoLabels.vehicleType')}</p>
                                        <p className="text-[13px] md:text-sm font-bold text-[#1a1a2e] truncate">{t(`provider.requestDetail.vehicleLabels.${request.vehicleType}` as any) || request.vehicleType}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] md:text-[10px] uppercase font-bold text-gray-400 mb-0.5 md:mb-1">{t('provider.requestDetail.infoLabels.licensePlate')}</p>
                                        <p className="text-[13px] md:text-sm font-bold text-[#1a1a2e] uppercase">{requesterPlate(request) || t('common.unknown')}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] md:text-[10px] uppercase font-bold text-gray-400 mb-0.5 md:mb-1">{t('provider.requestDetail.infoLabels.vehicleColor')}</p>
                                        <p className="text-[13px] md:text-sm font-bold text-[#1a1a2e]">{translateColor(requesterVehicleColorRaw(request) || '') || t('common.unknown')}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] md:text-[10px] uppercase font-bold text-gray-400 mb-0.5 md:mb-1">{t('provider.requestDetail.infoLabels.incidentType')}</p>
                                        <p className="text-[13px] md:text-sm font-bold text-red-600 line-clamp-1">{t(`provider.requestDetail.incidentLabels.${request.incidentType}` as any) || request.incidentType}</p>
                                    </div>
                                </div>
                                {request.description && (
                                    <div className="pt-2">
                                        <p className="text-[9px] md:text-[10px] uppercase font-bold text-gray-400 mb-0.5 md:mb-1">{t('provider.requestDetail.infoLabels.description')}</p>
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
                                {t('provider.requestDetail.rescueLocation')}
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
                                    {t('provider.requestDetail.scenePhotos').replace('{count}', String(request.media.length))}
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
                                                <button
                                                    onClick={() => setSelectedVideoUrl(item.publicUrl)}
                                                    className="cursor-pointer w-full h-full rounded-xl overflow-hidden border border-gray-200 bg-black relative flex items-center justify-center"
                                                >
                                                    <video src={item.publicUrl} className="w-full h-full object-cover opacity-80" />
                                                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.2)' }}>
                                                        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center hover:scale-110 transition-transform">
                                                            <svg width="20" height="20" fill="white" viewBox="0 0 24 24" className="ml-1"><path d="M8 5v14l11-7z" /></svg>
                                                        </div>
                                                    </div>
                                                </button>
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
                            <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', boxShadow: '0 4px 20px rgba(249,115,22,0.12)', border: '1.5px solid #fed7aa' }}>
                                {/* Form Header */}
                                <div className="px-5 py-4 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #fff7ed, #ffedd5)', borderBottom: '1px solid #fed7aa' }}>
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#f97316' }}>
                                        <svg width="20" height="20" fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-bold" style={{ color: '#1a1a2e' }}>{t('provider.requestDetail.quoteSendTitle')}</h2>
                                        <p className="text-[11px]" style={{ color: '#6b7280' }}>Điền thông tin và gửi nhanh để được chọn</p>
                                    </div>
                                </div>

                                <form onSubmit={handleSubmitQuote} className="p-5 space-y-4">
                                    {/* Price */}
                                    <div>
                                        <label className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide" style={{ color: '#6b7280' }}>{t('provider.requestDetail.quote.priceLabel')}</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={price}
                                                onChange={(e) => setPrice(e.target.value)}
                                                placeholder={t('provider.requestDetail.quote.pricePlaceholder')}
                                                min="10000"
                                                required
                                                className="w-full pl-4 pr-10 py-3 rounded-xl text-sm font-semibold outline-none transition-all"
                                                style={{ background: '#f8fafc', border: '1.5px solid #e5e7eb', color: '#1a1a2e' }}
                                                onFocus={e => (e.target.style.border = '1.5px solid #f97316')}
                                                onBlur={e => (e.target.style.border = '1.5px solid #e5e7eb')}
                                            />
                                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: '#f97316' }}>₫</span>
                                        </div>
                                    </div>

                                    {/* ETA */}
                                    <div>
                                        <label className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide" style={{ color: '#6b7280' }}>{t('provider.requestDetail.quote.etaLabel')}</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={estimatedArrivalMinutes}
                                                onChange={(e) => setEstimatedArrivalMinutes(e.target.value)}
                                                placeholder={t('provider.requestDetail.quote.etaPlaceholder')}
                                                min="1"
                                                max="300"
                                                required
                                                className="w-full pl-4 pr-16 py-3 rounded-xl text-sm font-semibold outline-none transition-all"
                                                style={{ background: '#f8fafc', border: '1.5px solid #e5e7eb', color: '#1a1a2e' }}
                                                onFocus={e => (e.target.style.border = '1.5px solid #f97316')}
                                                onBlur={e => (e.target.style.border = '1.5px solid #e5e7eb')}
                                            />
                                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: '#6b7280' }}>{t('provider.requestDetail.minutesLabel')}</span>
                                        </div>
                                    </div>

                                    {/* Message */}
                                    <div>
                                        <label className="block text-[11px] font-bold mb-1.5 uppercase tracking-wide" style={{ color: '#6b7280' }}>{t('provider.requestDetail.quote.messageLabel')}</label>
                                        <textarea
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            placeholder={t('provider.requestDetail.quote.messagePlaceholder')}
                                            rows={3}
                                            className="w-full p-3.5 rounded-xl text-sm resize-none outline-none transition-all"
                                            style={{ background: '#f8fafc', border: '1.5px solid #e5e7eb', color: '#1a1a2e' }}
                                            onFocus={e => (e.target.style.border = '1.5px solid #f97316')}
                                            onBlur={e => (e.target.style.border = '1.5px solid #e5e7eb')}
                                        />
                                    </div>

                                    {/* Submit */}
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full py-3.5 rounded-xl font-bold text-white text-sm uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                                        style={{
                                            background: 'linear-gradient(135deg, #f97316 0%, #ea6c0a 100%)',
                                            boxShadow: '0 4px 14px rgba(249,115,22,0.35)',
                                        }}
                                    >
                                        {isSubmitting ? t('provider.requestDetail.quote.submitting') : t('provider.requestDetail.quote.submitBtn')}
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
                                        className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors"
                                        style={{ color: '#6b7280' }}
                                    >
                                        {t('provider.requestDetail.goBack')}
                                    </button>

                                    <div className="flex items-start gap-2 rounded-xl p-3" style={{ background: '#fff7ed' }}>
                                        <svg width="16" height="16" fill="none" stroke="#f97316" viewBox="0 0 24 24" className="flex-shrink-0 mt-0.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <p className="text-[11px] leading-relaxed" style={{ color: '#9a3412' }}>
                                            {t('provider.requestDetail.quote.feeNote')}
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
                                    <h2 className="text-xl font-bold text-[#1a1a2e] mb-2">{t('provider.requestDetail.quoteSent.title')}</h2>
                                    <p className="text-sm text-gray-500">{t('provider.requestDetail.quoteSent.waitTip')}</p>
                                </div>

                                <div className="py-6 space-y-4">
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">{t('provider.requestDetail.quoteSent.price')}</p>
                                        <p className="text-xl font-black text-green-600">{myQuoteDetails.price.toLocaleString()}đ</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">{t('provider.requestDetail.quoteSent.eta')}</p>
                                        <p className="text-base font-bold text-[#1a1a2e]">{myQuoteDetails.estimatedArrivalMinutes} {t('provider.requestDetail.quoteSent.minutes')}</p>
                                    </div>
                                    {myQuoteDetails.message && (
                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">{t('provider.requestDetail.quoteSent.message')}</p>
                                            <p className="text-sm font-medium italic text-gray-700">"{myQuoteDetails.message}"</p>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                                    <p className="text-xs font-semibold text-blue-800 text-center animate-pulse">
                                        {t('provider.requestDetail.keepScreen')}
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
                                    <h2 className="text-lg font-bold text-[#1a1a2e] mb-2">{t('provider.requestDetail.requestEnded.title')}</h2>
                                    <p className="text-sm text-gray-500 mb-6">{t('provider.requestDetail.requestEnded.desc')}</p>
                                    <button
                                        onClick={handleCancel}
                                        className="w-full py-3.5 rounded-xl font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                                    >
                                        {t('provider.requestDetail.backHome')}
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

            {/* Custom Decline Confirmation Dialog */}
            {showDeclineConfirm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
                        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#dc2626" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                            </svg>
                        </div>
                        <h3 className="text-base font-bold text-center mb-1 text-gray-900">{t('provider.requestDetail.declineConfirm.title')}</h3>
                        <p className="text-sm text-center text-gray-500 mb-6">
                            {t('provider.requestDetail.declineConfirm.desc')}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setShowDeclineConfirm(false)}
                                className="py-3 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                                {t('provider.requestDetail.declineConfirm.cancel')}
                            </button>
                            <button
                                onClick={confirmDeclineAction}
                                className="py-3 rounded-xl text-sm font-bold text-white transition-colors"
                                style={{ background: '#dc2626' }}
                            >
                                {t('provider.requestDetail.declineConfirm.confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Video Viewer Modal */}
            {selectedVideoUrl && (
                <div className="fixed inset-0 z-[100] flex flex-col bg-black overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-end p-4 bg-gradient-to-b from-black/80 to-transparent">
                        <button
                            onClick={() => setSelectedVideoUrl(null)}
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white transition-colors"
                        >
                            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Video */}
                    <div className="flex-1 flex items-center justify-center px-4 pb-8">
                        <video
                            src={selectedVideoUrl}
                            controls
                            autoPlay
                            className="max-w-full max-h-full rounded-xl drop-shadow-2xl"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
