import type { Prisma } from '@prisma/client';

const ALNUM = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Display label for support (emails, descriptions) — same idea as frontend displayOrderCode */
export function formatOrderLabelForSupport(orderCode: string | null | undefined, requestId: string): string {
    const c = orderCode?.trim();
    if (c) return c;
    return requestId.slice(0, 8).toUpperCase();
}

export function randomAlnum(len: number): string {
    return Array.from({ length: len }, () => ALNUM[Math.floor(Math.random() * ALNUM.length)]).join('');
}

/** Public order id for RescueRequest — RMO-YYMMDD-XXXX */
export function generateOrderCodeCandidate(d = new Date()): string {
    const y = String(d.getFullYear() % 100).padStart(2, '0');
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `RMO-${y}${m}${day}-${randomAlnum(4)}`;
}

/** Provider wallet ledger line */
export function generateProviderWalletTxnCodeCandidate(): string {
    return `TXP${randomAlnum(7)}`;
}

/** User wallet ledger line */
export function generateUserWalletTxnCodeCandidate(): string {
    return `TXU${randomAlnum(7)}`;
}

/** Provider SePay VietQR transfer content (not RMJ, not RU) */
export function generateProviderTopupTransferCandidate(): string {
    return `RM${randomAlnum(7)}`;
}

/** User SePay transfer content */
export function generateUserTopupTransferCandidate(): string {
    return `RU${randomAlnum(7)}`;
}

/** Reconciliation id on topup rows (separate from bank transferCode) */
export function generateProviderTopupTxnCodeCandidate(): string {
    return `TNP${randomAlnum(7)}`;
}

export function generateUserTopupTxnCodeCandidate(): string {
    return `TNU${randomAlnum(7)}`;
}

/** Job QR payment row reconciliation id */
export function generateJobPaymentTxnCodeCandidate(): string {
    return `JP${randomAlnum(7)}`;
}

type Db = Prisma.TransactionClient;

export async function allocateUniqueOrderCode(db: Db, maxAttempts = 20): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
        const code = generateOrderCodeCandidate();
        const clash = await db.rescueRequest.findUnique({ where: { orderCode: code } });
        if (!clash) return code;
    }
    throw new Error('Could not allocate unique orderCode');
}

export async function allocateUniqueProviderWalletTxnCode(db: Db, maxAttempts = 20): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
        const code = generateProviderWalletTxnCodeCandidate();
        const clash = await db.walletTransaction.findUnique({ where: { txnCode: code } });
        if (!clash) return code;
    }
    throw new Error('Could not allocate unique provider wallet txnCode');
}

export async function allocateUniqueUserWalletTxnCode(db: Db, maxAttempts = 20): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
        const code = generateUserWalletTxnCodeCandidate();
        const clash = await db.userWalletTransaction.findUnique({ where: { txnCode: code } });
        if (!clash) return code;
    }
    throw new Error('Could not allocate unique user wallet txnCode');
}

export async function allocateUniqueProviderTopupTxnCode(db: Db, maxAttempts = 20): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
        const code = generateProviderTopupTxnCodeCandidate();
        const clash = await db.topupTransaction.findUnique({ where: { txnCode: code } });
        if (!clash) return code;
    }
    throw new Error('Could not allocate unique provider topup txnCode');
}

export async function allocateUniqueUserTopupTxnCode(db: Db, maxAttempts = 20): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
        const code = generateUserTopupTxnCodeCandidate();
        const clash = await db.userTopupTransaction.findUnique({ where: { txnCode: code } });
        if (!clash) return code;
    }
    throw new Error('Could not allocate unique user topup txnCode');
}

export async function allocateUniqueJobPaymentTxnCode(db: Db, maxAttempts = 20): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
        const code = generateJobPaymentTxnCodeCandidate();
        const clash = await (db as any).jobPaymentTransaction.findUnique({ where: { txnCode: code } });
        if (!clash) return code;
    }
    throw new Error('Could not allocate unique job payment txnCode');
}

/** Unique transfer content for one provider topup attempt; avoids collision with job (RMJ) and user (RU). */
export async function allocateUniqueProviderTopupTransferCode(db: Db, maxAttempts = 25): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
        const code = generateProviderTopupTransferCandidate();
        // Avoid any ambiguity with job QR prefix RMJ (10 chars) in bank parsers
        if (code.startsWith('RMJ')) continue;
        const [inTopup, inJob, inUserTopup] = await Promise.all([
            db.topupTransaction.findFirst({ where: { transferCode: code } }),
            (db as any).jobPaymentTransaction.findUnique({ where: { transferCode: code } }),
            db.userTopupTransaction.findFirst({ where: { transferCode: code } }),
        ]);
        if (!inTopup && !inJob && !inUserTopup) return code;
    }
    throw new Error('Could not allocate unique provider topup transfer code');
}

export async function allocateUniqueUserTopupTransferCode(db: Db, maxAttempts = 25): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
        const code = generateUserTopupTransferCandidate();
        const [inTopup, inJob, inUserTopup] = await Promise.all([
            db.topupTransaction.findFirst({ where: { transferCode: code } }),
            (db as any).jobPaymentTransaction.findUnique({ where: { transferCode: code } }),
            db.userTopupTransaction.findFirst({ where: { transferCode: code } }),
        ]);
        if (!inTopup && !inJob && !inUserTopup) return code;
    }
    throw new Error('Could not allocate unique user topup transfer code');
}
