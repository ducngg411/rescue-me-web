import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

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
