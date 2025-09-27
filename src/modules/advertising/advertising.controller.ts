import { Controller, Get, Header, Query } from '@nestjs/common';
import {AdvertisingService} from "@/modules/advertising/advertising.service";
import {CsvService} from "@/modules/advertising/services/csv.service";

@Controller('ad')
export class AdvertisingController {
  constructor(
    private readonly advertisingService: AdvertisingService,
    private readonly advertisingCsvService: CsvService,
  ) {}

  @Get('sync')
  get() {
    return this.advertisingService.sync();
  }

  @Get('csv')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="advertising.csv"')
  findManyCsv() {
    return this.advertisingCsvService.findManyCsv();
  }
}
