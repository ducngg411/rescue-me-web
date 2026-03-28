/**
 * Server-side rules for which draft fields are still needed in the guided rescue flow.
 * Optional fields (plate, color) are listed only after all mandatory fields are present.
 */

export type GuidedDraftForMissing = {
    incidentType?: string;
    vehicleType?: string;
    contactPhone?: string;
    licensePlate?: string;
    vehicleColor?: string;
    pickupLocation?: unknown;
};

export type MissingFieldKey =
    | 'incidentType'
    | 'vehicleType'
    | 'contactPhone'
    | 'pickupLocation'
    | 'licensePlate'
    | 'vehicleColor';

const FIELD_LABELS_VI: Record<MissingFieldKey, string> = {
    incidentType: 'loại sự cố (incidentType)',
    vehicleType: 'loại xe CAR/MOTORCYCLE',
    contactPhone: 'số điện thoại liên hệ',
    pickupLocation: 'vị trí đón (pickupLocation đã xác thực)',
    licensePlate: 'biển số xe (tùy chọn, nên có)',
    vehicleColor: 'màu xe (tùy chọn, nên có)',
};

function isPickupComplete(loc: unknown): boolean {
    if (!loc || typeof loc !== 'object') return false;
    const pl = loc as { addressText?: string; lat?: unknown; lng?: unknown };
    return (
        typeof pl.addressText === 'string' &&
        pl.addressText.length > 0 &&
        typeof pl.lat === 'number' &&
        Number.isFinite(pl.lat) &&
        typeof pl.lng === 'number' &&
        Number.isFinite(pl.lng)
    );
}

/** Mandatory fields first (order), then optional suggestions. */
export function computeOrderedMissingFields(draft: GuidedDraftForMissing): MissingFieldKey[] {
    const missing: MissingFieldKey[] = [];
    if (!draft.incidentType?.trim()) missing.push('incidentType');
    if (!draft.vehicleType?.trim()) missing.push('vehicleType');
    if (!draft.contactPhone?.trim()) missing.push('contactPhone');
    if (!isPickupComplete(draft.pickupLocation)) missing.push('pickupLocation');

    const allMandatoryPresent =
        !!draft.incidentType?.trim() &&
        !!draft.vehicleType?.trim() &&
        !!draft.contactPhone?.trim() &&
        isPickupComplete(draft.pickupLocation);

    if (allMandatoryPresent) {
        if (!draft.licensePlate?.trim()) missing.push('licensePlate');
        if (!draft.vehicleColor?.trim()) missing.push('vehicleColor');
    }

    return missing;
}

export function buildCustomerKnownSnapshot(draft: GuidedDraftForMissing): Record<string, unknown> {
    const snap: Record<string, unknown> = {};
    if (draft.incidentType?.trim()) snap.incidentType = draft.incidentType.trim();
    if (draft.vehicleType?.trim()) snap.vehicleType = draft.vehicleType.trim();
    if (draft.contactPhone?.trim()) snap.contactPhone = draft.contactPhone.trim();
    if (draft.licensePlate?.trim()) snap.licensePlate = draft.licensePlate.trim();
    if (draft.vehicleColor?.trim()) snap.vehicleColor = draft.vehicleColor.trim();
    if (isPickupComplete(draft.pickupLocation)) {
        const pl = draft.pickupLocation as { addressText: string; lat: number; lng: number };
        snap.pickupLocation = {
            addressText: pl.addressText,
            lat: pl.lat,
            lng: pl.lng,
        };
    }
    return snap;
}

export function formatMissingFieldsDirective(missing: MissingFieldKey[]): string {
    if (missing.length === 0) {
        return `[MISSING_FOR_ORDER] (không còn trường bắt buộc thiếu; có thể hỏi nhẹ biển số/màu nếu chưa có và chưa hỏi).`;
    }
    const lines = missing.map((k, i) => `${i + 1}. ${FIELD_LABELS_VI[k]} (${k})`);
    return `[MISSING_FOR_ORDER] Chỉ được hỏi người dùng về các mục sau, đúng thứ tự; cấm hỏi lại trường đã có trong [CUSTOMER_KNOWN] trừ khi khách yêu cầu sửa:\n${lines.join('\n')}`;
}

export function formatCustomerKnownDirective(known: Record<string, unknown>): string {
    const keys = Object.keys(known);
    if (keys.length === 0) {
        return `[CUSTOMER_KNOWN] (chưa có trường nào trong draft — chỉ hỏi theo [MISSING_FOR_ORDER]).`;
    }
    return `[CUSTOMER_KNOWN] Dữ liệu đã có (tuyệt đối không hỏi lại các trường này trừ khi user nói sửa):\n${JSON.stringify(known, null, 2)}`;
}
