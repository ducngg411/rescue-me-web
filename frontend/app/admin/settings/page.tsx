'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { adminApi } from '@/lib/api';
import AdminLayout from '@/components/AdminLayout';
import { Settings, Save, Smartphone, AlertCircle } from 'lucide-react';
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
    const { t } = useLanguage();
    const s = (key: string) => t(`admin.settings.${key}`);

    const [platformName, setPlatformName] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!authLoading && (!user || user.role !== 'ADMIN')) {
            router.replace('/admin/login');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (!user || user.role !== 'ADMIN') return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const data = await adminApi.getSettings();
                if (cancelled) return;
                const name = (data.platformName || '').trim();
                setPlatformName(name || t('admin.settings.defaultPlatformName'));
            } catch (err) {
                console.error(err);
                if (!cancelled) {
                    toast.error(t('admin.settings.toastLoadError'));
                    setPlatformName(t('admin.settings.defaultPlatformName'));
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [user, t]);

    const handleSaveSettings = async () => {
        if (!platformName.trim()) {
            toast.error(s('toastEmptyName'));
            return;
        }

        setSaving(true);
        try {
            await adminApi.updateSettings(platformName.trim());
            toast.success(s('toastSaveSuccess'));
        } catch (err) {
            console.error(err);
            toast.error(s('toastSaveError'));
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
                <div className="mb-6">
                    <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: C.navy }}>
                        <Settings className="w-6 h-6" style={{ color: C.orange }} />
                        {s('title')}
                    </h1>
                    <p className="mt-1 text-sm font-medium" style={{ color: C.gray }}>
                        {s('subtitle')}
                    </p>
                </div>

                <div className="bg-white rounded-2xl border p-6 shadow-sm mb-6" style={{ borderColor: C.grayLight }}>
                    <div className="mb-5 pb-4 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold" style={{ color: C.navy }}>{s('sectionTitle')}</h2>
                            <p className="text-xs" style={{ color: C.gray }}>{s('sectionDesc')}</p>
                        </div>
                        <Smartphone className="w-5 h-5 text-slate-300" />
                    </div>

                    <div className="space-y-6 max-w-lg">
                        <div>
                            <label className="block text-sm font-bold mb-2" style={{ color: C.navy }}>{s('platformNameLabel')}</label>
                            <input
                                type="text"
                                className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 transition-all font-medium"
                                style={{ borderColor: C.grayLight, color: C.navy }}
                                value={platformName}
                                onChange={(e) => setPlatformName(e.target.value)}
                                placeholder={s('platformNamePlaceholder')}
                            />
                            <p className="mt-1.5 text-xs flex items-center gap-1" style={{ color: C.gray }}>
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {s('platformNameHint')}
                            </p>
                        </div>

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
                                {s('saveChanges')}
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </AdminLayout>
    );
}
