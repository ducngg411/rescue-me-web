import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { DisputeCaseStatus, DisputeResolutionType, DisputeSenderRole } from '@prisma/client';


export class RejectProviderDto {
    @IsString()
    @IsNotEmpty()
    rejectReasonCode: string;

    @IsString()
    @IsNotEmpty()
    rejectReasonDetail: string;
}

export class SuspendProviderDto {
    @IsString()
    @IsOptional()
    reason?: string;
}

export class GetProvidersQueryDto {
    @IsString()
    @IsOptional()
    status?: string;

    @IsString()
    @IsOptional()
    search?: string;

    @IsOptional()
    page?: number;

    @IsOptional()
    limit?: number;
}

export class GetDisputesQueryDto {
    @IsOptional()
    @IsString()
    status?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    skip?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    take?: number;
}

export class UpdateDisputeStatusDto {
    @IsEnum(DisputeCaseStatus)
    status: DisputeCaseStatus;
}

export class RequestEvidenceDto {
    @IsString()
    @IsNotEmpty()
    message: string;

    @IsOptional()
    @IsEnum(DisputeSenderRole)
    targetRole?: DisputeSenderRole;
}

export class ResolveDisputeDto {
    @IsEnum(DisputeResolutionType)
    resolutionType: DisputeResolutionType;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    resolutionAmountCustomer?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    resolutionAmountProvider?: number;

    @IsOptional()
    @IsString()
    resolutionNote?: string;
}

export class RejectDisputeDto {
    @IsOptional()
    @IsString()
    resolutionNote?: string;
}


export class AddDisputeEvidenceDto {
    @IsString()
    @IsNotEmpty()
    url: string;

    @IsOptional()
    @IsString()
    note?: string;
}
