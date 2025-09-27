import { Injectable } from '@nestjs/common';
import { Transaction } from '@prisma/client';
import { UnitEntity } from './entities/unit.entity';
import { OrderEntity } from '@/modules/order/entities/order.entity';

@Injectable()
export class UnitFactory {
  createUnit(
    order: OrderEntity,
    transactions: Transaction[],
    additional: Partial<UnitEntity> = {},
  ): UnitEntity {
    const uniqueTxs = [
      ...new Map(transactions.map((t) => [t.id, t])).values(),
    ];
    return new UnitEntity({
      ...order,
      ...additional,
      transactions: uniqueTxs,
    });
  }
}
