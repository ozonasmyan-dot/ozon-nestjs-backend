import { IsDateString, IsOptional, IsString } from 'class-validator';

export class AggregateOrderDto {
  @IsOptional()
  @IsString()
  postingNumber?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  sku?: string;
}
