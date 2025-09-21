import { IsDateString, IsOptional, IsString } from 'class-validator';

export class FilterAdvertisingDto {
  @IsOptional()
  @IsString()
  campaignId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
