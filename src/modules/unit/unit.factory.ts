import { Injectable } from '@nestjs/common';
import Decimal from '@/shared/utils/decimal';
import { Transaction } from '@prisma/client';
import { UnitEntity } from './entities/unit.entity';
import { OrderEntity } from '@/modules/order/entities/order.entity';

@Injectable()
export class UnitFactory {
  createUnit(
    order: OrderEntity,
    transactions: Transaction[],
    advertisingExpense = 0,
  ): UnitEntity {
    const uniqueTxs = [
      ...new Map(transactions.map((t) => [t.id, t])).values(),
    ];
    const transactionTotal = uniqueTxs
      .reduce((sum, t) => sum.plus(t.price), new Decimal(0))
      .toNumber();
    return new UnitEntity({
      ...order,
      transactionTotal,
      transactions: uniqueTxs,
      advertisingExpense,
    });
  }
}
