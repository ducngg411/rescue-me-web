import { IsInt, IsIn, IsOptional, IsString, IsArray, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaymentDto {
    @ApiProperty({ example: 350000, description: 'Tổng tiền thanh toán (VND)' })
    @IsInt()
    @Min(1)
    totalAmount: number;

    @ApiPropertyOptional({ example: 200000 })
    @IsInt()
    @IsOptional()
    baseFee?: number;

    @ApiPropertyOptional({ example: 100000 })
    @IsInt()
    @IsOptional()
    distanceFee?: number;

    @ApiPropertyOptional({ example: 50000 })
    @IsInt()
    @IsOptional()
    overtimeFee?: number;

    @ApiPropertyOptional({ example: 0 })
    @IsInt()
    @IsOptional()
    otherFee?: number;

    @ApiPropertyOptional({ enum: ['CASH', 'QR', 'WALLET'], example: 'WALLET' })
    @IsIn(['CASH', 'QR', 'WALLET'])
    @IsOptional()
    paymentMethod?: 'CASH' | 'QR' | 'WALLET';

    @ApiPropertyOptional({ example: 'Phụ thu ban đêm' })
    @IsString()
    @IsOptional()
    surchargeNote?: string;

    @ApiPropertyOptional({ example: 'Khách đã thanh toán qua ví' })
    @IsString()
    @IsOptional()
    note?: string;

    @ApiPropertyOptional({ type: [String], example: ['https://example.com/photo1.jpg'] })
    @IsArray()
    @IsOptional()
    photoUrls?: string[];
}
