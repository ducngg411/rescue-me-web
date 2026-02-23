'use client';

export default function WaitingState() {
    return (
        <div className="max-w-6xl mx-auto px-6 py-8">
            {/* Main Card */}
            <div className="bg-white rounded-lg border p-8 mb-6">
                {/* Status */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg mb-4">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium text-green-700">Đang chờ yêu cầu</span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Sẵn sàng nhận yêu cầu cứu hộ
                    </h3>
                    <p className="text-gray-600">
                        Hệ thống sẽ tự động thông báo khi có khách hàng cần cứu hộ gần bạn
                    </p>
                </div>

                {/* Info Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-900 mb-1">Khu vực phục vụ</div>
                        <div className="text-xs text-gray-600">Theo bán kính cài đặt</div>
                    </div>

                    <div className="border rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-900 mb-1">Thời gian phản hồi</div>
                        <div className="text-xs text-gray-600">60 giây để quyết định</div>
                    </div>

                    <div className="border rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-900 mb-1">Thu nhập</div>
                        <div className="text-xs text-gray-600">Hiển thị dự kiến trước khi nhận</div>
                    </div>
                </div>
            </div>

            {/* Tips Section */}
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
                <h4 className="font-semibold text-gray-900 mb-3">
                    Mẹo để nhận nhiều yêu cầu hơn
                </h4>
                <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start gap-2">
                        <span className="text-blue-600 mt-0.5">•</span>
                        <span>Giữ ứng dụng mở và online trong giờ cao điểm (7-9h sáng, 17-20h chiều)</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-blue-600 mt-0.5">•</span>
                        <span>Phản hồi nhanh để tăng rating và ưu tiên trong hệ thống matching</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-blue-600 mt-0.5">•</span>
                        <span>Đảm bảo GPS luôn được bật để matching chính xác nhất</span>
                    </li>
                </ul>
            </div>
        </div>
    );
}
