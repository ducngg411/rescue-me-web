import { IsInt, IsOptional, IsString, IsArray, Min, Max, ArrayMaxSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReviewDto {
    /** Star rating: 1 – 5 */
    @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
    @IsInt()
    @Min(1)
    @Max(5)
    rating: number;

    /** Optional free-text comment */
    @ApiPropertyOptional({ example: 'Dịch vụ rất tốt, đến nhanh và xử lý chuyên nghiệp!' })
    @IsString()
    @IsOptional()
    comment?: string;

    /** Quick tags selected by the user */
    @ApiPropertyOptional({ type: [String], example: ['Đúng giờ', 'Thái độ tốt', 'Giá hợp lý'] })
    @IsArray()
    @IsString({ each: true })
    @ArrayMaxSize(10)
    @IsOptional()
    tags?: string[];
}
