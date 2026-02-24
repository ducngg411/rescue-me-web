import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum QuoteResponseAction {
    ACCEPT = 'ACCEPT',
    REJECT = 'REJECT',
}

export class RespondQuoteDto {
    @IsEnum(QuoteResponseAction)
    @IsNotEmpty()
    action: QuoteResponseAction;

    @IsString()
    @IsOptional()
    rejectionReason?: string; // Lý do từ chối (nếu action = REJECT)
}
