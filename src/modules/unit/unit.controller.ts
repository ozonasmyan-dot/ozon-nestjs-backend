import { Controller, Get, Query } from '@nestjs/common';
import { UnitService } from './unit.service';
import { AggregateUnitDto } from './dto/aggregate-unit.dto';

@Controller('unit')
export class UnitController {
  constructor(private readonly unitService: UnitService) {}

  @Get()
  aggregate(@Query() dto: AggregateUnitDto) {
    return this.unitService.aggregate(dto);
  }
}
