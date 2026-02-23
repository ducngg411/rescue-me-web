'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';

interface ProviderSettingsData {
    serviceRadiusKm: number;
    phoneNumber: string;
    emergencyAvailable: boolean;
}

export default function ProviderSettings() {
    const [settings, setSettings] = useState<ProviderSettingsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await api.get('/me/provider/settings');
            if (response.data.success) {
                setSettings(response.data.data);
            }
        } catch (error: any) {
            console.error('Failed to fetch settings:', error);
            setMessage({ type: 'error', text: 'Không thể tải cài đặt' });
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!settings) return;

        setSaving(true);
        setMessage(null);

        try {
            const response = await api.patch('/me/provider/settings', settings);
            if (response.data.success) {
                setMessage({ type: 'success', text: 'Cập nhật thành công' });
            }
        } catch (error: any) {
            console.error('Failed to update settings:', error);
            setMessage({
                type: 'error',
                text: error.response?.data?.message || 'Không thể cập nhật cài đặt'
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto px-6 py-8">
                <div className="bg-white border rounded-lg p-8 text-center">
                    <div className="text-gray-600">Đang tải...</div>
                </div>
            </div>
        );
    }

    if (!settings) {
        return (
            <div className="max-w-4xl mx-auto px-6 py-8">
                <div className="bg-white border rounded-lg p-8 text-center">
                    <div className="text-gray-600">Không tìm thấy thông tin cài đặt</div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-6 py-8">
            <div className="bg-white border rounded-lg">
                <div className="px-6 py-4 border-b">
                    <h2 className="text-lg font-semibold text-gray-900">Cài đặt</h2>
                    <p className="text-sm text-gray-600 mt-1">Điều chỉnh khu vực và thông tin phục vụ</p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Message */}
                    {message && (
                        <div className={`px-4 py-3 rounded-lg text-sm ${message.type === 'success'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                            {message.text}
                        </div>
                    )}

                    {/* Service Radius - MAIN FEATURE */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                        <label className="block text-base font-semibold text-gray-900 mb-3">
                            Bán kính phục vụ
                        </label>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min="5"
                                max="50"
                                step="5"
                                value={settings.serviceRadiusKm || 10}
                                onChange={(e) => setSettings({ ...settings, serviceRadiusKm: parseInt(e.target.value) })}
                                className="flex-1 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                                style={{
                                    accentColor: '#3b82f6'
                                }}
                            />
                            <div className="text-3xl font-bold text-blue-600 w-24 text-right">
                                {settings.serviceRadiusKm || 10} km
                            </div>
                        </div>
                        <p className="text-sm text-gray-700 mt-3">
                            Khoảng cách tối đa bạn sẵn sàng di chuyển để cứu hộ khách hàng
                        </p>
                    </div>

                    {/* Phone Number */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Số điện thoại liên hệ
                        </label>
                        <input
                            type="tel"
                            value={settings.phoneNumber || ''}
                            onChange={(e) => setSettings({ ...settings, phoneNumber: e.target.value })}
                            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="0912345678"
                        />
                        <p className="text-xs text-gray-500 mt-1">Số điện thoại để khách hàng liên lạc khi cần hỗ trợ</p>
                    </div>

                    {/* Emergency Service */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                        <div>
                            <div className="text-sm font-medium text-gray-900">Phục vụ 24/7</div>
                            <div className="text-xs text-gray-600 mt-1">Sẵn sàng nhận yêu cầu bất kỳ lúc nào</div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSettings({ ...settings, emergencyAvailable: !settings.emergencyAvailable })}
                            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${settings.emergencyAvailable ? 'bg-green-500' : 'bg-gray-300'
                                }`}
                        >
                            <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${settings.emergencyAvailable ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button
                            type="button"
                            onClick={fetchSettings}
                            className="px-6 py-2 text-gray-700 hover:bg-gray-50 border rounded-lg transition-colors"
                            disabled={saving}
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
