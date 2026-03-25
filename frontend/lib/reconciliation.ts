/** Fallback keeps old UIs working before backfill / for legacy rows. */
export function displayOrderCode(orderCode: string | null | undefined, requestId: string): string {
    const c = orderCode?.trim();
    if (c) return c;
    return requestId.slice(0, 8).toUpperCase();
}

export function displayWalletTxnCode(txnCode: string | null | undefined, internalId: string): string {
    const c = txnCode?.trim();
    if (c) return c;
    return internalId.slice(-8).toUpperCase();
}

/** Short ref for dispute case id (internal). */
export function displayDisputeCaseRef(caseId: string): string {
    return caseId.slice(0, 8).toUpperCase();
}
