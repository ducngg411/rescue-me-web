'use client';

interface MatchingStatusProps {
    timeRemaining: number; // Quote window time remaining in seconds
    searchPhase?: number; // 1 = normal radius, 2 = expanded radius
    viewingProvidersCount?: number; // Number of providers viewing this request
    quoteCount?: number; // Number of quotes received
    maxQuotes?: number; // Maximum quotes allowed
    quoteWindowOpen?: boolean; // Is quote window still open?
    onCancel: () => void;
}

export default function MatchingStatus({
    timeRemaining,
    searchPhase = 1,
    viewingProvidersCount = 0,
    quoteCount = 0,
    maxQuotes = 3,
    quoteWindowOpen = true,
    onCancel
}: MatchingStatusProps) {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;

    const hasViewingProviders = viewingProvidersCount > 0;
    const hasQuotes = quoteCount > 0;
    const windowClosed = !quoteWindowOpen;

    // Status text based on state
    let statusText = 'Đang tìm kiếm provider';
    let colorTheme = 'blue';

    if (windowClosed) {
        statusText = `Đã nhận ${quoteCount}/${maxQuotes} báo giá`;
        colorTheme = 'purple';
    } else if (hasQuotes) {
        statusText = `Đang nhận báo giá (${quoteCount}/${maxQuotes})`;
        colorTheme = 'green';
    } else if (hasViewingProviders) {
        statusText = 'Providers đang xem yêu cầu';
        colorTheme = 'green';
    } else if (searchPhase === 2) {
        statusText = 'Đang mở rộng tìm kiếm';
        colorTheme = 'orange';
    }

    // Message based on state
    let messageTitle = 'Đang gửi yêu cầu tới providers gần bạn';
    let messageSubtitle = 'Providers sẽ xem chi tiết và gửi báo giá cho bạn';

    if (windowClosed) {
        messageTitle = `Đã nhận đủ ${quoteCount} báo giá`;
        messageSubtitle = 'Vui lòng chọn provider phù hợp hoặc mở rộng tìm kiếm thêm';
    } else if (hasQuotes) {
        messageTitle = `Đã nhận ${quoteCount}/${maxQuotes} báo giá`;
        if (hasViewingProviders) {
            messageSubtitle = `${viewingProvidersCount} provider đang xem • Còn ~${Math.floor(timeRemaining)}s để nhận thêm báo giá`;
        } else {
            messageSubtitle = `Còn ~${Math.floor(timeRemaining)}s để nhận thêm báo giá`;
        }
    } else if (hasViewingProviders) {
        messageTitle = `Có ${viewingProvidersCount} provider đang xem`;
        messageSubtitle = `Còn ~${Math.floor(timeRemaining)}s để nhận báo giá`;
    } else if (searchPhase === 2) {
        messageTitle = 'Hiện chưa có cứu hộ gần bạn. Hệ thống đang mở rộng tìm kiếm…';
        messageSubtitle = 'Chúng tôi đang tìm kiếm trong phạm vi rộng hơn để tìm provider phù hợp';
    }

    return (
        <div className="bg-white rounded-lg shadow-sm p-6">
            {/* Status Badge */}
            <div className="flex justify-center mb-6">
                <div className={`inline-flex items-center gap-2 px-4 py-2 border-2 rounded-full ${windowClosed ? '' : 'animate-pulse'} ${colorTheme === 'purple' ? 'bg-purple-50 border-purple-200' :
                        colorTheme === 'green' ? 'bg-green-50 border-green-200' :
                            colorTheme === 'orange' ? 'bg-orange-50 border-orange-200' :
                                'bg-blue-50 border-blue-200'
                    }`}>
                    <div className={`h-3 w-3 rounded-full ${windowClosed ? '' : 'animate-ping'} ${colorTheme === 'purple' ? 'bg-purple-500' :
                            colorTheme === 'green' ? 'bg-green-500' :
                                colorTheme === 'orange' ? 'bg-orange-500' :
                                    'bg-blue-500'
                        }`}></div>
                    <span className={`font-medium ${colorTheme === 'purple' ? 'text-purple-700' :
                            colorTheme === 'green' ? 'text-green-700' :
                                colorTheme === 'orange' ? 'text-orange-700' :
                                    'text-blue-700'
                        }`}>{statusText}</span>
                </div>
            </div>

            {/* Countdown Timer */}
            {
                !windowClosed && (
                    <div className="text-center mb-6">
                        <div className="text-4xl font-bold mb-2 text-gray-900">
                            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                        </div>
                        <p className="text-sm text-gray-600">
                            Còn lại để nhận báo giá
                        </p>
                    </div>
                )
            }

            {/* Quote Progress Display (when window closed) */}
            {
                windowClosed && (
                    <div className="flex justify-center mb-6">
                        <div className="text-center">
                            <div className="text-5xl font-bold text-purple-600 mb-2">
                                {quoteCount}/{maxQuotes}
                            </div>
                            <p className="text-sm text-gray-600">
                                Báo giá đã nhận
                            </p>
                        </div>
                    </div>
                )
            }

            {/* Visual Display */}
            {
                !windowClosed && (
                    <div className="flex justify-center mb-6">
                        <div className="relative">
                            {hasQuotes || hasViewingProviders ? (
                                <div className={`h-16 w-16 flex items-center justify-center rounded-full ${hasQuotes ? 'bg-green-100' : 'bg-blue-100'
                                    }`}>
                                    {hasQuotes ? (
                                        // Show document icon with quote count
                                        <>
                                            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
                                                {quoteCount}
                                            </div>
                                        </>
                                    ) : (
                                        // Show eye icon with viewing count
                                        <>
                                            <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                            <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
                                                {viewingProvidersCount}
                                            </div>
                                        </>
                                    )}
                                </div>
                            ) : (
                                // Show loading spinner
                                <div className="h-16 w-16">
                                    <svg className={`animate-spin h-16 w-16 ${colorTheme === 'orange' ? 'text-orange-500' : 'text-blue-500'
                                        }`} fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {/* Status Message */}
            <div className={`rounded-lg p-4 mb-6 ${colorTheme === 'purple' ? 'bg-purple-50' :
                    colorTheme === 'green' ? 'bg-green-50' :
                        colorTheme === 'orange' ? 'bg-orange-50' :
                            'bg-blue-50'
                }`}>
                <div className="flex items-start gap-3">
                    <svg className={`h-5 w-5 mt-0.5 flex-shrink-0 ${colorTheme === 'purple' ? 'text-purple-500' :
                            colorTheme === 'green' ? 'text-green-500' :
                                colorTheme === 'orange' ? 'text-orange-500' :
                                    'text-blue-500'
                        }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                        <p className={`text-sm font-medium ${colorTheme === 'purple' ? 'text-purple-900' :
                                colorTheme === 'green' ? 'text-green-900' :
                                    colorTheme === 'orange' ? 'text-orange-900' :
                                        'text-blue-900'
                            }`}>{messageTitle}</p>
                        <p className={`text-sm mt-1 ${colorTheme === 'purple' ? 'text-purple-700' :
                                colorTheme === 'green' ? 'text-green-700' :
                                    colorTheme === 'orange' ? 'text-orange-700' :
                                        'text-blue-700'
                            }`}>
                            {messageSubtitle}
                        </p>
                    </div>
                </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-center gap-3">
                {windowClosed && quoteCount > 0 && (
                    <button
                        className="px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
                    >
                        Xem báo giá ({quoteCount})
                    </button>
                )}
                <button
                    onClick={onCancel}
                    className="px-6 py-3 border-2 border-red-500 text-red-600 font-medium rounded-lg hover:bg-red-50 transition-colors"
                >
                    Huỷ yêu cầu
                </button>
            </div>
        </div>
    );
}
