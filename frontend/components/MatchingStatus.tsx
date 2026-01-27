'use client';

interface MatchingStatusProps {
    timeRemaining: number;
    searchPhase?: number; // 1 = normal radius, 2 = expanded radius
    onCancel: () => void;
}

export default function MatchingStatus({ timeRemaining, searchPhase = 1, onCancel }: MatchingStatusProps) {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;

    // Show transition state when timer is at 00:00
    const isTransitioning = timeRemaining === 0;

    // Different messages for Phase 1 and Phase 2
    const isPhase2 = searchPhase === 2;
    const statusText = isTransitioning
        ? 'Đang chuyển đổi...'
        : isPhase2 ? 'Đang mở rộng tìm kiếm' : 'Đang tìm kiếm provider';
    const messageTitle = isTransitioning
        ? 'Đang cập nhật trạng thái, vui lòng đợi...'
        : isPhase2
            ? 'Hiện chưa có cứu hộ gần bạn. Hệ thống đang mở rộng tìm kiếm…'
            : 'Đang gửi yêu cầu tới providers gần bạn';
    const messageSubtitle = isTransitioning
        ? 'Hệ thống đang xử lý yêu cầu của bạn'
        : isPhase2
            ? 'Chúng tôi đang tìm kiếm trong phạm vi rộng hơn để tìm provider phù hợp'
            : 'Provider sẽ tới vị trí gặp nạn của bạn để cứu hộ';

    // Color theme
    const colorTheme = isTransitioning
        ? 'gray'
        : isPhase2 ? 'orange' : 'blue';

    return (
        <div className="bg-white rounded-lg shadow-sm p-6">
            {/* Status Badge */}
            <div className="flex justify-center mb-6">
                <div className={`inline-flex items-center gap-2 px-4 py-2 border-2 rounded-full animate-pulse ${colorTheme === 'gray' ? 'bg-gray-50 border-gray-200' :
                        colorTheme === 'orange' ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'
                    }`}>
                    <div className={`h-3 w-3 rounded-full animate-ping ${colorTheme === 'gray' ? 'bg-gray-500' :
                            colorTheme === 'orange' ? 'bg-orange-500' : 'bg-blue-500'
                        }`}></div>
                    <span className={`font-medium ${colorTheme === 'gray' ? 'text-gray-700' :
                            colorTheme === 'orange' ? 'text-orange-700' : 'text-blue-700'
                        }`}>{statusText}</span>
                </div>
            </div>

            {/* Countdown Timer */}
            <div className="text-center mb-6">
                <div className={`text-4xl font-bold mb-2 ${isTransitioning ? 'text-gray-400 animate-pulse' : 'text-gray-900'
                    }`}>
                    {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </div>
                <p className="text-sm text-gray-600">
                    {isTransitioning ? 'Đang xử lý...' : 'Thời gian còn lại'}
                </p>
            </div>

            {/* Loading Animation */}
            <div className="flex justify-center mb-6">
                <div className="relative">
                    <div className="h-16 w-16">
                        <svg className={`animate-spin h-16 w-16 ${colorTheme === 'gray' ? 'text-gray-400' :
                                colorTheme === 'orange' ? 'text-orange-500' : 'text-blue-500'
                            }`} fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                </div>
            </div>

            {/* Status Message */}
            <div className={`rounded-lg p-4 mb-6 ${colorTheme === 'gray' ? 'bg-gray-50' :
                    colorTheme === 'orange' ? 'bg-orange-50' : 'bg-blue-50'
                }`}>
                <div className="flex items-start gap-3">
                    <svg className={`h-5 w-5 mt-0.5 flex-shrink-0 ${colorTheme === 'gray' ? 'text-gray-500' :
                            colorTheme === 'orange' ? 'text-orange-500' : 'text-blue-500'
                        }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                        <p className={`text-sm font-medium ${colorTheme === 'gray' ? 'text-gray-900' :
                                colorTheme === 'orange' ? 'text-orange-900' : 'text-blue-900'
                            }`}>{messageTitle}</p>
                        <p className={`text-sm mt-1 ${colorTheme === 'gray' ? 'text-gray-700' :
                                colorTheme === 'orange' ? 'text-orange-700' : 'text-blue-700'
                            }`}>
                            {messageSubtitle}
                        </p>
                    </div>
                </div>
            </div>

            {/* Cancel Button */}
            <div className="flex justify-center">
                <button
                    onClick={onCancel}
                    disabled={isTransitioning}
                    className={`px-6 py-3 border-2 font-medium rounded-lg transition-colors ${isTransitioning
                            ? 'border-gray-300 text-gray-400 cursor-not-allowed'
                            : 'border-red-500 text-red-600 hover:bg-red-50'
                        }`}
                >
                    Huỷ yêu cầu
                </button>
            </div>
        </div>
    );
}
