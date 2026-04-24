import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateLocationDto {
  @IsString()
  locationId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
