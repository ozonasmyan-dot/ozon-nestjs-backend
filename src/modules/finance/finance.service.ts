import {Injectable} from '@nestjs/common';
import {OrderRepository} from '@/modules/order/order.repository';
import {TransactionRepository} from '@/modules/transaction/transaction.repository';
import {Transaction} from '@prisma/client';
import dayjs from 'dayjs';
import {UnitEntity} from '@/modules/unit/entities/unit.entity';
import {
    FinanceAggregate,
    FinanceItem,
    FinanceMonth,
} from './finance.types';
import Decimal from 'decimal.js';

@Injectable()
export class FinanceService {
    constructor(
        private readonly orderRepository: OrderRepository,
        private readonly transactionRepository: TransactionRepository,
    ) {
    }

    private toDecimal(value: number | string | Decimal): Decimal {
        return new Decimal(value || 0);
    }

    private computeBuyout(statusCounts: Record<string, number>): number {
        const delivered = new Decimal(statusCounts['Доставлен'] ?? 0);
        const cancelPvz = new Decimal(statusCounts['Отмена ПВЗ'] ?? 0);
        const returned = new Decimal(statusCounts['Возврат'] ?? 0);
        const instantCancel = new Decimal(statusCounts['Моментальная отмена'] ?? 0);

        const denom = delivered.plus(cancelPvz).plus(returned).plus(instantCancel);
        if (denom.isZero()) return 0;

        return delivered.div(denom).times(100).toDecimalPlaces(2).toNumber();
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
            const transactionTotal = uniqueTxs.reduce(
                (sum, t) => this.toDecimal(sum).plus(t.price).toNumber(),
                0,
            );
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

            item.totalCost = this.toDecimal(item.totalCost).plus(unit.costPrice).toNumber();
            item.totalServices = this.toDecimal(item.totalServices).plus(unit.totalServices).toNumber();
            item.totalRevenue = this.toDecimal(item.totalRevenue).plus(unit.price).toNumber();
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
                nameMap[tx.name] = this.toDecimal(nameMap[tx.name] ?? 0).plus(tx.price).toNumber();
                bySku.set(sku, nameMap);
                otherMap.set(month, bySku);
            });

        // general transactions (without sku)
        transactions
            .filter((tx) => !tx.sku)
            .forEach((tx) => {
                const month = dayjs(tx.date).format('MM-YYYY');
                const nameMap = generalMap.get(month) ?? {};
                nameMap[tx.name] = this.toDecimal(nameMap[tx.name] ?? 0).plus(tx.price).toNumber();
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
            let totals = {
                totalCost: new Decimal(0),
                totalServices: new Decimal(0),
                totalRevenue: new Decimal(0),
                salesCount: 0,
                statusCounts: {} as Record<string, number>,
                buyoutPercent: 0,
                margin: new Decimal(0),
                marginPercent: 0,
                profitabilityPercent: 0,
            };

            const otherBySku = otherMap.get(month);
            const generalByName = generalMap.get(month) ?? {};
            const totalCount = monthCounts.get(month) ?? 0;

            skuMap.forEach((item) => {
                if (otherBySku && otherBySku.has(item.sku)) {
                    item.otherTransactions = Object.fromEntries(
                        Object.entries(otherBySku.get(item.sku)!).map(([name, sum]) => [
                            name,
                            this.toDecimal(sum).toDecimalPlaces(2).toNumber(),
                        ]),
                    );
                }
                const sharedTx: Record<string, number> = {};
                if (totalCount > 0) {
                    Object.entries(generalByName).forEach(([name, sum]) => {
                        sharedTx[name] = this.toDecimal(sum)
                            .div(totalCount)
                            .toDecimalPlaces(2)
                            .toNumber();
                    });
                }
                item.sharedTransactions = sharedTx;

                const otherSum = Object.values(item.otherTransactions).reduce(
                    (sum, val) => this.toDecimal(sum).plus(val).toNumber(),
                    0,
                );
                const sharedSum = Object.values(sharedTx).reduce(
                    (sum, val) => this.toDecimal(sum).plus(val).toNumber(),
                    0,
                );

                const margin = this.toDecimal(item.totalRevenue)
                    .minus(Decimal.abs(item.totalCost))
                    .minus(Decimal.abs(item.totalServices))
                    .minus(Decimal.abs(otherSum))
                    .minus(Decimal.abs(sharedSum));

                item.margin = margin.toDecimalPlaces(2).toNumber();
                item.buyoutPercent = this.computeBuyout(item.statusCounts);
                item.marginPercent =
                    item.totalRevenue > 0
                        ? margin.div(item.totalRevenue).times(100).toDecimalPlaces(2).toNumber()
                        : 0;
                item.profitabilityPercent =
                    item.totalCost > 0
                        ? margin.div(item.totalCost).times(100).toDecimalPlaces(2).toNumber()
                        : 0;

                items.push(item);

                totals.totalCost = totals.totalCost.plus(item.totalCost);
                totals.totalServices = totals.totalServices.plus(item.totalServices);
                totals.totalRevenue = totals.totalRevenue.plus(item.totalRevenue);
                totals.margin = totals.margin.plus(item.margin);
                totals.salesCount += item.salesCount;
                Object.entries(item.statusCounts).forEach(([status, cnt]) => {
                    totals.statusCounts[status] = (totals.statusCounts[status] ?? 0) + cnt;
                });
            });

            const totalsObj = {
                totalCost: totals.totalCost.toDecimalPlaces(2).toNumber(),
                totalServices: totals.totalServices.toDecimalPlaces(2).toNumber(),
                totalRevenue: totals.totalRevenue.toDecimalPlaces(2).toNumber(),
                salesCount: totals.salesCount,
                statusCounts: totals.statusCounts,
                buyoutPercent: this.computeBuyout(totals.statusCounts),
                margin: totals.margin.toDecimalPlaces(2).toNumber(),
                marginPercent:
                    totals.totalRevenue.gt(0)
                        ? totals.margin.div(totals.totalRevenue).times(100).toDecimalPlaces(2).toNumber()
                        : 0,
                profitabilityPercent:
                    totals.totalCost.gt(0)
                        ? totals.margin.div(totals.totalCost).times(100).toDecimalPlaces(2).toNumber()
                        : 0,
            };

            months.push({month, items, totals: totalsObj});

            overall.totalCost += totalsObj.totalCost;
            overall.totalServices += totalsObj.totalServices;
            overall.totalRevenue += totalsObj.totalRevenue;
            overall.margin += totalsObj.margin;
            overall.salesCount += totalsObj.salesCount;
            Object.entries(totalsObj.statusCounts).forEach(([status, cnt]) => {
                overall.statusCounts[status] = (overall.statusCounts[status] ?? 0) + cnt;
            });
        });

        overall.buyoutPercent = this.computeBuyout(overall.statusCounts);
        overall.marginPercent =
            overall.totalRevenue > 0
                ? new Decimal(overall.margin).div(overall.totalRevenue).times(100).toDecimalPlaces(2).toNumber()
                : 0;
        overall.profitabilityPercent =
            overall.totalCost > 0
                ? new Decimal(overall.margin).div(overall.totalCost).times(100).toDecimalPlaces(2).toNumber()
                : 0;

        return {months, totals: overall};
    }
}
