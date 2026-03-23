import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { DisputeCaseStatus, DisputeResolution } from '@prisma/client';

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
    @IsEnum(DisputeCaseStatus)
    status?: DisputeCaseStatus;

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
}

export class ResolveDisputeDto {
    @IsEnum(DisputeResolution)
    resolution: DisputeResolution;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    refundAmount?: number;

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
