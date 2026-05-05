import {
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Min,
    Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateQuoteDto {
    @ApiProperty({ example: 250000, description: 'Giá báo giá (tối thiểu 10,000 VND)' })
    @IsInt()
    @Min(10000)
    @IsNotEmpty()
    price: number; // Giá báo giá tối thiểu 10,000 VND

    @ApiProperty({ example: 15, description: 'Thời gian dự kiến đến (1-300 phút)' })
    @IsInt()
    @Min(1)
    @Max(300)
    @IsNotEmpty()
    estimatedArrivalMinutes: number; // Thời gian dự kiến đến (1-300 phút)

    @ApiPropertyOptional({ example: 'Tôi đang trên đường đến, khoảng 15 phút nữa.' })
    @IsString()
    @IsOptional()
    message?: string; // Lời nhắn từ provider
}
