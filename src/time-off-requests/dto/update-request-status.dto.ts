import { IsOptional, IsString } from 'class-validator';

export class UpdateRequestStatusDto {
  @IsOptional()
  @IsString()
  changedBy?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  managerNotes?: string;
}
