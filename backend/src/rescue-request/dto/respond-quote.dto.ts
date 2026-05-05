import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum QuoteResponseAction {
    ACCEPT = 'ACCEPT',
    REJECT = 'REJECT',
}

export class RespondQuoteDto {
    @ApiProperty({ enum: QuoteResponseAction, example: QuoteResponseAction.ACCEPT })
    @IsEnum(QuoteResponseAction)
    @IsNotEmpty()
    action: QuoteResponseAction;
}
