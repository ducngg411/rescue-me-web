import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';

export enum UploadPurpose {
    PROVIDER_VERIFICATION = 'provider_verification',
    REQUEST_PHOTO = 'request_photo',
    REVIEW_PHOTO = 'review_photo',
    BEFORE_AFTER = 'before_after',
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
    @Max(5 * 1024 * 1024) // 5MB
    fileSize: number;

    @IsString()
    @IsNotEmpty()
    @IsEnum(['image/jpeg', 'image/png', 'image/webp'])
    contentType: string;
}

export class PresignUploadResponseDto {
    uploadUrl: string;
    objectKey: string;
    publicUrl: string;
    uploadId: string;
    expiresIn: number; // seconds
}
