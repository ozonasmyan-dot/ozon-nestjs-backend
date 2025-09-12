import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaModule } from "./prisma/prisma.module";
import { TransactionModule } from "./transaction/transaction.module";
import { OrderModule } from "./order/order.module";
import { PerformanceApiModule } from "./api/performance/performance.module";
import { SellerApiModule } from "./api/seller/seller.module";

@Module({
  imports: [
    PrismaModule,
    TransactionModule,
    OrderModule,
    PerformanceApiModule,
    SellerApiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
