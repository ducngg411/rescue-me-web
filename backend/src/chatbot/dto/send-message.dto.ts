import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateIf } from 'class-validator';

export class SendMessageDto {
    @IsString()
    @ValidateIf((o) => !o.imageUrls?.length)
    @IsNotEmpty()
    content: string;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    imageUrls?: string[];

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    originalMediaUrls?: string[];
}
