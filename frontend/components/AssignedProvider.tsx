'use client';

interface Provider {
    id: string;
    name: string | null;
    serviceName: string | null;
    serviceTypes: string[];
    phoneNumber: string | null;
    pricePerKm: number | null;
    baseFee: number | null;
    isOnline: boolean;
}

interface AssignedProviderProps {
    provider: Provider;
    distance?: number; // Distance in km
    eta?: number; // ETA in minutes
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
    TOWING: 'Kéo xe',
    BATTERY_JUMP: 'Cứu hộ bình điện',
    TIRE_CHANGE: 'Thay lốp xe',
    FUEL_DELIVERY: 'Tiếp nhiên liệu',
    LOCKOUT: 'Mở khóa xe',
    BREAKDOWN_REPAIR: 'Sửa chữa tại chỗ',
};

export default function AssignedProvider({ provider, distance, eta }: AssignedProviderProps) {
    const displayName = provider.serviceName || provider.name || 'Provider';
    const serviceLabels = provider.serviceTypes.map(type => SERVICE_TYPE_LABELS[type] || type).join(', ');

    // Use real data or fallback to placeholder
    const displayDistance = distance
        ? (distance < 1 ? `${(distance * 1000).toFixed(0)} m` : `${distance.toFixed(2)} km`)
        : '~5 km';
    const displayEta = eta ? `${eta} phút` : '15 phút';

    const handleCall = () => {
        if (provider.phoneNumber) {
            window.location.href = `tel:${provider.phoneNumber}`;
        }
    };

    const handleMessage = () => {
        if (provider.phoneNumber) {
            window.location.href = `sms:${provider.phoneNumber}`;
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm p-6">
            {/* Status Badge */}
            <div className="flex justify-center mb-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border-2 border-blue-200 rounded-full">
                    <svg className="h-5 w-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-blue-700 font-medium">Đã có provider - Đang chuẩn bị</span>
                </div>
            </div>

            {/* Provider Card */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                {/* Provider Info */}
                <div className="flex items-start gap-4 mb-6">
                    <div className="h-16 w-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-1">{displayName}</h3>

                        {/* Rating - Placeholder for future */}
                        <div className="flex items-center gap-2 mb-2">
                            <div className="flex items-center gap-1">
                                <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                                <span className="text-sm font-medium text-gray-700">4.8</span>
                            </div>
                            <span className="text-sm text-gray-500">(152 đánh giá)</span>
                        </div>

                        {/* Service Types */}
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                            <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{serviceLabels}</span>
                        </div>
                    </div>

                    {/* Online indicator */}
                    {provider.isOnline && (
                        <div className="flex items-center gap-1 text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                            <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                            <span>Online</span>
                        </div>
                    )}
                </div>

                {/* Distance & ETA - Placeholder for future GPS tracking */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-white rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            <span className="text-xs text-gray-600">Khoảng cách</span>
                        </div>
                        <p className="text-lg font-semibold text-gray-900">{displayDistance}</p>
                        {distance && <p className="text-xs text-gray-500 mt-0.5">(VietMap)</p>}
                    </div>
                    <div className="bg-white rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-xs text-gray-600">Dự kiến tới</span>
                        </div>
                        <p className="text-lg font-semibold text-gray-900">{displayEta}</p>
                        {eta && <p className="text-xs text-gray-500 mt-0.5">(ETA thực)</p>}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={handleCall}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span>Gọi điện</span>
                    </button>
                    <button
                        onClick={handleMessage}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-blue-600 text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition-colors"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span>Nhắn tin</span>
                    </button>
                </div>
            </div>

            {/* Status Message */}
            <div className="mt-6 bg-blue-50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <svg className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                        <p className="text-sm font-medium text-blue-900">Provider đang xem xét chi tiết</p>
                        <p className="text-sm text-blue-700 mt-1">
                            Provider đã nhận yêu cầu và đang chuẩn bị. Provider sẽ liên hệ với bạn để xác nhận chi tiết và thời gian đến. Vui lòng bật điện thoại.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
