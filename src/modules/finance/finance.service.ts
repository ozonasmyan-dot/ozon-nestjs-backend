import { Injectable } from '@nestjs/common';
import { OrderRepository } from '@/modules/order/order.repository';
import { TransactionRepository } from '@/modules/transaction/transaction.repository';
import { Transaction } from '@prisma/client';
import dayjs from 'dayjs';
import { UnitEntity } from '@/modules/unit/entities/unit.entity';
import {
  FinanceAggregate,
  FinanceItem,
  FinanceMonth,
} from './finance.types';

@Injectable()
export class FinanceService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly transactionRepository: TransactionRepository,
  ) {}

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private computeBuyout(statusCounts: Record<string, number>): number {
    const delivered = statusCounts['Доставлен'] ?? 0;
    const cancelPvz = statusCounts['Отмена ПВЗ'] ?? 0;
    const returned = statusCounts['Возврат'] ?? 0;
    const instantCancel = statusCounts['Моментальная отмена'] ?? 0;
    const denom = delivered + cancelPvz + returned + instantCancel;
    if (denom === 0) {
      return 0;
    }
    return this.round2((delivered / denom) * 100);
  }

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

  async aggregate(): Promise<FinanceAggregate> {
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
          totalCost: 0,
          totalServices: 0,
          totalRevenue: 0,
          salesCount: 0,
          statusCounts: {},
          otherTransactions: {},
          sharedTransactions: {},
          buyoutPercent: 0,
          margin: 0,
        };
      item.totalCost += unit.costPrice;
      item.totalServices += unit.totalServices;
      item.totalRevenue += unit.price;
      item.salesCount += 1;
      item.statusCounts[unit.status] = (item.statusCounts[unit.status] ?? 0) + 1;
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
      totalCost: 0,
      totalServices: 0,
      totalRevenue: 0,
      salesCount: 0,
      statusCounts: {} as Record<string, number>,
      buyoutPercent: 0,
      margin: 0,
    };

    monthMap.forEach((skuMap, month) => {
      const items: FinanceItem[] = [];
      const totals = {
        totalCost: 0,
        totalServices: 0,
        totalRevenue: 0,
        salesCount: 0,
        statusCounts: {} as Record<string, number>,
        buyoutPercent: 0,
        margin: 0,
      };

      const otherBySku = otherMap.get(month);
      const generalByName = generalMap.get(month) ?? {};
      const totalCount = monthCounts.get(month) ?? 0;

      skuMap.forEach((item, sku) => {
        if (otherBySku && otherBySku.has(sku)) {
          item.otherTransactions = Object.fromEntries(
            Object.entries(otherBySku.get(sku)!).map(([name, sum]) => [
              name,
              this.round2(sum),
            ]),
          );
        }
        const sharedTx: Record<string, number> = {};
        if (totalCount > 0) {
          Object.entries(generalByName).forEach(([name, sum]) => {
            sharedTx[name] = this.round2(sum / totalCount);
          });
        }
        item.sharedTransactions = sharedTx;
        item.buyoutPercent = this.computeBuyout(item.statusCounts);
        item.totalCost = this.round2(item.totalCost);
        item.totalServices = this.round2(item.totalServices);
        item.totalRevenue = this.round2(item.totalRevenue);
        const otherSum = Object.values(item.otherTransactions).reduce(
          (sum, val) => sum + val,
          0,
        );
        const sharedSum = Object.values(sharedTx).reduce(
          (sum, val) => sum + val,
          0,
        );
        item.margin = this.round2(
          item.totalRevenue -
            item.totalCost -
            item.totalServices -
            sharedSum -
            otherSum,
        );
        items.push(item);

        totals.totalCost += item.totalCost;
        totals.totalServices += item.totalServices;
        totals.totalRevenue += item.totalRevenue;
        totals.margin += item.margin;
        totals.salesCount += item.salesCount;
        Object.entries(item.statusCounts).forEach(([status, cnt]) => {
          totals.statusCounts[status] = (totals.statusCounts[status] ?? 0) + cnt;
        });
      });

      totals.buyoutPercent = this.computeBuyout(totals.statusCounts);
      totals.totalCost = this.round2(totals.totalCost);
      totals.totalServices = this.round2(totals.totalServices);
      totals.totalRevenue = this.round2(totals.totalRevenue);
      totals.margin = this.round2(totals.margin);

      months.push({ month, items, totals });

      overall.totalCost += totals.totalCost;
      overall.totalServices += totals.totalServices;
      overall.totalRevenue += totals.totalRevenue;
      overall.margin += totals.margin;
      overall.salesCount += totals.salesCount;
      Object.entries(totals.statusCounts).forEach(([status, cnt]) => {
        overall.statusCounts[status] = (overall.statusCounts[status] ?? 0) + cnt;
      });
    });

    overall.buyoutPercent = this.computeBuyout(overall.statusCounts);
    overall.totalCost = this.round2(overall.totalCost);
    overall.totalServices = this.round2(overall.totalServices);
    overall.totalRevenue = this.round2(overall.totalRevenue);
    overall.margin = this.round2(overall.margin);

    return { months, totals: overall };
  }
}

