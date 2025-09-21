import { Controller, Get, Query } from '@nestjs/common';
import {AdvertisingService} from "@/modules/advertising/advertising.service";
import {FilterAdvertisingDto} from "@/modules/advertising/dto/filter-advertising.dto";

@Controller('advertising')
export class AdvertisingController {
  constructor(private readonly advertisingService: AdvertisingService) {}

  @Get()
  findMany(@Query() dto: FilterAdvertisingDto) {
    return this.advertisingService.findMany(dto);
  }

  @Get('sync')
  sync() {
    return this.advertisingService.get();
  }
}
