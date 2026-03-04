'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';

export default function WaitingState() {
    const { user } = useAuth();
    const [showDebug, setShowDebug] = useState(false);
    const [debugInfo, setDebugInfo] = useState<any>(null);

    useEffect(() => {
        if (showDebug && user) {
            loadDebugInfo();
        }
    }, [showDebug, user]);

    const loadDebugInfo = async () => {
        try {
            const [profileRes, settingsRes] = await Promise.all([
                api.get('/me/provider/profile'),
                api.get('/me/provider/settings')
            ]);
            setDebugInfo({
                profile: profileRes.data,
                settings: settingsRes.data.data
            });
        } catch (err) {
            console.error('Failed to load debug info:', err);
        }
    };

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

                {/* Debug Button */}
                <div className="text-center mb-4">
                    <button
                        onClick={() => setShowDebug(!showDebug)}
                        className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                        {showDebug ? '🔼 Ẩn thông tin debug' : '🔽 Tại sao tôi không nhận được yêu cầu?'}
                    </button>
                </div>

                {/* Debug Panel */}
                {showDebug && debugInfo && (
                    <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            🔍 Thông tin Matching
                        </h4>
                        <div className="space-y-3 text-sm">
                            {/* Current Location Check (GPS) */}
                            {debugInfo.profile.currentLocation?.lat && debugInfo.profile.currentLocation?.lng ? (
                                <div className="flex items-start gap-2">
                                    <span className="text-green-600"></span>
                                    <div className="flex-1">
                                        <div className="font-medium text-green-700">Đang dùng vị trí GPS THỜI GIAN THỰC</div>
                                        <div className="text-gray-600">Tọa độ: {debugInfo.profile.currentLocation.lat.toFixed(4)}, {debugInfo.profile.currentLocation.lng.toFixed(4)}</div>
                                        {debugInfo.profile.lastLocationUpdate && (
                                            <div className="text-xs text-gray-500">
                                                Cập nhật: {new Date(debugInfo.profile.lastLocationUpdate).toLocaleTimeString('vi-VN')}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-start gap-2">
                                    <span className="text-yellow-600">⚠️</span>
                                    <div className="flex-1">
                                        <div className="font-medium text-yellow-700">CHƯA CÓ VỊ TRÍ GPS</div>
                                        <div className="text-yellow-600">Hệ thống sẽ dùng địa chỉ mặc định (không chính xác)</div>
                                    </div>
                                </div>
                            )}

                            {/* Default Address Fallback */}
                            <div className="flex items-start gap-2">
                                {debugInfo.profile.permanentAddress?.lat && debugInfo.profile.permanentAddress?.lng ? (
                                    <>
                                        <span className="text-blue-600">📍</span>
                                        <div className="flex-1">
                                            <div className="font-medium">Địa chỉ mặc định: {debugInfo.profile.permanentAddress.addressText}</div>
                                            <div className="text-gray-600 text-xs">(Dùng nếu không có GPS)</div>
                                        </div>
                                    </>
                                ) : debugInfo.profile.businessAddress?.lat && debugInfo.profile.businessAddress?.lng ? (
                                    <>
                                        <span className="text-blue-600">📍</span>
                                        <div className="flex-1">
                                            <div className="font-medium">Địa chỉ doanh nghiệp: {debugInfo.profile.businessAddress.addressText}</div>
                                            <div className="text-gray-600 text-xs">(Dùng nếu không có GPS)</div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-red-600">❌</span>
                                        <div className="flex-1">
                                            <div className="font-medium text-red-700">THIẾU ĐỊA CHỈ MẶC ĐỊNH</div>
                                            <div className="text-red-600">Nếu GPS không hoạt động, bạn sẽ không nhận được requests</div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Service Radius */}
                            <div className="flex items-start gap-2">
                                <span className="text-blue-600">📍</span>
                                <div className="flex-1">
                                    <div className="font-medium">Bán kính phục vụ: {debugInfo.settings.serviceRadiusKm || 15} km</div>
                                    <div className="text-gray-600">Chỉ nhận yêu cầu trong bán kính này</div>
                                </div>
                            </div>

                            {/* Service Types */}
                            <div className="flex items-start gap-2">
                                {debugInfo.profile.serviceTypes?.length > 0 ? (
                                    <>
                                        <span className="text-green-600"></span>
                                        <div className="flex-1">
                                            <div className="font-medium">Dịch vụ: {debugInfo.profile.serviceTypes.join(', ')}</div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-red-600">❌</span>
                                        <div className="flex-1">
                                            <div className="font-medium text-red-700">Chưa chọn loại dịch vụ</div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Supported Vehicle Types */}
                            <div className="flex items-start gap-2">
                                {debugInfo.profile.supportedVehicleTypes?.length > 0 ? (
                                    <>
                                        <span className="text-green-600"></span>
                                        <div className="flex-1">
                                            <div className="font-medium">Hỗ trợ xe: {debugInfo.profile.supportedVehicleTypes.join(', ')}</div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-red-600">❌</span>
                                        <div className="flex-1">
                                            <div className="font-medium text-red-700">Chưa chọn loại xe hỗ trợ</div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Online Status */}
                            <div className="flex items-start gap-2">
                                <span className="text-green-600"></span>
                                <div className="flex-1">
                                    <div className="font-medium">Trạng thái: Online</div>
                                </div>
                            </div>

                            {/* Verification Status */}
                            <div className="flex items-start gap-2">
                                <span className="text-green-600"></span>
                                <div className="flex-1">
                                    <div className="font-medium">Đã xác minh: APPROVED</div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 p-3 bg-white border border-yellow-300 rounded text-xs text-gray-700">
                            <strong>💡 Cơ chế Matching mới (GPS Real-time):</strong>
                            <ul className="list-disc ml-5 mt-2 space-y-1">
                                <li><strong>Ưu tiên:</strong> Hệ thống dùng vị trí GPS hiện tại của bạn để matching chính xác</li>
                                <li><strong>Fallback:</strong> Nếu GPS không hoạt động, sẽ dùng địa chỉ mặc định (kém chính xác)</li>
                                <li><strong>Lưu ý:</strong> Để nhận requests tốt nhất, hãy luôn bật GPS và cấp quyền truy cập vị trí</li>
                            </ul>
                        </div>
                    </div>
                )}

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
