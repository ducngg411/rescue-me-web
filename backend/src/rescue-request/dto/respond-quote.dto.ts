import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum QuoteResponseAction {
    ACCEPT = 'ACCEPT',
    REJECT = 'REJECT',
}

export class RespondQuoteDto {
    @ApiProperty({ enum: QuoteResponseAction, example: QuoteResponseAction.ACCEPT })
    @IsEnum(QuoteResponseAction)
    @IsNotEmpty()
    action: QuoteResponseAction;

    @ApiPropertyOptional({ example: 'Giá quá cao so với thị trường' })
    @IsString()
    @IsOptional()
    rejectionReason?: string; // Lý do từ chối (nếu action = REJECT)
}
