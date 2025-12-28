export type UserRole = 'user' | 'provider' | 'admin';

export interface User {
    uid: string;
    email: string;
    displayName: string | null;
    photoURL: string | null;
    phoneNumber: string | null;
    role: UserRole;
    profileCompleted: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface Location {
    latitude: number;
    longitude: number;
    address: string;
    placeName: string;
}

export type RequestStatus = 'CREATED' | 'MATCHING' | 'ASSIGNED' | 'ON_THE_WAY' | 'IN_PROGRESS' | 'AWAITING_USER_CONFIRMATION' | 'COMPLETED' | 'CANCELLED';
export type IncidentType = 'FLAT_TIRE' | 'OUT_OF_FUEL' | 'BATTERY_DEAD' | 'ENGINE_PROBLEM' | 'ACCIDENT' | 'OTHER';
export type VehicleType = 'CAR' | 'TRUCK' | 'MOTORCYCLE';
export type QuoteStatus = 'NONE' | 'QUOTED' | 'ACCEPTED' | 'REJECTED';
export type CancelReason = 'USER_CANCELLED' | 'PROVIDER_CANCELLED' | 'NO_PROVIDER' | 'OTHER';

export interface RescueRequest {
    requestId: string;
    userId: string;
    providerId?: string;
    incidentType: IncidentType;
    vehicleType: VehicleType;
    location: Location;
    description: string;
    status: RequestStatus;
    estimatedPrice?: number;
    providerQuotedPrice?: number;
    quoteStatus: QuoteStatus;
    quoteQuoteAt?: Date;
    quoteAcceptedAt?: Date;
    finalPrice?: number;
    finalPriceProposedAt?: Date;
    providerMarkedDoneAt?: Date;
    userConfirmedAt?: Date;
    cancelReason?: CancelReason;
    cancelledAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}