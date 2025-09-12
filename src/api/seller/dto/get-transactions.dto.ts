import {Type} from 'class-transformer';
import {IsDateString, IsOptional, ValidateNested} from 'class-validator';

class DateFilterDto {
  @IsDateString()
  from: string;

  @IsDateString()
  to: string;
}

class FilterDto {
  @ValidateNested()
  @Type(() => DateFilterDto)
  date: DateFilterDto;
}

export class GetTransactionsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => FilterDto)
  filter?: FilterDto;
}
