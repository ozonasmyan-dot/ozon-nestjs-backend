import { Controller, Get, Header, Query } from '@nestjs/common';
import {AdvertisingService} from "@/modules/advertising/advertising.service";
import {FilterAdvertisingDto} from "@/modules/advertising/dto/filter-advertising.dto";
import {AdvertisingCsvService} from "@/modules/advertising/services/advertising-csv.service";

@Controller('advertising')
export class AdvertisingController {
  constructor(
    private readonly advertisingService: AdvertisingService,
    private readonly advertisingCsvService: AdvertisingCsvService,
  ) {}

  @Get('sync')
  get() {
    return this.advertisingService.sync();
  }

  @Get('csv')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="advertising.csv"')
  findManyCsv(@Query() dto: FilterAdvertisingDto) {
    return this.advertisingCsvService.findManyCsv(dto);
  }
}
