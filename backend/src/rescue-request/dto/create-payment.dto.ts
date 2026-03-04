import { IsInt, IsEnum, IsOptional, IsString, IsArray, Min } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

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

    @IsEnum(PaymentMethod)
    @IsOptional()
    paymentMethod?: PaymentMethod;

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
