import { Injectable } from '@nestjs/common';
import { OrderRepository } from '@/modules/order/order.repository';
import { TransactionRepository } from '@/modules/transaction/transaction.repository';
import { Transaction } from '@prisma/client';
import dayjs from 'dayjs';
import { UnitEntity } from '@/modules/unit/entities/unit.entity';

interface FinanceItem {
  sku: string;
  costPrice: number;
  services: number;
  price: number;
  count: number;
  statuses: Record<string, number>;
  other: Record<string, number>;
  generalTransactions: Record<string, number>;
}

interface FinanceMonth {
  month: string;
  items: FinanceItem[];
  totals: {
    costPrice: number;
    services: number;
    price: number;
    count: number;
    statuses: Record<string, number>;
  };
}

@Injectable()
export class FinanceService {
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

  async aggregate(): Promise<{ months: FinanceMonth[]; totals: FinanceMonth['totals'] }> {
    const [orders, transactions] = await Promise.all([
      this.orderRepository.findAll(),
      this.transactionRepository.findAll(),
    ]);

    const byPosting = this.groupTransactionsByPostingNumber(transactions);

    const monthMap = new Map<string, Map<string, FinanceItem>>();
    const monthCounts = new Map<string, number>();
    const otherMap = new Map<string, Map<string, Record<string, number>>>();
    const generalMap = new Map<string, Record<string, number>>();

    // build items from orders
    orders.forEach((order) => {
      const numbers = [order.postingNumber, order.orderNumber];
      const txs = numbers.flatMap((n) => byPosting.get(n) ?? []);
      const uniqueTxs = [...new Map(txs.map((t) => [t.id, t])).values()];
      const transactionTotal = uniqueTxs.reduce((sum, t) => sum + t.price, 0);
      const unit = new UnitEntity({
        ...order,
        transactionTotal,
        transactions: uniqueTxs,
      });

      const month = dayjs(order.createdAt).format('MM-YYYY');
      const skuMap = monthMap.get(month) ?? new Map<string, FinanceItem>();
      const item =
        skuMap.get(order.sku) ?? {
          sku: order.sku,
          costPrice: 0,
          services: 0,
          price: 0,
          count: 0,
          statuses: {},
          other: {},
          generalTransactions: {},
        };
      item.costPrice += unit.costPrice;
      item.services += unit.totalServices;
      item.price += unit.price;
      item.count += 1;
      item.statuses[unit.status] = (item.statuses[unit.status] ?? 0) + 1;
      skuMap.set(order.sku, item);
      monthMap.set(month, skuMap);
      monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
    });

    // other transactions (with sku but no postingNumber)
    transactions
      .filter((tx) => tx.sku && !tx.postingNumber)
      .forEach((tx) => {
        const month = dayjs(tx.date).format('MM-YYYY');
        const sku = tx.sku as string;
        const bySku = otherMap.get(month) ?? new Map<string, Record<string, number>>();
        const nameMap = bySku.get(sku) ?? {};
        nameMap[tx.name] = (nameMap[tx.name] ?? 0) + tx.price;
        bySku.set(sku, nameMap);
        otherMap.set(month, bySku);
      });

    // general transactions (without sku)
    transactions
      .filter((tx) => !tx.sku)
      .forEach((tx) => {
        const month = dayjs(tx.date).format('MM-YYYY');
        const nameMap = generalMap.get(month) ?? {};
        nameMap[tx.name] = (nameMap[tx.name] ?? 0) + tx.price;
        generalMap.set(month, nameMap);
      });

    const months: FinanceMonth[] = [];
    const overall = {
      costPrice: 0,
      services: 0,
      price: 0,
      count: 0,
      statuses: {} as Record<string, number>,
    };

    monthMap.forEach((skuMap, month) => {
      const items: FinanceItem[] = [];
      const totals = {
        costPrice: 0,
        services: 0,
        price: 0,
        count: 0,
        statuses: {} as Record<string, number>,
      };

      const otherBySku = otherMap.get(month);
      const generalByName = generalMap.get(month) ?? {};
      const totalCount = monthCounts.get(month) ?? 0;

      skuMap.forEach((item, sku) => {
        if (otherBySku && otherBySku.has(sku)) {
          item.other = otherBySku.get(sku)!;
        }
        const generalTx: Record<string, number> = {};
        if (totalCount > 0) {
          Object.entries(generalByName).forEach(([name, sum]) => {
            generalTx[name] = sum / totalCount;
          });
        }
        item.generalTransactions = generalTx;
        items.push(item);

        totals.costPrice += item.costPrice;
        totals.services += item.services;
        totals.price += item.price;
        totals.count += item.count;
        Object.entries(item.statuses).forEach(([status, cnt]) => {
          totals.statuses[status] = (totals.statuses[status] ?? 0) + cnt;
        });
      });

      months.push({ month, items, totals });

      overall.costPrice += totals.costPrice;
      overall.services += totals.services;
      overall.price += totals.price;
      overall.count += totals.count;
      Object.entries(totals.statuses).forEach(([status, cnt]) => {
        overall.statuses[status] = (overall.statuses[status] ?? 0) + cnt;
      });
    });

    return { months, totals: overall };
  }
}

