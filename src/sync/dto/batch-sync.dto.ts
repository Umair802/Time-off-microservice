import { IsArray, ValidateNested, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class BatchBalanceItemDto {
  @IsString()
  employeeId: string;

  @IsString()
  locationId: string;

  @IsString()
  leaveTypeCode: string;

  @IsNumber()
  available: number;

  @IsNumber()
  used: number;
}

export class BatchSyncDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchBalanceItemDto)
  balances: BatchBalanceItemDto[];
}
