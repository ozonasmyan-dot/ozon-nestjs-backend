import { Injectable } from '@nestjs/common';
import { OrderRepository } from '@/modules/order/order.repository';
import { TransactionRepository } from '@/modules/transaction/transaction.repository';
import { Transaction } from '@/modules/transaction/entities/transaction.entity';
import { AggregateUnitDto } from './dto/aggregate-unit.dto';
import { UnitEntity } from './entities/unit.entity';
import { buildOrderWhere } from './utils/order-filter.utils';

@Injectable()
export class UnitService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly transactionRepository: TransactionRepository,
  ) {}

  private groupTransactionsByPostingNumber(
    transactions: Transaction[],
  ): Map<string, Transaction[]> {
    return transactions.reduce((map, tx) => {
      if (!tx.postingNumber) {
        return map;
      }
      const list = map.get(tx.postingNumber) ?? [];
      list.push(tx);
      map.set(tx.postingNumber, list);
      return map;
    }, new Map<string, Transaction[]>());
  }

  async aggregate(dto: AggregateUnitDto): Promise<{
    items: UnitEntity[];
    totals: {
      statuses: Record<string, number>;
      margin: number;
      price: number;
      transactionTotal: number;
    }[];
  }> {
    const where = buildOrderWhere(dto);

    const [orders, transactions] = await Promise.all([
      this.orderRepository.findAll(where),
      this.transactionRepository.findAll(),
    ]);

    const byNumber = this.groupTransactionsByPostingNumber(transactions);

    const usedIds = new Set<string>();

    const items = orders.map((order) => {
      const numbers = [order.postingNumber, order.orderNumber];
      const orderTransactions = numbers.flatMap(
        (num) => byNumber.get(num) ?? [],
      );
      orderTransactions.forEach((tx) => {
        tx.inOrder = true;
        usedIds.add(tx.id);
      });
      const uniqueTxs = [
        ...new Map(orderTransactions.map((t) => [t.id, t])).values(),
      ];
      const transactionTotal = uniqueTxs.reduce((sum, t) => sum + t.price, 0);
      return new UnitEntity({
        ...order,
        transactionTotal,
        transactions: uniqueTxs,
      });
    });

    const statuses = dto.status
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const filteredItems = statuses
      ? items.filter((item) => statuses.includes(item.status))
      : items;

    if (usedIds.size) {
      const operations = [...usedIds].map((id) =>
        this.transactionRepository.update(id, { inOrder: true }),
      );
      await this.transactionRepository.transaction(operations);
    }

    const totals = filteredItems.reduce(
      (acc, item) => {
        acc.margin += item.margin;
        acc.price += item.price;
        acc.transactionTotal += item.transactionTotal;
        acc.statuses[item.status] = (acc.statuses[item.status] ?? 0) + 1;
        return acc;
      },
      {
        statuses: {} as Record<string, number>,
        margin: 0,
        price: 0,
        transactionTotal: 0,
      },
    );

    return { items: filteredItems, totals: [totals] };
  }
}
