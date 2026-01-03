import { IsEmail, IsString, MinLength, Matches, IsEnum, IsOptional, ValidateNested, IsNumber } from 'class-validator';
import { UserRole, VehicleType } from '@prisma/client';
import { Type } from 'class-transformer';

class DefaultAddressDto {
    @IsString()
    addressText: string;

    @IsNumber()
    lat: number;

    @IsNumber()
    lng: number;
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

export class UpdateUserProfileDto {
    @IsString({ message: 'Họ tên không được để trống' })
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

    @IsEnum(VehicleType, {
        message: 'Loại phương tiện phải là CAR hoặc MOTORCYCLE'
    })
    vehicleType: VehicleType;

    @IsString({ message: 'Biển số xe không được để trống' })
    licensePlate: string;

    @IsString({ message: 'Màu xe không được để trống' })
    vehicleColor: string;
}
