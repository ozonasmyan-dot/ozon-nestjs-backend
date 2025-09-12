import {Module} from "@nestjs/common";
import {AppController} from "./app.controller";
import {ConfigModule} from '@nestjs/config';
import {AppService} from "./app.service";
import {PrismaModule} from "./prisma/prisma.module";
import {TransactionModule} from "./modules/transaction/transaction.module";
import {OrderModule} from "./modules/order/order.module";
import { PerformanceApiModule } from "./api/performance/performance.module";
import { SellerApiModule } from "./api/seller/seller.module";
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
        PerformanceApiModule,
        SellerApiModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {
}
