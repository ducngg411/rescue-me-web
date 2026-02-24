'use client';

import { useState, useEffect } from 'react';
import { PendingRequest } from '@/lib/hooks/usePendingRequests';

interface IncomingRequestModalProps {
    request: PendingRequest;
    onViewDetails: () => void; // Changed from onAccept
    onDecline: () => void;
    isProcessing: boolean;
}

const INCIDENT_TYPE_LABELS: Record<string, string> = {
    BREAKDOWN: 'Hỏng xe',
    ACCIDENT: 'Tai nạn',
    FLAT_TIRE: 'Lốp xe hỏng',
    BATTERY_DEAD: 'Hết bình điện',
    OUT_OF_FUEL: 'Hết nhiên liệu',
    LOCKED_OUT: 'Khóa xe',
    OTHER: 'Khác',
};

const VEHICLE_TYPE_LABELS: Record<string, string> = {
    CAR: 'Ô tô',
    MOTORCYCLE: 'Xe máy',
};

export default function IncomingRequestModal({
    request,
    onViewDetails, // Changed from onAccept
    onDecline,
    isProcessing,
}: IncomingRequestModalProps) {
    const [timeLeft, setTimeLeft] = useState(request.timeRemaining);

    useEffect(() => {
        setTimeLeft(request.timeRemaining);

        const interval = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    onDecline(); // Auto-decline when time runs out
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [request.timeRemaining, onDecline]);

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const progressPercent = (timeLeft / request.timeRemaining) * 100;

    // Use real ETA from backend (VietMap API) or fallback to distance-based calculation
    const estimatedMinutes = request.eta || Math.ceil((request.distance / 40) * 60);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-4 rounded-t-lg">
                    <h2 className="text-xl font-bold">YÊU CẦU CỨU HỘ MỚI</h2>
                    <p className="text-sm text-red-100 mt-1">Vui lòng phản hồi nhanh để nhận yêu cầu</p>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* Customer Info */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="text-xs text-gray-500 mb-2">THÔNG TIN KHÁCH HÀNG</div>
                        <div className="font-semibold text-gray-900 mb-2">{request.user.name || 'Khách hàng'}</div>
                        <a href={`tel:${request.user.phone}`} className="text-blue-600 hover:underline text-sm font-medium">
                            {request.user.phone}
                        </a>
                    </div>

                    {/* Location */}
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <div className="text-xs text-blue-600 font-semibold mb-2">VỊ TRÍ GẶP NẠN</div>
                        <div className="text-sm text-gray-800">{request.pickupLocation.address}</div>
                    </div>

                    {/* Incident Details */}
                    <div className="bg-white rounded-lg p-4 border border-gray-200 space-y-3">
                        <div className="text-xs text-gray-500 mb-2">CHI TIẾT SỰ CỐ</div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="text-xs text-gray-500">Loại xe</div>
                                <div className="text-sm font-medium text-gray-900">
                                    {VEHICLE_TYPE_LABELS[request.vehicleType] || request.vehicleType}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">Sự cố</div>
                                <div className="text-sm font-medium text-gray-900">
                                    {INCIDENT_TYPE_LABELS[request.incidentType] || request.incidentType}
                                </div>
                            </div>
                        </div>
                        {request.description && (
                            <div className="pt-2 border-t border-gray-100">
                                <div className="text-xs text-gray-500 mb-1">Mô tả chi tiết</div>
                                <div className="text-sm text-gray-700 italic">"{request.description}"</div>
                            </div>
                        )}
                    </div>

                    {/* Distance & Earnings */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                            <div className="text-xs text-blue-700 font-medium mb-1">THỜI GIAN ĐẾN</div>
                            <div className="text-2xl font-bold text-blue-600">
                                ~{estimatedMinutes}'
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                                {request.distance < 1
                                    ? `${(request.distance * 1000).toFixed(0)} m`
                                    : `${request.distance.toFixed(2)} km`
                                }
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                            <div className="text-xs text-green-700 font-medium mb-1">DỰ KIẾN THU NHẬP</div>
                            <div className="text-xl font-bold text-green-600">
                                {request.estimatedEarnings.toLocaleString()}₫
                            </div>
                        </div>
                    </div>

                    {/* Media Preview */}
                    {request.media && request.media.length > 0 && (
                        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                            <div className="text-xs text-purple-700 font-medium mb-2">
                                HÌNH ẢNH/VIDEO ({request.media.length})
                            </div>
                            <div className="flex gap-2 overflow-x-auto">
                                {request.media.slice(0, 4).map((media, idx) => (
                                    <div key={idx} className="flex-shrink-0 w-16 h-16 bg-white rounded border border-purple-200 overflow-hidden">
                                        {media.type === 'IMAGE' ? (
                                            <img src={media.url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-100 text-xs text-gray-500">
                                                VIDEO
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {request.media.length > 4 && (
                                    <div className="flex-shrink-0 w-16 h-16 bg-purple-100 rounded border border-purple-200 flex items-center justify-center">
                                        <span className="text-xs font-medium text-purple-600">+{request.media.length - 4}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Countdown Timer */}
                    <div>
                        <div className="text-center mb-2">
                            <div className="text-2xl font-bold text-gray-900">
                                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                            </div>
                            <div className="text-xs text-gray-600">Thời gian phản hồi</div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                                className="bg-blue-500 h-full transition-all duration-1000"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <button
                            onClick={onDecline}
                            disabled={isProcessing}
                            className="px-4 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Bỏ qua
                        </button>
                        <button
                            onClick={onViewDetails}
                            disabled={isProcessing}
                            className="px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Xem chi tiết & Gửi báo giá
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
