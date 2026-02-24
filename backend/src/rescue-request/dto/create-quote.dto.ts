import {
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Min,
    Max,
    ValidateNested,
    IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

// Provider Location DTO
export class ProviderLocationDto {
    @IsNumber()
    @IsNotEmpty()
    lat: number;

    @IsNumber()
    @IsNotEmpty()
    lng: number;
}

export class CreateQuoteDto {
    @IsInt()
    @Min(10000)
    @IsNotEmpty()
    price: number; // Giá báo giá tối thiểu 10,000 VND

    @IsInt()
    @Min(1)
    @Max(300)
    @IsNotEmpty()
    estimatedArrivalMinutes: number; // Thời gian dự kiến đến (1-300 phút)

    @IsString()
    @IsOptional()
    message?: string; // Lời nhắn từ provider

    @ValidateNested()
    @Type(() => ProviderLocationDto)
    @IsOptional()
    providerLocation?: ProviderLocationDto; // Vị trí provider khi gửi báo giá
}
