import {Module} from '@nestjs/common';
import {PrismaModule} from '@/prisma/prisma.module';
import {AdvertisingController} from "@/modules/advertising/advertising.controller";
import {AdvertisingApiService} from "@/api/performance/advertising.service";
import {PerformanceApiModule} from "@/api/performance/performance.module";
import {AdvertisingService} from "@/modules/advertising/advertising.service";

@Module({
    imports: [PrismaModule, PerformanceApiModule],
    controllers: [AdvertisingController],
    providers: [AdvertisingApiService, AdvertisingService],
})
export class AdvertisingModule {
}
