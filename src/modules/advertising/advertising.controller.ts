import { Controller, Get } from '@nestjs/common';
import {AdvertisingService} from "@/modules/advertising/advertising.service";

@Controller('advertising')
export class AdvertisingController {
  constructor(private readonly advertisingService: AdvertisingService) {}

  @Get('list')
  list() {
    return this.advertisingService.get();
  }
}
