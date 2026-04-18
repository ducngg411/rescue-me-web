import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WithdrawDto {
    @ApiProperty({ example: 500000, description: 'Số tiền muốn rút (VND)' })
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    amount: number;

    @ApiPropertyOptional({ example: 'acc_clxxxxx' })
    @IsOptional()
    @IsString()
    withdrawalAccountId?: string;
}

export class TopupInitDto {
    @ApiProperty({ example: 200000, description: 'Số tiền nạp (VND)' })
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    amount: number;
}
