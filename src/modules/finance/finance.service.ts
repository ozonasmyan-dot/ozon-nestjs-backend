import { Injectable } from '@nestjs/common';
import { OrderRepository } from '@/modules/order/order.repository';
import { TransactionRepository } from '@/modules/transaction/transaction.repository';
import { groupTransactionsByPostingNumber } from '@/shared/utils/transaction.utils';
import dayjs from 'dayjs';
import Decimal from '@/shared/utils/decimal';
import { UnitFactory } from '@/modules/unit/unit.factory';
import {
  FinanceAggregate,
  FinanceItem,
  FinanceMonth,
} from './finance.types';
import { toDecimalUtils } from '@/shared/utils/to-decimal.utils';
import { FinanceMetricsService } from './finance-metrics.service';

@Injectable()
export class FinanceService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly unitFactory: UnitFactory,
    private readonly metricsService: FinanceMetricsService,
  ) {}
  private round2(value: Decimal.Value): number {
    return new Decimal(value).toDecimalPlaces(2).toNumber();
  }

  private async loadOrdersAndTransactions() {
    const [orders, transactions] = await Promise.all([
      this.orderRepository.findAll(),
      this.transactionRepository.findAll(),
    ]);
    return { orders, transactions };
  }

  private buildFinanceItem(order: any, txs: any[]): FinanceItem {
    const unit = this.unitFactory.createUnit(order, txs);
    return {
      sku: order.sku,
      totalCost: toDecimalUtils(unit.costPrice).toNumber(),
      totalServices: toDecimalUtils(unit.totalServices).abs().toNumber(),
      totalRevenue: toDecimalUtils(unit.price).toNumber(),
      salesCount: 1,
      statusCounts: { [unit.status]: 1 },
      otherTransactions: {},
      sharedTransactions: {},
      buyoutPercent: 0,
      margin: 0,
      marginPercent: 0,
      profitabilityPercent: 0,
    };
  }

  private buildTransactionMaps(transactions: any[]) {
    const otherMap = new Map<
      string,
      Map<string, Record<string, number>>
    >();
    const generalMap = new Map<string, Record<string, number>>();

    transactions.forEach((tx) => {
      const month = dayjs(tx.date).format('MM-YYYY');
      if (tx.sku && !tx.postingNumber) {
        const sku = tx.sku as string;
        const bySku = otherMap.get(month) ?? new Map<string, Record<string, number>>();
        const nameMap = bySku.get(sku) ?? {};
        nameMap[tx.name] = toDecimalUtils(nameMap[tx.name])
          .plus(toDecimalUtils(tx.price).abs())
          .toNumber();
        bySku.set(sku, nameMap);
        otherMap.set(month, bySku);
      } else if (!tx.sku) {
        const nameMap = generalMap.get(month) ?? {};
        nameMap[tx.name] = toDecimalUtils(nameMap[tx.name])
          .plus(toDecimalUtils(tx.price).abs())
          .toNumber();
        generalMap.set(month, nameMap);
      }
    });

    return { otherMap, generalMap };
  }

  private applyTransactionMaps(
    monthMap: Map<string, Map<string, FinanceItem>>,
    otherMap: Map<string, Map<string, Record<string, number>>>,
    generalMap: Map<string, Record<string, number>>,
    monthCounts: Map<string, number>,
  ) {
    monthMap.forEach((skuMap, month) => {
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
      });
    });
  }

  async aggregate(): Promise<FinanceAggregate> {
    const { orders, transactions } = await this.loadOrdersAndTransactions();

    const byPosting = groupTransactionsByPostingNumber(transactions);

    const monthMap = new Map<string, Map<string, FinanceItem>>();
    const monthCounts = new Map<string, number>();

    // build items from orders
    orders.forEach((order) => {
      const numbers = [order.postingNumber, order.orderNumber];
      const txs = numbers.flatMap((n) => byPosting.get(n) ?? []);
      const month = dayjs(order.createdAt).format('MM-YYYY');
      const skuMap = monthMap.get(month) ?? new Map<string, FinanceItem>();
      const existing = skuMap.get(order.sku);
      const item = this.buildFinanceItem(order, txs);
      if (existing) {
        existing.totalCost = toDecimalUtils(existing.totalCost)
          .plus(item.totalCost)
          .toNumber();
        existing.totalServices = toDecimalUtils(existing.totalServices)
          .plus(item.totalServices)
          .toNumber();
        existing.totalRevenue = toDecimalUtils(existing.totalRevenue)
          .plus(item.totalRevenue)
          .toNumber();
        existing.salesCount += item.salesCount;
        Object.entries(item.statusCounts).forEach(([status, cnt]) => {
          existing.statusCounts[status] =
            (existing.statusCounts[status] ?? 0) + cnt;
        });
      } else {
        skuMap.set(order.sku, item);
      }
      monthMap.set(month, skuMap);
      monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
    });

    const { otherMap, generalMap } = this.buildTransactionMaps(transactions);
    this.applyTransactionMaps(monthMap, otherMap, generalMap, monthCounts);

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

      skuMap.forEach((item) => {
        item.buyoutPercent = this.metricsService.calculateBuyout(
          item.statusCounts,
        );
        item.totalCost = this.round2(item.totalCost);
        item.totalServices = this.round2(item.totalServices);
        item.totalRevenue = this.round2(item.totalRevenue);
        const otherSum = Object.values(item.otherTransactions).reduce(
          (sum, val) => sum.plus(val),
          new Decimal(0),
        );
        const sharedSum = Object.values(item.sharedTransactions).reduce(
          (sum, val) => sum.plus(val),
          new Decimal(0),
        );
        item.margin = this.metricsService.calculateMargin(
          item.totalRevenue,
          item.totalCost,
          item.totalServices,
          sharedSum,
          otherSum,
        );
        item.marginPercent = this.metricsService.calculateMarginPercent(
          item.margin,
          item.totalRevenue,
        );
        item.profitabilityPercent =
          this.metricsService.calculateProfitabilityPercent(
            item.margin,
            item.totalCost,
          );
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

      totals.buyoutPercent = this.metricsService.calculateBuyout(
        totals.statusCounts,
      );
      totals.totalCost = this.round2(totals.totalCost);
      totals.totalServices = this.round2(totals.totalServices);
      totals.totalRevenue = this.round2(totals.totalRevenue);
      totals.margin = this.round2(totals.margin);
      totals.marginPercent = this.metricsService.calculateMarginPercent(
        totals.margin,
        totals.totalRevenue,
      );
      totals.profitabilityPercent =
        this.metricsService.calculateProfitabilityPercent(
          totals.margin,
          totals.totalCost,
        );

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

    overall.buyoutPercent = this.metricsService.calculateBuyout(
      overall.statusCounts,
    );
    overall.totalCost = this.round2(overall.totalCost);
    overall.totalServices = this.round2(overall.totalServices);
    overall.totalRevenue = this.round2(overall.totalRevenue);
    overall.margin = this.round2(overall.margin);
    overall.marginPercent = this.metricsService.calculateMarginPercent(
      overall.margin,
      overall.totalRevenue,
    );
    overall.profitabilityPercent =
      this.metricsService.calculateProfitabilityPercent(
        overall.margin,
        overall.totalCost,
      );

    return { months, totals: overall };
  }
}

