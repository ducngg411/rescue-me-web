import { IsInt, IsOptional, IsString, IsArray, Min, Max, ArrayMaxSize } from 'class-validator';

export class CreateReviewDto {
    /** Star rating: 1 – 5 */
    @IsInt()
    @Min(1)
    @Max(5)
    rating: number;

    /** Optional free-text comment */
    @IsString()
    @IsOptional()
    comment?: string;

    /** Quick tags selected by the user */
    @IsArray()
    @IsString({ each: true })
    @ArrayMaxSize(10)
    @IsOptional()
    tags?: string[];
}

