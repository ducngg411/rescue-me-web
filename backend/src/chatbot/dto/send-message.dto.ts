import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class SendMessageDto {
    @IsString()
    @IsNotEmpty()
    content: string;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    imageUrls?: string[];
}
