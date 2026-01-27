'use client';

interface ExpiredRetryProps {
    onRetry: () => void;
    onCancel: () => void;
    isRetrying?: boolean;
}

export default function ExpiredRetry({ onRetry, onCancel, isRetrying = false }: ExpiredRetryProps) {
    return (
        <div className="bg-white rounded-lg shadow-sm p-6">
            {/* Status Badge */}
            <div className="flex justify-center mb-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-50 border-2 border-yellow-200 rounded-full">
                    <svg className="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-yellow-700 font-medium">Không có provider</span>
                </div>
            </div>

            {/* Sad Icon */}
            <div className="flex justify-center mb-6">
                <div className="h-24 w-24 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg className="h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                Không tìm thấy provider
            </h3>

            {/* Message */}
            <p className="text-center text-gray-600 mb-6">
                Hiện không có provider nào trong khu vực của bạn.
                <br />
                Vui lòng thử lại sau ít phút.
            </p>

            {/* Info Box */}
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                    <svg className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm text-blue-900">
                        <p className="font-medium mb-1">Gợi ý:</p>
                        <ul className="list-disc list-inside space-y-1 text-blue-800">
                            <li>Thử lại sau 5-10 phút</li>
                            <li>Kiểm tra lại vị trí của bạn</li>
                            <li>Liên hệ hotline nếu cần gấp</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
                <button
                    onClick={onRetry}
                    disabled={isRetrying}
                    className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isRetrying ? (
                        <>
                            <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Đang thử lại...</span>
                        </>
                    ) : (
                        <>
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Thử lại</span>
                        </>
                    )}
                </button>

                <button
                    onClick={onCancel}
                    disabled={isRetrying}
                    className="w-full px-6 py-3 border-2 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Huỷ yêu cầu
                </button>
            </div>

            {/* Hotline */}
            <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-center text-sm text-gray-600 mb-3">
                    Cần hỗ trợ gấp?
                </p>
                <a
                    href="tel:1900xxxx"
                    className="flex items-center justify-center gap-2 text-blue-600 font-medium hover:text-blue-700"
                >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <span>Gọi hotline: 1900 xxxx</span>
                </a>
            </div>
        </div>
    );
}
