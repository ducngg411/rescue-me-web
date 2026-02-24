'use client';

import { useState, useEffect } from 'react';
import { PendingRequest } from '@/lib/hooks/usePendingRequests';

interface IncomingRequestModalProps {
    request: PendingRequest;
    onAccept: () => void;
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
    onAccept,
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
                <div className="bg-red-500 text-white px-6 py-4 rounded-t-lg">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">🚨</span>
                        <h2 className="text-xl font-bold">YÊU CẦU CỨU HỘ MỚI</h2>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* Customer Info */}
                    <div className="border-b pb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">👤</span>
                            <span className="font-semibold text-gray-900">{request.user.name || 'Khách hàng'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-700">
                            <span>📞</span>
                            <a href={`tel:${request.user.phone}`} className="text-blue-600 hover:underline">
                                {request.user.phone}
                            </a>
                        </div>
                    </div>

                    {/* Location */}
                    <div>
                        <div className="flex items-start gap-2 mb-2">
                            <span className="text-lg mt-0.5">📍</span>
                            <div className="flex-1">
                                <div className="font-medium text-gray-900 mb-1">Vị trí gặp nạn:</div>
                                <div className="text-sm text-gray-700">{request.pickupLocation.address}</div>
                            </div>
                        </div>
                    </div>

                    {/* Incident Details */}
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                        <div className="flex items-center gap-2">
                            <span>🚗</span>
                            <span className="text-sm">
                                <span className="font-medium">Loại xe:</span>{' '}
                                {VEHICLE_TYPE_LABELS[request.vehicleType] || request.vehicleType}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span>🔧</span>
                            <span className="text-sm">
                                <span className="font-medium">Sự cố:</span>{' '}
                                {INCIDENT_TYPE_LABELS[request.incidentType] || request.incidentType}
                            </span>
                        </div>
                        {request.description && (
                            <div className="flex items-start gap-2">
                                <span>📝</span>
                                <div className="text-sm flex-1">
                                    <span className="font-medium">Mô tả:</span>{' '}
                                    <span className="text-gray-700">"{request.description}"</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Distance & Earnings */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-50 rounded-lg p-3">
                            <div className="text-xs text-gray-600 mb-1">Thời gian đến</div>
                            <div className="text-2xl font-bold text-blue-600">
                                ~{estimatedMinutes} phút
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                {request.distance < 1
                                    ? `${(request.distance * 1000).toFixed(0)} m`
                                    : `${request.distance.toFixed(2)} km`
                                } {request.eta ? '(VietMap)' : '(ước tính)'}
                            </div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-3">
                            <div className="text-xs text-gray-600 mb-1">Dự kiến thu nhập</div>
                            <div className="text-lg font-bold text-green-600">
                                {request.estimatedEarnings.toLocaleString()} ₫
                            </div>
                        </div>
                    </div>

                    {/* Media Preview */}
                    {request.media && request.media.length > 0 && (
                        <div>
                            <div className="text-sm font-medium text-gray-700 mb-2">
                                Hình ảnh/Video: ({request.media.length})
                            </div>
                            <div className="flex gap-2 overflow-x-auto">
                                {request.media.slice(0, 3).map((media, idx) => (
                                    <div key={idx} className="flex-shrink-0 w-20 h-20 bg-gray-200 rounded-lg overflow-hidden">
                                        {media.type === 'IMAGE' ? (
                                            <img src={media.url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-300">
                                                <span className="text-2xl">🎬</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
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
                            className="px-4 py-3 border-2 border-red-500 text-red-600 font-medium rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            ❌ Từ chối
                        </button>
                        <button
                            onClick={onAccept}
                            disabled={isProcessing}
                            className="px-4 py-3 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            ✅ Nhận ngay
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
