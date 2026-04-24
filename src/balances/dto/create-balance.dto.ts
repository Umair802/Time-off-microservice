import { IsNumber, IsOptional } from 'class-validator';

export class CreateBalanceDto {
  @IsNumber()
  employeeId: number;

  @IsNumber()
  locationId: number;

  @IsNumber()
  leaveTypeId: number;

  @IsOptional()
  @IsNumber()
  available?: number;

  @IsOptional()
  @IsNumber()
  used?: number;

  @IsOptional()
  @IsNumber()
  pending?: number;
}
