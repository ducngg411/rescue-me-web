'use client';

const C = {
    orange: '#f97316',
    orangeLight: '#fff7ed',
    navy: '#1a1a2e',
    gray: '#6b7280',
    border: '#f1f5f9',
    bg: '#f8fafc',
};

interface ExpiredRetryProps {
    onRetry: () => void;
    onCancel: () => void;
    isRetrying?: boolean;
}

export default function ExpiredRetry({ onRetry, onCancel, isRetrying = false }: ExpiredRetryProps) {
    return (
        <div className="space-y-3">
            {/* Status badge */}
            <div className="flex justify-center">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold" style={{ background: '#fefce8', color: '#ca8a04' }}>
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Không có provider
                </div>
            </div>

            {/* Main card */}
            <div className="bg-white rounded-2xl p-6 text-center" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                {/* Icon */}
                <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: '#fefce8' }}>
                    <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="#ca8a04" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>

                <h3 className="text-base font-bold mb-1" style={{ color: C.navy }}>Không tìm thấy provider</h3>
                <p className="text-sm mb-5" style={{ color: C.gray }}>
                    Hiện không có provider nào trong khu vực của bạn. Vui lòng thử lại sau ít phút.
                </p>

                {/* Tips */}
                <div className="rounded-xl p-3.5 mb-5 text-left" style={{ background: C.orangeLight }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: C.navy }}>💡 Gợi ý:</p>
                    <ul className="space-y-1 text-xs" style={{ color: C.gray }}>
                        <li>• Thử lại sau 5–10 phút</li>
                        <li>• Kiểm tra lại vị trí của bạn</li>
                        <li>• Liên hệ hotline nếu cần gấp</li>
                    </ul>
                </div>

                {/* Action buttons */}
                <div className="space-y-2.5">
                    <button
                        onClick={onRetry}
                        disabled={isRetrying}
                        className="w-full py-3 rounded-xl text-sm font-bold text-white transition-opacity flex items-center justify-center gap-2"
                        style={{
                            background: isRetrying ? '#fdba74' : `linear-gradient(135deg, ${C.orange}, #ea6c0a)`,
                            cursor: isRetrying ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {isRetrying ? (
                            <>
                                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>
                                Đang thử lại...
                            </>
                        ) : (
                            <>
                                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Thử lại ngay
                            </>
                        )}
                    </button>
                    <button
                        onClick={onCancel}
                        disabled={isRetrying}
                        className="w-full py-3 rounded-xl text-sm font-medium transition-colors"
                        style={{ background: C.bg, color: C.gray, border: `1px solid ${C.border}` }}
                    >
                        Huỷ yêu cầu
                    </button>
                </div>
            </div>

            {/* Hotline */}
            <div className="bg-white rounded-2xl p-3.5 flex items-center justify-between" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
                <div>
                    <p className="text-xs font-semibold" style={{ color: C.navy }}>Cần hỗ trợ gấp?</p>
                    <p className="text-xs" style={{ color: C.gray }}>Gọi trực tiếp đường dây hỗ trợ</p>
                </div>
                <a
                    href="tel:1900xxxx"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                    style={{ background: C.orange }}
                >
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    1900 xxxx
                </a>
            </div>
        </div>
    );
}
