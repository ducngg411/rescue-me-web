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

        // Cập nhật profile
        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: {
                fullName: dto.fullName,
                phoneNumber: dto.phoneNumber,
                contactEmail: dto.contactEmail,
                defaultAddress: dto.defaultAddress as any,
                vehicleType: dto.vehicleType,
                licensePlate: dto.licensePlate,
                vehicleColor: dto.vehicleColor,
                profileCompleted: true, // Đánh dấu hoàn thành profile
            },
        });

        // Loại bỏ hashedPassword
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
