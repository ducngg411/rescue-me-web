/** Backend QR credits use e.g. "Thu nhập job QR • chờ giải ngân…"; wallet uses "qua ví RescueMe". */
export function isJobPaymentQrProviderTx(description: string | null | undefined): boolean {
    if (!description) return false;
    const d = description.toLowerCase();
    return d.includes('job qr') || (d.includes('qr') && d.includes('giải ngân'));
}
