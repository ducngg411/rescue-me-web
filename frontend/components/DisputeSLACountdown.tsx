'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const BG_CREAM = '#fffbeb';
const FG_AMBER = '#ca8a04';
const BG_OVERDUE = '#fef2f2';
const FG_OVERDUE = '#dc2626';

export function DisputeSLACountdown({ dueAt }: { dueAt: string | null }) {
    const { t } = useLanguage();
    const [remaining, setRemaining] = useState('');
    const [overdue, setOverdue] = useState(false);

    useEffect(() => {
        if (!dueAt) return;
        const tick = () => {
            const diff = new Date(dueAt).getTime() - Date.now();
            if (diff <= 0) {
                setOverdue(true);
                setRemaining(t('user.disputes.detail.slaOverdue'));
                return;
            }
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setRemaining(
                t('user.disputes.detail.slaRemaining', {
                    hours: String(h),
                    minutes: String(m),
                    seconds: String(s),
                }),
            );
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [dueAt, t]);

    if (!dueAt) return null;

    return (
        <span
            className="inline-flex items-center gap-1.5 rounded-full text-sm font-bold leading-none px-2.5 py-1"
            style={{
                background: overdue ? BG_OVERDUE : BG_CREAM,
                color: overdue ? FG_OVERDUE : FG_AMBER,
                boxShadow: 'none',
                border: 'none',
            }}
        >
            <Clock size={15} strokeWidth={2} aria-hidden style={{ color: overdue ? FG_OVERDUE : FG_AMBER }} />
            {remaining}
        </span>
    );
}
