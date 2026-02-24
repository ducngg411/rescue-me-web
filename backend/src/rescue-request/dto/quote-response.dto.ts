export enum QuoteStatus {
    PENDING = 'PENDING',
    ACCEPTED = 'ACCEPTED',
    REJECTED = 'REJECTED',
    CANCELLED = 'CANCELLED',
    EXPIRED = 'EXPIRED',
}

export class ProviderInfoDto {
    id: string;
    name: string;
    avatar?: string;
    serviceName?: string;
    phoneNumber?: string;
    rating?: number; // Có thể thêm sau
}

export class QuoteResponseDto {
    id: string;
    rescueRequestId: string;
    providerId: string;
    price: number;
    estimatedArrivalMinutes: number;
    message?: string;
    status: QuoteStatus;
    rejectionReason?: string;
    userRespondedAt?: Date;
    providerLocation?: {
        lat: number;
        lng: number;
    };
    createdAt: Date;
    updatedAt: Date;
    expiresAt?: Date;

    // Provider info
    provider?: ProviderInfoDto;
}
