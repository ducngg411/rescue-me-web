import { IsEmail, IsString, MinLength, Matches } from 'class-validator';

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

    @IsString()
    phone: string;

    @IsString()
    address: string;

    @IsString()
    emergencyContact: string;
}
