import { Injectable } from '@nestjs/common';
import { OrderRepository } from '@/modules/order/order.repository';
import { TransactionRepository } from '@/modules/transaction/transaction.repository';
import { Transaction } from '@prisma/client';
import dayjs from 'dayjs';
import Decimal from '@/shared/utils/decimal';
import { UnitEntity } from '@/modules/unit/entities/unit.entity';
import { CustomStatus } from '@/modules/unit/ts/custom-status.enum';
import {
  FinanceAggregate,
  FinanceItem,
  FinanceMonth,
} from './finance.types';
import { toDecimalUtils } from '@/shared/utils/to-decimal.utils';

@Injectable()
export class FinanceService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly transactionRepository: TransactionRepository,
  ) {}

  private round2(value: Decimal.Value): number {
    return new Decimal(value).toDecimalPlaces(2).toNumber();
  }

  private computeBuyout(statusCounts: Record<string, number>): number {
    const delivered = toDecimalUtils(statusCounts['Доставлен']);
    const cancelPvz = toDecimalUtils(statusCounts['Отмена ПВЗ']);
    const returned = toDecimalUtils(statusCounts['Возврат']);
    const instantCancel = toDecimalUtils(statusCounts['Моментальная отмена']);
    const denom = delivered.plus(cancelPvz).plus(returned).plus(instantCancel);
    if (denom.isZero()) {
      return 0;
    }
    return this.round2(delivered.div(denom).times(100));
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
      const transactionTotal = uniqueTxs
        .reduce((sum, t) => sum.plus(t.price), new Decimal(0))
        .toNumber();
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
          marginPercent: 0,
          profitabilityPercent: 0,
        };
      item.totalServices = toDecimalUtils(item.totalServices)
        .plus(toDecimalUtils(unit.totalServices).abs())
        .toNumber();
      if (unit.status === CustomStatus.Delivered) {
        item.totalCost = toDecimalUtils(item.totalCost)
          .plus(unit.costPrice)
          .toNumber();
        item.totalRevenue = toDecimalUtils(item.totalRevenue)
          .plus(unit.price)
          .toNumber();
      }
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
        nameMap[tx.name] = toDecimalUtils(nameMap[tx.name])
          .plus(toDecimalUtils(tx.price).abs())
          .toNumber();
        bySku.set(sku, nameMap);
        otherMap.set(month, bySku);
      });

    // general transactions (without sku)
    transactions
      .filter((tx) => !tx.sku)
      .forEach((tx) => {
        const month = dayjs(tx.date).format('MM-YYYY');
        const nameMap = generalMap.get(month) ?? {};
        nameMap[tx.name] = toDecimalUtils(nameMap[tx.name])
          .plus(toDecimalUtils(tx.price).abs())
          .toNumber();
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
      marginPercent: 0,
      profitabilityPercent: 0,
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
        marginPercent: 0,
        profitabilityPercent: 0,
      };

      const otherBySku = otherMap.get(month);
      const generalByName = generalMap.get(month) ?? {};
      const totalCount = monthCounts.get(month) ?? 0;

      skuMap.forEach((item, sku) => {
        if (otherBySku && otherBySku.has(sku)) {
          item.otherTransactions = Object.fromEntries(
            Object.entries(otherBySku.get(sku)!).map(([name, sum]) => [
              name,
              this.round2(toDecimalUtils(sum).abs()),
            ]),
          );
        }
        const sharedTx: Record<string, number> = {};
        if (totalCount > 0) {
          Object.entries(generalByName).forEach(([name, sum]) => {
            sharedTx[name] = this.round2(
              toDecimalUtils(sum).abs().div(totalCount),
            );
          });
        }
        item.sharedTransactions = sharedTx;
        item.buyoutPercent = this.computeBuyout(item.statusCounts);
        item.totalCost = this.round2(item.totalCost);
        item.totalServices = this.round2(item.totalServices);
        item.totalRevenue = this.round2(item.totalRevenue);
        const otherSum = Object.values(item.otherTransactions).reduce(
          (sum, val) => sum.plus(val),
          new Decimal(0),
        );
        const sharedSum = Object.values(sharedTx).reduce(
          (sum, val) => sum.plus(val),
          new Decimal(0),
        );
        item.margin = this.round2(
          toDecimalUtils(item.totalRevenue)
            .minus(item.totalCost)
            .minus(item.totalServices)
            .minus(sharedSum)
            .minus(otherSum),
        );
        const marginDecimal = toDecimalUtils(item.margin);
        item.marginPercent =
          item.totalRevenue > 0
            ? this.round2(marginDecimal.div(item.totalRevenue).times(100))
            : 0;
        item.profitabilityPercent =
          item.totalCost > 0
            ? this.round2(marginDecimal.div(item.totalCost).times(100))
            : 0;
        items.push(item);

        totals.totalCost = toDecimalUtils(totals.totalCost)
          .plus(item.totalCost)
          .toNumber();
        totals.totalServices = toDecimalUtils(totals.totalServices)
          .plus(item.totalServices)
          .toNumber();
        totals.totalRevenue = toDecimalUtils(totals.totalRevenue)
          .plus(item.totalRevenue)
          .toNumber();
        totals.margin = toDecimalUtils(totals.margin)
          .plus(item.margin)
          .toNumber();
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
      const totalsMarginDecimal = toDecimalUtils(totals.margin);
      totals.marginPercent =
        totals.totalRevenue > 0
          ? this.round2(
              totalsMarginDecimal
                .div(totals.totalRevenue)
                .times(100),
            )
          : 0;
      totals.profitabilityPercent =
        totals.totalCost > 0
          ? this.round2(
              totalsMarginDecimal.div(totals.totalCost).times(100),
            )
          : 0;

      months.push({ month, items, totals });

      overall.totalCost = toDecimalUtils(overall.totalCost)
        .plus(totals.totalCost)
        .toNumber();
      overall.totalServices = toDecimalUtils(overall.totalServices)
        .plus(totals.totalServices)
        .toNumber();
      overall.totalRevenue = toDecimalUtils(overall.totalRevenue)
        .plus(totals.totalRevenue)
        .toNumber();
      overall.margin = toDecimalUtils(overall.margin)
        .plus(totals.margin)
        .toNumber();
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
    const overallMarginDecimal = toDecimalUtils(overall.margin);
    overall.marginPercent =
      overall.totalRevenue > 0
        ? this.round2(
            overallMarginDecimal.div(overall.totalRevenue).times(100),
          )
        : 0;
    overall.profitabilityPercent =
      overall.totalCost > 0
        ? this.round2(
            overallMarginDecimal.div(overall.totalCost).times(100),
          )
        : 0;

    return { months, totals: overall };
  }
}

