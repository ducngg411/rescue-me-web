import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProviderProfileDto } from '../auth/dto/auth.dto';
import { UserRole, VerificationStatus, ProviderType } from '@prisma/client';

@Injectable()
export class ProviderService {
    constructor(private prisma: PrismaService) { }

    async updateProfile(userId: string, dto: UpdateProviderProfileDto, userRole: UserRole) {
        // Kiểm tra role phải là PROVIDER
        if (userRole !== UserRole.PROVIDER) {
            throw new ForbiddenException('Chỉ người dùng với role PROVIDER mới có thể cập nhật profile này');
        }

        // Validation logic dựa trên providerType
        if (dto.providerType === ProviderType.BUSINESS) {
            if (!dto.businessName) {
                throw new ForbiddenException('Tên doanh nghiệp là bắt buộc đối với loại BUSINESS');
            }
            if (!dto.businessAddress) {
                throw new ForbiddenException('Địa chỉ doanh nghiệp là bắt buộc đối với loại BUSINESS');
            }
        } else if (dto.providerType === ProviderType.INDIVIDUAL) {
            if (!dto.permanentAddress) {
                throw new ForbiddenException('Địa chỉ thường trú là bắt buộc đối với loại INDIVIDUAL');
            }
        }

        // Validation biển số dựa trên supportedVehicleTypes
        const hasCar = dto.supportedVehicleTypes.includes('CAR');
        const hasMotorcycle = dto.supportedVehicleTypes.includes('MOTORCYCLE');

        if (hasCar && !dto.carPlateNumber) {
            throw new ForbiddenException('Biển số ô tô là bắt buộc khi hỗ trợ phương tiện CAR');
        }
        if (hasMotorcycle && !dto.motorcyclePlateNumber) {
            throw new ForbiddenException('Biển số xe máy là bắt buộc khi hỗ trợ phương tiện MOTORCYCLE');
        }

        // Tìm user
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('Người dùng không tồn tại');
        }

        // Cập nhật provider profile với trạng thái DRAFT
        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: {
                fullName: dto.fullName,
                phoneNumber: dto.phoneNumber,
                providerType: dto.providerType,
                businessName: dto.providerType === ProviderType.BUSINESS ? dto.businessName : null,
                serviceTypes: dto.serviceTypes,
                supportedVehicleTypes: dto.supportedVehicleTypes,
                serviceRadiusKm: dto.serviceRadiusKm,
                permanentAddress: dto.providerType === ProviderType.INDIVIDUAL ? dto.permanentAddress as any : null,
                businessAddress: dto.providerType === ProviderType.BUSINESS ? dto.businessAddress as any : null,
                carPlateNumber: hasCar ? dto.carPlateNumber : null,
                motorcyclePlateNumber: hasMotorcycle ? dto.motorcyclePlateNumber : null,
                verificationStatus: VerificationStatus.DRAFT,
                isActive: false,
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
