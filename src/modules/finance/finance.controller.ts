import { Controller, Get } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { FinanceAggregate } from './finance.types';

@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get()
  aggregate(): Promise<FinanceAggregate> {
    return this.financeService.aggregate();
  }
}
