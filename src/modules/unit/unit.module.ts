import { Module } from '@nestjs/common';
import { UnitService } from './unit.service';
import { UnitController } from './unit.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { OrderRepository } from '@/modules/order/order.repository';
import { TransactionRepository } from '@/modules/transaction/transaction.repository';
import { UnitFactory } from './unit.factory';
import { UnitCsvService } from '@/modules/unit/services/unit-csv.service';
import { AdvertisingRepository } from '@/modules/advertising/advertising.repository';

@Module({
  imports: [PrismaModule],
  controllers: [UnitController],
  providers: [
    UnitService,
    OrderRepository,
    TransactionRepository,
    UnitFactory,
    UnitCsvService,
    AdvertisingRepository,
  ],
  exports: [UnitFactory],
})
export class UnitModule {}
