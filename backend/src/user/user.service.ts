import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserProfileDto } from '../auth/dto/auth.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class UserService {
    constructor(private prisma: PrismaService) { }

    async updateProfile(userId: string, dto: UpdateUserProfileDto, userRole: UserRole) {
        // Kiểm tra role phải là USER
        if (userRole !== UserRole.USER) {
            throw new ForbiddenException('Chỉ người dùng với role USER mới có thể cập nhật profile này');
        }

        // Tìm user
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('Người dùng không tồn tại');
        }

        const updateData: any = {
            name: dto.fullName,      // Sync name so all consumers see updated value
            fullName: dto.fullName,
            phoneNumber: dto.phoneNumber,
            contactEmail: dto.contactEmail,
            defaultAddress: dto.defaultAddress as any,
            profileCompleted: true,
        };

        if (dto.vehicleType) updateData.vehicleType = dto.vehicleType;
        if (dto.licensePlate) updateData.licensePlate = dto.licensePlate;
        if (dto.vehicleColor) updateData.vehicleColor = dto.vehicleColor;
        if (dto.avatar !== undefined) updateData.avatar = dto.avatar;
        if (dto.vehicles !== undefined) {
            updateData.rescueVehicles = dto.vehicles as any;
            // Sync primary vehicle columns with the first vehicle in the list
            if (dto.vehicles.length > 0) {
                const primary = dto.vehicles[0] as any;
                updateData.vehicleType = primary.type;
                updateData.licensePlate = primary.plateNumber;
                updateData.vehicleColor = primary.color || '';
            } else {
                // All vehicles removed — clear primary columns
                updateData.vehicleType = null;
                updateData.licensePlate = null;
                updateData.vehicleColor = null;
            }
        }

        // Cập nhật profile
        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: updateData,
        });

        // Loại bỏ hashedPassword
        const { hashedPassword, ...sanitized } = updatedUser;
        return sanitized;
    }

    async updateAvatar(userId: string, avatarUrl: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('Người dùng không tồn tại');
        }

        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: { avatar: avatarUrl },
        });

        const { hashedPassword, ...sanitized } = updatedUser;
        return sanitized;
    }

    async getProfile(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('Người dùng không tồn tại');
        }

        const { hashedPassword, ...sanitized } = user;
        return sanitized;
    }
}
