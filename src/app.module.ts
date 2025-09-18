import {Module} from "@nestjs/common";
import {AppController} from "./app.controller";
import {ConfigModule} from '@nestjs/config';
import {AppService} from "./app.service";
import {PrismaModule} from "./prisma/prisma.module";
import {TransactionModule} from "./modules/transaction/transaction.module";
import {OrderModule} from "./modules/order/order.module";
import {UnitModule} from './modules/unit/unit.module';
import {PerformanceApiModule} from "./api/performance/performance.module";
import {AdvertisingModule} from "@/modules/advertising/advertising.module";
import {SellerApiModule} from "./api/seller/seller.module";
import ozonConfig from "@/config/ozon.config";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
            load: [ozonConfig]
        }),
        PrismaModule,
        TransactionModule,
        OrderModule,
        UnitModule,
        PerformanceApiModule,
        SellerApiModule,
        AdvertisingModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {
}
