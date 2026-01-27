import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class TrackCloudinaryUploadDto {
    @IsString()
    @IsNotEmpty()
    publicUrl: string;

    @IsString()
    @IsNotEmpty()
    cloudinaryPublicId: string;

    @IsString()
    @IsNotEmpty()
    fileName: string;

    @IsNumber()
    @IsNotEmpty()
    fileSize: number;

    @IsString()
    @IsNotEmpty()
    contentType: string;

    @IsString()
    @IsOptional()
    resourceType?: string; // 'video', 'image', etc.
}

export class TrackCloudinaryUploadResponseDto {
    uploadId: string;
    publicUrl: string;
}
