import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProviderProfileDto } from '../auth/dto/auth.dto';
import { UserRole, VerificationStatus, ProviderType, DocumentType } from '@prisma/client';
import { SubmitVerificationResponseDto } from './dto/submit-verification.dto';

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

    async submitVerification(userId: string): Promise<SubmitVerificationResponseDto> {
        // Get user with provider profile
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (user.role !== UserRole.PROVIDER) {
            throw new ForbiddenException('Only providers can submit verification');
        }

        if (user.verificationStatus !== VerificationStatus.DRAFT && user.verificationStatus !== VerificationStatus.REJECTED) {
            throw new BadRequestException('Can only submit verification when status is DRAFT or REJECTED');
        }

        const missingFields: string[] = [];
        const missingDocs: string[] = [];

        // Validate required profile fields
        if (!user.fullName) missingFields.push('fullName');
        if (!user.phoneNumber) missingFields.push('phoneNumber');
        if (!user.providerType) missingFields.push('providerType');
        if (!user.serviceTypes || user.serviceTypes.length === 0) missingFields.push('serviceTypes');
        if (!user.supportedVehicleTypes || user.supportedVehicleTypes.length === 0) {
            missingFields.push('supportedVehicleTypes');
        }
        if (!user.serviceRadiusKm) missingFields.push('serviceRadiusKm');

        // Validate address based on provider type
        if (user.providerType === ProviderType.INDIVIDUAL) {
            if (!user.permanentAddress) missingFields.push('permanentAddress');
        } else if (user.providerType === ProviderType.BUSINESS) {
            if (!user.businessName) missingFields.push('businessName');
            if (!user.businessAddress) missingFields.push('businessAddress');
        }

        // Validate vehicle plate numbers
        const supportedVehicles = user.supportedVehicleTypes as string[];
        if (supportedVehicles.includes('CAR') && !user.carPlateNumber) {
            missingFields.push('carPlateNumber');
        }
        if (supportedVehicles.includes('MOTORCYCLE') && !user.motorcyclePlateNumber) {
            missingFields.push('motorcyclePlateNumber');
        }

        // Validate required documents (Tier 1)
        const uploads = await this.prisma.upload.findMany({
            where: {
                userId,
                confirmed: true,
                purpose: 'PROVIDER_VERIFICATION',
            },
        });

        const uploadedDocTypes = new Set(
            uploads.map(u => u.docType).filter(Boolean)
        );

        // Required docs for all providers (Tier 1)
        const requiredDocs: DocumentType[] = [
            DocumentType.CITIZEN_ID_FRONT,
            DocumentType.CITIZEN_ID_BACK,
            DocumentType.SELFIE,
        ];

        // Add vehicle photo based on supported types
        if (supportedVehicles.includes('CAR')) {
            requiredDocs.push(DocumentType.CAR_PHOTO);
        }
        if (supportedVehicles.includes('MOTORCYCLE')) {
            requiredDocs.push(DocumentType.MOTORBIKE_PHOTO);
        }

        // Add business registration if BUSINESS type
        if (user.providerType === ProviderType.BUSINESS) {
            requiredDocs.push(DocumentType.BUSINESS_REGISTRATION);
        }

        // Check missing docs
        for (const docType of requiredDocs) {
            if (!uploadedDocTypes.has(docType)) {
                missingDocs.push(docType);
            }
        }

        // If validation fails, return errors
        if (missingFields.length > 0 || missingDocs.length > 0) {
            return {
                success: false,
                message: 'Please complete all required fields and upload all required documents',
                missingFields: missingFields.length > 0 ? missingFields : undefined,
                missingDocs: missingDocs.length > 0 ? missingDocs : undefined,
            };
        }

        // All validation passed, update status to PENDING
        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: {
                verificationStatus: VerificationStatus.PENDING,
                submittedAt: new Date(),
                isActive: false, // Ensure offline during verification
            },
        });

        return {
            success: true,
            message: 'Verification request submitted successfully',
            verificationStatus: updatedUser.verificationStatus,
            submittedAt: updatedUser.submittedAt ?? undefined,
        };
    }
}
