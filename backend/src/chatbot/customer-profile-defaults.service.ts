import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CustomerProfileDefaultsPayload {
    fullName: string | null;
    contactPhone: string | null;
    defaultVehicle: {
        type: string | null;
        licensePlate: string | null;
        color: string | null;
    };
    rescueVehicles: unknown[];
    hasDefaultAddress: boolean;
}

@Injectable()
export class CustomerProfileDefaultsService {
    constructor(private readonly prisma: PrismaService) {}

    async loadPayload(userId: string): Promise<CustomerProfileDefaultsPayload | null> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                fullName: true,
                phoneNumber: true,
                vehicleType: true,
                licensePlate: true,
                vehicleColor: true,
                rescueVehicles: true,
                defaultAddress: true,
            },
        });

        if (!user) return null;

        let defaultVehicle: CustomerProfileDefaultsPayload['defaultVehicle'] = {
            type: user.vehicleType || null,
            licensePlate: user.licensePlate || null,
            color: user.vehicleColor || null,
        };

        const vehicles = Array.isArray(user.rescueVehicles) ? user.rescueVehicles : [];
        if (!defaultVehicle.type && vehicles.length > 0) {
            const first = vehicles[0] as Record<string, unknown>;
            defaultVehicle = {
                type: (first.type as string) || null,
                licensePlate: (first.licensePlate as string) || null,
                color: (first.color as string) || null,
            };
        }

        return {
            fullName: user.fullName || null,
            contactPhone: user.phoneNumber || null,
            defaultVehicle,
            rescueVehicles: vehicles,
            hasDefaultAddress: !!user.defaultAddress,
        };
    }

    toToolResultJson(payload: CustomerProfileDefaultsPayload): string {
        return JSON.stringify({
            fullName: payload.fullName,
            contactPhone: payload.contactPhone,
            defaultVehicle: payload.defaultVehicle,
            rescueVehicles: payload.rescueVehicles,
            hasDefaultAddress: payload.hasDefaultAddress,
            note:
                'Thông tin này dùng để auto-fill tạo yêu cầu cứu hộ. Luôn hỏi xác nhận vị trí trước, không tự nêu địa chỉ cụ thể nếu chưa được user xác nhận.',
        });
    }
}
