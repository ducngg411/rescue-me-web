import type { Prisma } from '@prisma/client';

/**
 * Gross job amount for stats: prefer positive payment.totalAmount, else accepted quote price.
 * totalAmount 0 is treated as missing (e.g. CASH flow before backfill).
 */
export function grossRevenueFromCompletedRequest(req: {
    payment?: { totalAmount: number | null } | null;
    quotes?: { price: number }[];
}): number {
    const t = req.payment?.totalAmount;
    if (t != null && t > 0) return t;
    if (req.quotes && req.quotes.length > 0) return req.quotes[0].price;
    return 0;
}

/** Jobs finished (COMPLETED/PAID) with completion timestamp in [dayStart, dayEndExclusive) local day. */
export function whereCompletedJobsInLocalDay(
    providerId: string,
    dayStart: Date,
    dayEndExclusive: Date,
): Prisma.RescueRequestWhereInput {
    return {
        assignedProviderId: providerId,
        status: { in: ['COMPLETED', 'PAID'] },
        OR: [
            { completedAt: { gte: dayStart, lt: dayEndExclusive } },
            {
                AND: [{ completedAt: null }, { updatedAt: { gte: dayStart, lt: dayEndExclusive } }],
            },
        ],
    };
}

export function whereCompletedJobsInTimeRange(
    providerId: string,
    rangeStart: Date,
    rangeEndExclusive: Date,
): Prisma.RescueRequestWhereInput {
    return {
        assignedProviderId: providerId,
        status: { in: ['COMPLETED', 'PAID'] },
        OR: [
            { completedAt: { gte: rangeStart, lt: rangeEndExclusive } },
            {
                AND: [{ completedAt: null }, { updatedAt: { gte: rangeStart, lt: rangeEndExclusive } }],
            },
        ],
    };
}
