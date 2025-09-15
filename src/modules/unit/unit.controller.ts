import { Controller, Get, Header, Query } from '@nestjs/common';
import { UnitService } from './unit.service';
import { AggregateUnitDto } from './dto/aggregate-unit.dto';

@Controller('unit')
export class UnitController {
  constructor(private readonly unitService: UnitService) {}

  @Get()
  aggregate(@Query() dto: AggregateUnitDto) {
    return this.unitService.aggregate(dto);
  }

  @Get('csv')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="unit.csv"')
  aggregateCsv(@Query() dto: AggregateUnitDto) {
    return this.unitService.aggregateCsv(dto);
  }
}
