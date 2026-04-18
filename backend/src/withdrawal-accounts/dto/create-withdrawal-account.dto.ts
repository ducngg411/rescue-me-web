import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { BankCode } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWithdrawalAccountDto {
  @ApiProperty({ example: '0123456789' })
  @IsString({ message: 'Số tài khoản không hợp lệ' })
  @MinLength(3, { message: 'Số tài khoản quá ngắn' })
  accountNumber: string;

  @ApiPropertyOptional({ enum: BankCode, example: 'VCB' })
  @IsOptional()
  @IsEnum(BankCode, { message: 'Mã ngân hàng không hợp lệ' })
  bankCode?: BankCode;

  @ApiProperty({ example: 'Vietcombank' })
  @IsString({ message: 'Tên ngân hàng không được để trống' })
  bankName: string;

  @ApiPropertyOptional({ example: 'Chi nhánh Hà Nội' })
  @IsOptional()
  @IsString({ message: 'Chi nhánh không hợp lệ' })
  branchName?: string;

  @ApiProperty({ example: 'NGUYEN VAN A' })
  @IsString({ message: 'Chủ tài khoản không hợp lệ' })
  @MinLength(2, { message: 'Chủ tài khoản quá ngắn' })
  accountHolderName: string;
}
