import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';

export enum UploadPurpose {
    PROVIDER_VERIFICATION = 'provider_verification',
    REQUEST_PHOTO = 'request_photo',
    REVIEW_PHOTO = 'review_photo',
    BEFORE_AFTER = 'before_after',
    CHATBOT_ATTACHMENT = 'chatbot_attachment',
}

export enum DocumentType {
    CITIZEN_ID_FRONT = 'citizenIdFront',
    CITIZEN_ID_BACK = 'citizenIdBack',
    SELFIE = 'selfie',
    CAR_PHOTO = 'carPhoto',
    MOTORBIKE_PHOTO = 'motorbikePhoto',
    DRIVER_LICENSE = 'driverLicense',
    BUSINESS_REGISTRATION = 'businessRegistration',
}

export class PresignUploadDto {
    @IsEnum(UploadPurpose)
    @IsNotEmpty()
    purpose: UploadPurpose;

    @ValidateIf((o) => o.purpose === UploadPurpose.PROVIDER_VERIFICATION)
    @IsEnum(DocumentType)
    @IsNotEmpty()
    docType?: DocumentType;

    @IsString()
    @IsNotEmpty()
    fileName: string;

    @IsNumber()
    @Min(1)
    @Max(50 * 1024 * 1024) // 50MB
    fileSize: number;

    @IsString()
    @IsNotEmpty()
    @IsEnum(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'])
    contentType: string;
}

export class PresignUploadResponseDto {
    uploadUrl: string;
    objectKey: string;
    publicUrl: string;
    uploadId: string;
    expiresIn: number; // seconds
}
