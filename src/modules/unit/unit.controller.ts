import { Controller, Get, Header, Query } from '@nestjs/common';
import { UnitService } from './unit.service';
import { AggregateUnitDto } from './dto/aggregate-unit.dto';
import { UnitCsvService } from '@/modules/unit/services/unit-csv.service';

@Controller('unit')
export class UnitController {
  constructor(
    private readonly unitService: UnitService,
    private readonly unitCsvService: UnitCsvService,
  ) {}

  @Get()
  aggregate(@Query() dto: AggregateUnitDto) {
    return this.unitService.aggregate(dto);
  }

  @Get('csv')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="unit.csv"')
  aggregateCsv(@Query() dto: AggregateUnitDto) {
    return this.unitCsvService.aggregateCsv(dto);
  }
}
