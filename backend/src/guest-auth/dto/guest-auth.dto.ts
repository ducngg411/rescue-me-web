import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VerifyPhoneDto {
    @ApiProperty({ example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...' })
    @IsString()
    @IsNotEmpty()
    firebaseIdToken: string;

    @ApiPropertyOptional({ example: 'device-uuid-1234' })
    @IsString()
    @IsOptional()
    deviceId?: string;
}

export class ConvertGuestDto {
    @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
    @IsString()
    @IsNotEmpty()
    userAccessToken: string;
}
