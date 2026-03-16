import { IsInt, IsIn, IsOptional, IsString, IsArray, Min } from 'class-validator';

export class CreatePaymentDto {
    @IsInt()
    @Min(1)
    totalAmount: number;

    @IsInt()
    @IsOptional()
    baseFee?: number;

    @IsInt()
    @IsOptional()
    distanceFee?: number;

    @IsInt()
    @IsOptional()
    overtimeFee?: number;

    @IsInt()
    @IsOptional()
    otherFee?: number;

    @IsIn(['CASH', 'QR', 'WALLET'])
    @IsOptional()
    paymentMethod?: 'CASH' | 'QR' | 'WALLET';


    @IsString()
    @IsOptional()
    surchargeNote?: string;

    @IsString()
    @IsOptional()
    note?: string;

    @IsArray()
    @IsOptional()
    photoUrls?: string[];
}
