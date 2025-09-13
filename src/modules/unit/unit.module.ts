import { Module } from '@nestjs/common';
import { UnitService } from './unit.service';
import { UnitController } from './unit.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { OrderRepository } from '@/modules/order/order.repository';
import { TransactionRepository } from '@/modules/transaction/transaction.repository';

@Module({
  imports: [PrismaModule],
  controllers: [UnitController],
  providers: [UnitService, OrderRepository, TransactionRepository],
})
export class UnitModule {}
