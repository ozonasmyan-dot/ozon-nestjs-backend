import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsOptional, Min, ValidateNested } from 'class-validator';

class FilterDto {
  @IsOptional()
  @IsDateString()
  since?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

class WithDto {
  @IsOptional()
  @IsBoolean()
  analytics_data?: boolean;

  @IsOptional()
  @IsBoolean()
  financial_data?: boolean;
}

export class GetPostingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  limit: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => FilterDto)
  filter?: FilterDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => WithDto)
  with?: WithDto;
}
