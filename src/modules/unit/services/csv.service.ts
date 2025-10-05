import {Injectable} from '@nestjs/common';
import {UnitService} from '@/modules/unit/unit.service';
import dayjs from 'dayjs';
import Decimal from 'decimal.js';
import {money} from '@/shared/utils/money.utils';

@Injectable()
export class CsvService {
    constructor(
        private readonly unitService: UnitService,
    ) {
    }

    async aggregateCsv(): Promise<string> {
        const items = await this.unitService.aggregate();
        const serviceNames = this.collectServiceNames(items);
        const header = [
            'product',
            'orderId',
            'orderNumber',
            'postingNumber',
            'statusOzon',
            'createdAt',
            'price',
            'currencyCode',
            'status',
            'margin',
            'costPrice',
            'totalServices',
            'advertisingPerUnit',
            ...serviceNames,
        ];
        const rows = items.map((item) => {
            const services = this.collectServiceTotals(item.transactions ?? []);
            return [
                item.product,
                item.orderId,
                item.orderNumber,
                item.postingNumber,
                item.status,
                dayjs(item.createdAt).format('YYYY-MM-DD'),
                item.price,
                item.currencyCode,
                item.statusCustom,
                item.margin,
                item.costPrice,
                item.totalServices,
                item.advertisingPerUnit,
                ...serviceNames.map((name) =>
                    services.get(name)?.toDecimalPlaces(2).toNumber() ?? 0,
                ),
            ].join(',');
        });
        return [header.join(','), ...rows].join('\n');
    }

    async aggregateOrdersCsv(): Promise<string> {
        const items = await this.unitService.aggregate();
        const header = ['date', 'sku', 'ordersMoney', 'count'];

        const grouped = new Map<
            string,
            { date: string; sku: string; ordersMoney: number; count: number; }
        >();

        items.forEach((item) => {
            const date = dayjs(item.createdAt).format('YYYY-MM-DD');
            const key = `${item.sku}_${date}`;
            const current =
                grouped.get(key) ?? {
                    date,
                    sku: item.product,
                    ordersMoney: 0,
                    count: 0,
                };

            current.ordersMoney += item.price;
            current.count += 1;

            grouped.set(key, current);
        });

        const rows = Array.from(grouped.values())
            .sort((a, b) => {
                const dateDiff = a.date.localeCompare(b.date);
                if (dateDiff !== 0) {
                    return dateDiff;
                }
                return a.sku.localeCompare(b.sku);
            })
            .map((item) =>
                [item.date, item.sku, item.ordersMoney, item.count]
                    .map((value) => String(value))
                    .join(','),
            );

        return [header.join(','), ...rows].join('\n');
    }

    private collectServiceNames(items: any[]): string[] {
        const names = new Set<string>();

        items.forEach((item) => {
            (item.transactions ?? []).forEach((transaction: any) => {
                const name = this.extractServiceName(transaction);
                if (name) {
                    names.add(name);
                }
            });
        });

        return Array.from(names).sort();
    }

    private collectServiceTotals(transactions: any[]): Map<string, Decimal> {
        const totals = new Map<string, Decimal>();

        transactions.forEach((transaction) => {
            const name = this.extractServiceName(transaction);

            if (!name) {
                return;
            }

            const current = totals.get(name) ?? new Decimal(0);
            totals.set(name, current.plus(money(transaction.price)));
        });

        return totals;
    }

    private extractServiceName(transaction: any): string | null {
        const name = transaction?.name ?? transaction?.operationServiceName;

        if (!name) {
            return null;
        }

        const trimmed = String(name).trim();

        return trimmed.length ? trimmed : null;
    }
}
