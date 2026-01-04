export class SubmitVerificationResponseDto {
    success: boolean;
    message?: string;
    missingFields?: string[];
    missingDocs?: string[];
    verificationStatus?: string;
    submittedAt?: Date;
}
