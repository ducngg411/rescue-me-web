import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class VerifyPhoneDto {
    @IsString()
    @IsNotEmpty()
    firebaseIdToken: string;

    @IsString()
    @IsOptional()
    deviceId?: string;
}

export class ConvertGuestDto {
    @IsString()
    @IsNotEmpty()
    userAccessToken: string;
}
