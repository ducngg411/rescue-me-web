'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { XMarkIcon, UserPlusIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '@/contexts/LanguageContext';
import { convertGuestToUser } from '@/lib/guest-auth';
import { useGuest } from '@/contexts/GuestContext';
import toast from 'react-hot-toast';

interface GuestRegisterModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function GuestRegisterModal({ isOpen, onClose }: GuestRegisterModalProps) {
    const { t } = useLanguage();
    const router = useRouter();
    const { guestToken, clearGuest } = useGuest();
    const [converting, setConverting] = useState(false);
    const [converted, setConverted] = useState(false);

    if (!isOpen) return null;

    const handleRegister = () => {
        router.push('/auth/register');
        onClose();
    };

    const handleConvertWithExistingAccount = async () => {
        const userToken = localStorage.getItem('accessToken');
        if (!userToken) {
            router.push('/auth/login');
            onClose();
            return;
        }

        setConverting(true);
        try {
            await convertGuestToUser(userToken);
            setConverted(true);
            toast.success(t('guest.register.convertSuccess'));
            await clearGuest();
            setTimeout(() => {
                router.push('/user');
            }, 1500);
        } catch {
            toast.error(t('guest.register.convertError'));
        } finally {
            setConverting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                    <XMarkIcon className="h-5 w-5" />
                </button>

                {converted ? (
                    <div className="text-center py-4">
                        <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-3" />
                        <p className="text-lg font-semibold text-gray-900">{t('guest.register.convertSuccess')}</p>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-amber-100 rounded-full p-3">
                                <UserPlusIcon className="h-6 w-6 text-amber-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">
                                    {t('guest.register.modalTitle')}
                                </h2>
                            </div>
                        </div>

                        <p className="text-sm text-gray-600 mb-6">
                            {t('guest.register.modalDesc')}
                        </p>

                        <div className="space-y-3">
                            <button
                                onClick={handleRegister}
                                className="w-full bg-red-600 text-white py-3 rounded-xl font-semibold hover:bg-red-700 transition-colors"
                            >
                                {t('guest.register.registerBtn')}
                            </button>

                            {localStorage.getItem('accessToken') && (
                                <button
                                    onClick={handleConvertWithExistingAccount}
                                    disabled={converting}
                                    className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                                >
                                    {converting ? t('guest.register.converting') : 'Liên kết với tài khoản hiện có'}
                                </button>
                            )}

                            <button
                                onClick={onClose}
                                className="w-full text-gray-500 py-2 text-sm hover:text-gray-700 transition-colors"
                            >
                                {t('guest.register.skipBtn')}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
