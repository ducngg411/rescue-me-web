import { IsEmail, IsString, MinLength, MaxLength, Matches, IsEnum, IsOptional, ValidateNested, IsNumber, IsArray, ArrayMinSize, Min, Max, IsBoolean, IsUrl } from 'class-validator';
import { UserRole, VehicleType, ServiceType, ProviderType } from '@prisma/client';
import { Type } from 'class-transformer';

class DefaultAddressDto {
    @IsString()
    addressText: string;

    @IsNumber()
    lat: number;

    @IsNumber()
    lng: number;
}

class RescueVehicleDto {
    @IsEnum(VehicleType, { message: 'Loại phương tiện phải là CAR hoặc MOTORCYCLE' })
    type: VehicleType;

    @IsString({ message: 'Biển số xe không được để trống' })
    plateNumber: string;

    @IsBoolean()
    isPrimary: boolean;
}

class UserVehicleDto {
    @IsEnum(VehicleType, { message: 'Loại phương tiện phải là CAR hoặc MOTORCYCLE' })
    type: VehicleType;

    @IsString({ message: 'Biển số xe không được để trống' })
    @Matches(/^[1-9][0-9][A-Z0-9]{1,2}[- .]?(\d{4}|\d{3}[.]?\d{2})$/i, {
        message: 'Biển số xe không hợp lệ (ví dụ: 29A-123.45 hoặc 59T1-1234)'
    })
    plateNumber: string;

    @IsString({ message: 'Màu xe không được để trống' })
    @MaxLength(50, { message: 'Màu xe không được vượt quá 50 ký tự' })
    color: string;

    @IsString({ message: 'Hãng xe không được để trống' })
    @MaxLength(50, { message: 'Hãng xe không được vượt quá 50 ký tự' })
    brand: string;
}

export class RegisterEmailDto {
    @IsEmail({}, { message: 'Email không hợp lệ' })
    email: string;

    @IsString()
    @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
    @Matches(/^(?=.*[A-Z])(?=.*\d)/, {
        message: 'Mật khẩu phải có ít nhất 1 chữ hoa và 1 số',
    })
    password: string;

    @IsString()
    name?: string;
}

export class LoginEmailDto {
    @IsEmail({}, { message: 'Email không hợp lệ' })
    email: string;

    @IsString()
    @MinLength(1, { message: 'Mật khẩu không được để trống' })
    password: string;
}

export class GoogleAuthDto {
    @IsString()
    idToken: string;
}

export class CompleteProfileDto {
    @IsString()
    name: string;
}

export class SelectRoleDto {
    @IsEnum(UserRole, {
        message: 'Role phải là USER hoặc PROVIDER'
    })
    role: UserRole;
}

export class ChangePasswordDto {
    @IsString()
    @MinLength(1, { message: 'Mật khẩu cũ không được để trống' })
    oldPassword: string;

    @IsString()
    @MinLength(8, { message: 'Mật khẩu mới phải có ít nhất 8 ký tự' })
    @Matches(/^(?=.*[A-Z])(?=.*\d)/, {
        message: 'Mật khẩu mới phải có ít nhất 1 chữ hoa và 1 số',
    })
    newPassword: string;
}

export class UpdateUserProfileDto {
    @IsString({ message: 'Họ tên không được để trống' })
    @MaxLength(100, { message: 'Họ tên không được vượt quá 100 ký tự' })
    fullName: string;

    @IsString({ message: 'Số điện thoại không được để trống' })
    @Matches(/^0[39][0-9]{8}$/, {
        message: 'Số điện thoại không hợp lệ (phải là số VN: 0[39]xxxxxxxx)'
    })
    phoneNumber: string;

    @IsOptional()
    @IsEmail({}, { message: 'Email liên hệ không hợp lệ' })
    contactEmail?: string;

    @IsOptional()
    @ValidateNested()
    @Type(() => DefaultAddressDto)
    defaultAddress?: DefaultAddressDto;

    @IsOptional()
    @IsString()
    avatar?: string;

    @IsOptional()
    @IsArray({ message: 'Danh sách xe phải là một mảng' })
    @ValidateNested({ each: true })
    @Type(() => UserVehicleDto)
    vehicles?: UserVehicleDto[];

    @IsOptional()
    @IsEnum(VehicleType, {
        message: 'Loại phương tiện phải là CAR hoặc MOTORCYCLE'
    })
    vehicleType?: VehicleType;

    @IsOptional()
    @IsString({ message: 'Biển số xe không được để trống' })
    @Matches(/^[1-9][0-9][A-Z0-9]{1,2}[- .]?(\d{4}|\d{3}[.]?\d{2})$/i, {
        message: 'Biển số xe không hợp lệ (ví dụ: 29A-123.45 hoặc 59T1-1234)'
    })
    licensePlate?: string;

    @IsOptional()
    @IsString({ message: 'Màu xe không được để trống' })
    @MaxLength(50, { message: 'Màu xe không được vượt quá 50 ký tự' })
    vehicleColor?: string;
}

export class UpdateProviderProfileDto {
    @IsEnum(ProviderType, { message: 'Loại nhà cung cấp phải là INDIVIDUAL hoặc BUSINESS' })
    providerType: ProviderType;

    @IsString({ message: 'Họ tên không được để trống' })
    fullName: string;

    @IsString({ message: 'Số điện thoại không được để trống' })
    @Matches(/^0[39][0-9]{8}$/, {
        message: 'Số điện thoại không hợp lệ (phải là số VN: 0[39]xxxxxxxx)'
    })
    phoneNumber: string;

    @IsOptional()
    @IsString({ message: 'Tên doanh nghiệp không được để trống' })
    businessName?: string;

    @IsArray({ message: 'Loại dịch vụ phải là một mảng' })
    @ArrayMinSize(1, { message: 'Phải chọn ít nhất một loại dịch vụ' })
    @IsEnum(ServiceType, { each: true, message: 'Loại dịch vụ không hợp lệ' })
    serviceTypes: ServiceType[];

    @IsArray({ message: 'Loại phương tiện hỗ trợ phải là một mảng' })
    @ArrayMinSize(1, { message: 'Phải chọn ít nhất một loại phương tiện' })
    @IsEnum(VehicleType, { each: true, message: 'Loại phương tiện không hợp lệ' })
    supportedVehicleTypes: VehicleType[];

    @IsNumber({}, { message: 'Bán kính dịch vụ phải là số' })
    @Min(5, { message: 'Bán kính dịch vụ tối thiểu 5 km' })
    @Max(50, { message: 'Bán kính dịch vụ tối đa 50 km' })
    serviceRadiusKm: number;

    @IsOptional()
    @ValidateNested()
    @Type(() => DefaultAddressDto)
    permanentAddress?: DefaultAddressDto;

    @IsOptional()
    @ValidateNested()
    @Type(() => DefaultAddressDto)
    businessAddress?: DefaultAddressDto;

    @IsArray({ message: 'Phương tiện cứu hộ phải là một mảng' })
    @ArrayMinSize(1, { message: 'Phải có ít nhất một phương tiện cứu hộ' })
    @ValidateNested({ each: true })
    @Type(() => RescueVehicleDto)
    rescueVehicles: RescueVehicleDto[];
}
