import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmUploadDto {
    @IsString()
    @IsNotEmpty()
    uploadId: string;
}

export class ConfirmUploadResponseDto {
    success: boolean;
    upload: {
        id: string;
        objectKey: string;
        publicUrl: string;
        fileName: string;
        fileSize: number;
        contentType: string;
        createdAt: Date;
    };
}
