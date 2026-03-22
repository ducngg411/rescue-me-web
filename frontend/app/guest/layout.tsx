import type { Metadata } from 'next';
import GuestRegisterCta from '@/components/GuestRegisterCta';

export const metadata: Metadata = {
    title: 'Rescue Me – Gọi cứu hộ',
    description: 'Gọi cứu hộ khẩn cấp không cần đăng ký',
};

export default function GuestLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-gray-50">
            <GuestRegisterCta compact />
            {children}
        </div>
    );
}
