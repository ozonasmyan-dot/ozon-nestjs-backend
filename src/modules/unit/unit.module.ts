import { Module } from '@nestjs/common';
import { UnitService } from './unit.service';
import { UnitController } from './unit.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { OrderRepository } from '@/modules/order/order.repository';
import { TransactionRepository } from '@/modules/transaction/transaction.repository';
import { CsvService } from '@/modules/unit/services/csv.service';
import { AdvertisingRepository } from '@/modules/advertising/advertising.repository';
import { OrderModule } from '@/modules/order/order.module';
import { TransactionModule } from '@/modules/transaction/transaction.module';
import { AdvertisingModule } from '@/modules/advertising/advertising.module';

@Module({
  imports: [PrismaModule, OrderModule, TransactionModule, AdvertisingModule],
  controllers: [UnitController],
  providers: [
    UnitService,
    OrderRepository,
    TransactionRepository,
    CsvService,
    AdvertisingRepository,
  ],
})
export class UnitModule {}
