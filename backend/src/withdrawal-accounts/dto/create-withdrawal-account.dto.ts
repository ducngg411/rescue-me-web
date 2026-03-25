import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { BankCode } from '@prisma/client';

export class CreateWithdrawalAccountDto {
  @IsString({ message: 'Số tài khoản không hợp lệ' })
  @MinLength(3, { message: 'Số tài khoản quá ngắn' })
  accountNumber: string;

  @IsOptional()
  @IsEnum(BankCode, { message: 'Mã ngân hàng không hợp lệ' })
  bankCode?: BankCode;

  @IsString({ message: 'Tên ngân hàng không được để trống' })
  bankName: string;

  @IsOptional()
  @IsString({ message: 'Chi nhánh không hợp lệ' })
  branchName?: string;

  @IsString({ message: 'Chủ tài khoản không hợp lệ' })
  @MinLength(2, { message: 'Chủ tài khoản quá ngắn' })
  accountHolderName: string;
}

