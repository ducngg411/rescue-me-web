'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { adminApi } from '@/lib/api';
import AdminLayout from '@/components/AdminLayout';
import { Settings, Save, Smartphone, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

const C = {
    bg: '#f8fafc',
    white: '#ffffff',
    navy: '#0f172a',
    gray: '#64748b',
    grayLight: '#e2e8f0',
    border: '#f1f5f9',
    orange: '#f97316',
    orangeHover: '#ea580c',
    orangeLight: '#fff7ed',
    green: '#10b981',
    greenLight: '#d1fae5',
    red: '#ef4444',
    redLight: '#fee2e2',
};

export default function AdminSettingsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [platformName, setPlatformName] = useState('Rescue Me');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!authLoading && (!user || user.role !== 'ADMIN')) {
            router.replace('/admin/login');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const data = await adminApi.getSettings();
                setPlatformName(data.platformName || 'Rescue Me');
            } catch (err) {
                console.error(err);
                toast.error('Lỗi khi tải cài đặt nền tảng');
            } finally {
                setLoading(false);
            }
        };

        if (user && user.role === 'ADMIN') {
            fetchSettings();
        }
    }, [user]);

    const handleSaveSettings = async () => {
        if (!platformName.trim()) {
            toast.error('Tên hệ thống không được để trống');
            return;
        }

        setSaving(true);
        try {
            await adminApi.updateSettings(platformName.trim());
            toast.success('Lưu cài đặt thành công');
        } catch (err) {
            console.error(err);
            toast.error('Có lỗi xảy ra khi lưu cài đặt');
        } finally {
            setSaving(false);
        }
    };

    if (authLoading || loading) {
        return (
            <AdminLayout activeTab="/admin/settings">
                <div className="min-h-screen flex items-center justify-center bg-slate-50">
                    <div className="w-10 h-10 rounded-full border-[3px] border-t-transparent animate-spin" style={{ borderColor: C.orange, borderTopColor: 'transparent' }} />
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout activeTab="/admin/settings">
            <div className="p-6 max-w-4xl mx-auto min-h-screen">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: C.navy }}>
                        <Settings className="w-6 h-6" style={{ color: C.orange }} />
                        Cài đặt Hệ thống
                    </h1>
                    <p className="mt-1 text-sm font-medium" style={{ color: C.gray }}>
                        Quản lý các thông tin hiển thị chung và cấu hình hệ thống
                    </p>
                </div>

                <div className="bg-white rounded-2xl border p-6 shadow-sm mb-6" style={{ borderColor: C.grayLight }}>
                    <div className="mb-5 pb-4 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold" style={{ color: C.navy }}>Thông tin hiển thị</h2>
                            <p className="text-xs" style={{ color: C.gray }}>Các thông tin này sẽ hiển thị ở Tiêu đề và Ứng dụng</p>
                        </div>
                        <Smartphone className="w-5 h-5 text-slate-300" />
                    </div>

                    <div className="space-y-6 max-w-lg">
                        {/* Platform Name */}
                        <div>
                            <label className="block text-sm font-bold mb-2" style={{ color: C.navy }}>Tên hệ thống (Platform Name)</label>
                            <input
                                type="text"
                                className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all font-medium"
                                style={{ borderColor: C.grayLight, color: C.navy }}
                                value={platformName}
                                onChange={(e) => setPlatformName(e.target.value)}
                                placeholder="VD: Rescue Me..."
                            />
                            <p className="mt-1.5 text-xs flex items-center gap-1" style={{ color: C.gray }}>
                                <AlertCircle className="w-3.5 h-3.5" /> Sử dụng ngắn gọn để hiển thị tốt trên Header
                            </p>
                        </div>

                        {/* Save Button */}
                        <div className="pt-2">
                            <button
                                onClick={handleSaveSettings}
                                disabled={saving}
                                className="flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-bold transition-transform active:scale-95 disabled:opacity-70 disabled:active:scale-100"
                                style={{ background: C.orange }}
                            >
                                {saving ? (
                                    <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin border-white" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                Lưu Thay Đổi
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </AdminLayout>
    );
}
