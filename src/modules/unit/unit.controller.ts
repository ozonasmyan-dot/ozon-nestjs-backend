import { Controller, Get, Header, Query } from '@nestjs/common';
import { UnitService } from './unit.service';
import { AggregateUnitDto } from './dto/aggregate-unit.dto';
import { CsvService } from '@/modules/unit/services/csv.service';

@Controller('unit')
export class UnitController {
  constructor(
    private readonly unitService: UnitService,
    private readonly unitCsvService: CsvService,
  ) {}

  @Get('sync')
  aggregate() {
    return this.unitService.aggregate();
  }

  @Get('csv')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="unit.csv"')
  aggregateCsv(@Query() dto: AggregateUnitDto) {
    return this.unitCsvService.aggregateCsv();
  }

  @Get('csv/orders')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="unit-orders.csv"')
  aggregateOrdersCsv() {
    return this.unitCsvService.aggregateOrdersCsv();
  }
}
