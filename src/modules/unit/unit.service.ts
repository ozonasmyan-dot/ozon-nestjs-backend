import { Injectable } from '@nestjs/common';
import { OrderRepository } from '@/modules/order/order.repository';
import { TransactionRepository } from '@/modules/transaction/transaction.repository';
import { Order, Transaction, Prisma } from '@prisma/client';
import { economy } from './economy';
import { AggregateUnitDto } from './dto/aggregate-unit.dto';

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
    items: (Order & {
      transactionTotal: number;
      transactions: Transaction[];
      costPrice: number;
      totalServices: number;
      margin: number;
    })[];
    totals: {
      statuses: Record<string, number>;
      margin: number;
      price: number;
      transactionTotal: number;
    }[];
  }> {
    const where: Prisma.OrderWhereInput = {};
    if (dto.postingNumber) {
      where.postingNumber = dto.postingNumber;
    }
    if (dto.sku) {
      where.sku = dto.sku;
    }
    if (dto.from || dto.to) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (dto.from) {
        const from = new Date(dto.from);
        from.setHours(0, 0, 0, 0);
        createdAt.gte = from;
      }
      if (dto.to) {
        const to = new Date(dto.to);
        to.setHours(23, 59, 59, 999);
        createdAt.lte = to;
      }
      where.createdAt = createdAt;
    }

    const [orders, transactions] = await Promise.all([
      this.orderRepository.findAll(where),
      this.transactionRepository.findAll(),
    ]);

    const byNumber = this.groupTransactionsByPostingNumber(transactions);

    const items = orders.map((order) => {
      const numbers = [order.postingNumber, order.orderNumber];
      const orderTransactions = numbers.flatMap(
        (num) => byNumber.get(num) ?? [],
      );
      const uniqueTxs = [
        ...new Map(orderTransactions.map((t) => [t.id, t])).values(),
      ];
      const transactionTotal = uniqueTxs.reduce((sum, t) => sum + t.price, 0);
      const services = uniqueTxs.map((t) => ({
        name: t.operationServiceName,
        price: t.price,
      }));
      const economyResult = economy({
        price: order.price,
        services,
        statusOzon: order.status,
        product: order.sku,
      });
      return {
        ...order,
        ...economyResult,
        transactionTotal,
        transactions: uniqueTxs,
      };
    });

    const filteredItems = dto.status
      ? items.filter((item) => item.status === dto.status)
      : items;

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
