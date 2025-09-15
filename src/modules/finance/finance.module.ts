import { Module } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { OrderRepository } from '@/modules/order/order.repository';
import { TransactionRepository } from '@/modules/transaction/transaction.repository';
import { UnitFactory } from '@/modules/unit/unit.factory';

@Module({
  imports: [PrismaModule],
  controllers: [FinanceController],
  providers: [FinanceService, OrderRepository, TransactionRepository, UnitFactory],
})
export class FinanceModule {}
