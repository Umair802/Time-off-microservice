import {
  IsNumber,
  IsString,
  IsDateString,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateTimeOffRequestDto {
  @IsNumber()
  employeeId: number;

  @IsNumber()
  locationId: number;

  @IsNumber()
  leaveTypeId: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsNumber()
  @Min(0.5)
  days: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
