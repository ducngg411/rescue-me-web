import { IsEmail, IsString, MinLength, MaxLength, Matches, IsEnum, IsOptional, ValidateNested, IsNumber, IsArray, ArrayMinSize, Min, Max, IsBoolean, IsUrl } from 'class-validator';
import { UserRole, VehicleType, ServiceType, ProviderType } from '@prisma/client';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class DefaultAddressDto {
    @ApiProperty({ example: '123 Lê Lợi, Quận 1, TP.HCM' })
    @IsString()
    addressText: string;

    @ApiProperty({ example: 10.7769 })
    @IsNumber()
    lat: number;

    @ApiProperty({ example: 106.7009 })
    @IsNumber()
    lng: number;
}

class RescueVehicleDto {
    @ApiProperty({ enum: VehicleType, example: VehicleType.CAR })
    @IsEnum(VehicleType, { message: 'Loại phương tiện phải là CAR hoặc MOTORCYCLE' })
    type: VehicleType;

    @ApiProperty({ example: '51F-123.45' })
    @IsString({ message: 'Biển số xe không được để trống' })
    plateNumber: string;

    @ApiProperty({ example: true })
    @IsBoolean()
    isPrimary: boolean;
}

class UserVehicleDto {
    @ApiProperty({ enum: VehicleType, example: VehicleType.MOTORCYCLE })
    @IsEnum(VehicleType, { message: 'Loại phương tiện phải là CAR hoặc MOTORCYCLE' })
    type: VehicleType;

    @ApiProperty({ example: '59T1-1234' })
    @IsString({ message: 'Biển số xe không được để trống' })
    @Matches(/^[1-9][0-9][A-Z0-9]{1,2}[- .]?(\d{4}|\d{3}[.]?\d{2})$/i, {
        message: 'Biển số xe không hợp lệ (ví dụ: 29A-123.45 hoặc 59T1-1234)'
    })
    plateNumber: string;

    @ApiProperty({ example: 'Đen' })
    @IsString({ message: 'Màu xe không được để trống' })
    @MaxLength(50, { message: 'Màu xe không được vượt quá 50 ký tự' })
    color: string;

    @ApiProperty({ example: 'Honda' })
    @IsString({ message: 'Hãng xe không được để trống' })
    @MaxLength(50, { message: 'Hãng xe không được vượt quá 50 ký tự' })
    brand: string;
}

export class RegisterEmailDto {
    @ApiProperty({ example: 'user@example.com' })
    @IsEmail({}, { message: 'Email không hợp lệ' })
    email: string;

    @ApiProperty({ example: 'Password1' })
    @IsString()
    @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
    @Matches(/^(?=.*[A-Z])(?=.*\d)/, {
        message: 'Mật khẩu phải có ít nhất 1 chữ hoa và 1 số',
    })
    password: string;

    @ApiPropertyOptional({ example: 'Nguyễn Văn A' })
    @IsString()
    name?: string;
}

export class LoginEmailDto {
    @ApiProperty({ example: 'user@example.com' })
    @IsEmail({}, { message: 'Email không hợp lệ' })
    email: string;

    @ApiProperty({ example: 'Password1' })
    @IsString()
    @MinLength(1, { message: 'Mật khẩu không được để trống' })
    password: string;
}

export class GoogleAuthDto {
    @ApiProperty({ example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...' })
    @IsString()
    idToken: string;
}

export class CompleteProfileDto {
    @ApiProperty({ example: 'Nguyễn Văn A' })
    @IsString()
    name: string;
}

export class SelectRoleDto {
    @ApiProperty({ enum: UserRole, example: UserRole.USER })
    @IsEnum(UserRole, {
        message: 'Role phải là USER hoặc PROVIDER'
    })
    role: UserRole;
}

export class ChangePasswordDto {
    @ApiProperty({ example: 'OldPassword1' })
    @IsString()
    @MinLength(1, { message: 'Mật khẩu cũ không được để trống' })
    oldPassword: string;

    @ApiProperty({ example: 'NewPassword2' })
    @IsString()
    @MinLength(8, { message: 'Mật khẩu mới phải có ít nhất 8 ký tự' })
    @Matches(/^(?=.*[A-Z])(?=.*\d)/, {
        message: 'Mật khẩu mới phải có ít nhất 1 chữ hoa và 1 số',
    })
    newPassword: string;
}

export class ForgotPasswordEmailDto {
    @ApiProperty({ example: 'user@example.com' })
    @IsEmail({}, { message: 'Email không hợp lệ' })
    email: string;
}

export class ForgotPasswordPhoneDto {
    @ApiProperty({ example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...' })
    @IsString({ message: 'Firebase ID Token không được để trống' })
    firebaseIdToken: string;
}

export class ResetPasswordDto {
    @ApiProperty({ example: 'abc123resettoken' })
    @IsString({ message: 'Token không được để trống' })
    token: string;

    @ApiProperty({ example: 'NewPassword2' })
    @IsString()
    @MinLength(8, { message: 'Mật khẩu mới phải có ít nhất 8 ký tự' })
    @Matches(/^(?=.*[A-Z])(?=.*\d)/, {
        message: 'Mật khẩu mới phải có ít nhất 1 chữ hoa và 1 số',
    })
    newPassword: string;
}


export class UpdateUserProfileDto {
    @ApiProperty({ example: 'Nguyễn Văn A' })
    @IsString({ message: 'Họ tên không được để trống' })
    @MaxLength(100, { message: 'Họ tên không được vượt quá 100 ký tự' })
    fullName: string;

    @ApiProperty({ example: '0901234567' })
    @IsString({ message: 'Số điện thoại không được để trống' })
    @Matches(/^0[39][0-9]{8}$/, {
        message: 'Số điện thoại không hợp lệ (phải là số VN: 0[39]xxxxxxxx)'
    })
    phoneNumber: string;

    @ApiPropertyOptional({ example: 'contact@example.com' })
    @IsOptional()
    @IsEmail({}, { message: 'Email liên hệ không hợp lệ' })
    contactEmail?: string;

    @ApiPropertyOptional({ type: () => DefaultAddressDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => DefaultAddressDto)
    defaultAddress?: DefaultAddressDto;

    @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
    @IsOptional()
    @IsString()
    avatar?: string;

    @ApiPropertyOptional({ type: () => UserVehicleDto, isArray: true })
    @IsOptional()
    @IsArray({ message: 'Danh sách xe phải là một mảng' })
    @ValidateNested({ each: true })
    @Type(() => UserVehicleDto)
    vehicles?: UserVehicleDto[];

    @ApiPropertyOptional({ enum: VehicleType, example: VehicleType.MOTORCYCLE })
    @IsOptional()
    @IsEnum(VehicleType, {
        message: 'Loại phương tiện phải là CAR hoặc MOTORCYCLE'
    })
    vehicleType?: VehicleType;

    @ApiPropertyOptional({ example: '59T1-1234' })
    @IsOptional()
    @IsString({ message: 'Biển số xe không được để trống' })
    @Matches(/^[1-9][0-9][A-Z0-9]{1,2}[- .]?(\d{4}|\d{3}[.]?\d{2})$/i, {
        message: 'Biển số xe không hợp lệ (ví dụ: 29A-123.45 hoặc 59T1-1234)'
    })
    licensePlate?: string;

    @ApiPropertyOptional({ example: 'Đỏ' })
    @IsOptional()
    @IsString({ message: 'Màu xe không được để trống' })
    @MaxLength(50, { message: 'Màu xe không được vượt quá 50 ký tự' })
    vehicleColor?: string;
}

export class UpdateProviderProfileDto {
    @ApiProperty({ enum: ProviderType, example: ProviderType.INDIVIDUAL })
    @IsEnum(ProviderType, { message: 'Loại nhà cung cấp phải là INDIVIDUAL hoặc BUSINESS' })
    providerType: ProviderType;

    @ApiProperty({ example: 'Trần Văn B' })
    @IsString({ message: 'Họ tên không được để trống' })
    fullName: string;

    @ApiProperty({ example: '0912345678' })
    @IsString({ message: 'Số điện thoại không được để trống' })
    @Matches(/^0[39][0-9]{8}$/, {
        message: 'Số điện thoại không hợp lệ (phải là số VN: 0[39]xxxxxxxx)'
    })
    phoneNumber: string;

    @ApiPropertyOptional({ example: 'Cứu Hộ Nhanh 24H' })
    @IsOptional()
    @IsString({ message: 'Tên doanh nghiệp không được để trống' })
    businessName?: string;

    @ApiProperty({ enum: ServiceType, isArray: true, example: ['TOWING', 'BATTERY'] })
    @IsArray({ message: 'Loại dịch vụ phải là một mảng' })
    @ArrayMinSize(1, { message: 'Phải chọn ít nhất một loại dịch vụ' })
    @IsEnum(ServiceType, { each: true, message: 'Loại dịch vụ không hợp lệ' })
    serviceTypes: ServiceType[];

    @ApiProperty({ enum: VehicleType, isArray: true, example: ['CAR', 'MOTORCYCLE'] })
    @IsArray({ message: 'Loại phương tiện hỗ trợ phải là một mảng' })
    @ArrayMinSize(1, { message: 'Phải chọn ít nhất một loại phương tiện' })
    @IsEnum(VehicleType, { each: true, message: 'Loại phương tiện không hợp lệ' })
    supportedVehicleTypes: VehicleType[];

    @ApiProperty({ example: 20, minimum: 5, maximum: 50 })
    @IsNumber({}, { message: 'Bán kính dịch vụ phải là số' })
    @Min(5, { message: 'Bán kính dịch vụ tối thiểu 5 km' })
    @Max(50, { message: 'Bán kính dịch vụ tối đa 50 km' })
    serviceRadiusKm: number;

    @ApiPropertyOptional({ type: () => DefaultAddressDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => DefaultAddressDto)
    permanentAddress?: DefaultAddressDto;

    @ApiPropertyOptional({ type: () => DefaultAddressDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => DefaultAddressDto)
    businessAddress?: DefaultAddressDto;

    @ApiProperty({ type: () => RescueVehicleDto, isArray: true })
    @IsArray({ message: 'Phương tiện cứu hộ phải là một mảng' })
    @ArrayMinSize(1, { message: 'Phải có ít nhất một phương tiện cứu hộ' })
    @ValidateNested({ each: true })
    @Type(() => RescueVehicleDto)
    rescueVehicles: RescueVehicleDto[];
}
