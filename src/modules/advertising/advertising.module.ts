import {Module} from '@nestjs/common';
import {PrismaModule} from '@/prisma/prisma.module';
import {AdvertisingController} from "@/modules/advertising/advertising.controller";
import {AdvertisingApiService} from "@/api/performance/advertising.service";
import {PerformanceApiModule} from "@/api/performance/performance.module";
import {AdvertisingService} from "@/modules/advertising/advertising.service";
import {AdvertisingRepository} from "@/modules/advertising/advertising.repository";
import {CpoParserService} from "@/modules/advertising/services/cpo-parser.service";
import {AdvertisingCsvService} from "@/modules/advertising/services/advertising-csv.service";

@Module({
    imports: [PrismaModule, PerformanceApiModule],
    controllers: [AdvertisingController],
    providers: [
        AdvertisingApiService,
        AdvertisingService,
        AdvertisingRepository,
        CpoParserService,
        AdvertisingCsvService,
    ],
    exports: [AdvertisingService],
})
export class AdvertisingModule {
}
