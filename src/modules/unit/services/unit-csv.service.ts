import {Injectable} from '@nestjs/common';
import {UnitService} from '@/modules/unit/unit.service';
import {AggregateUnitDto} from '@/modules/unit/dto/aggregate-unit.dto';
import dayjs from 'dayjs';
import {OrderService} from '@/modules/order/order.service';
import {TransactionService} from '@/modules/transaction/transaction.service';
import {AdvertisingService} from '@/modules/advertising/advertising.service';
import {GetPostingsDto} from '@/api/seller/dto/get-postings.dto';

@Injectable()
export class UnitCsvService {
    private synchronizationPromise: Promise<void> | null = null;

    constructor(
        private readonly unitService: UnitService,
        private readonly orderService: OrderService,
        private readonly transactionService: TransactionService,
        private readonly advertisingService: AdvertisingService,
    ) {
    }

    private createDefaultOrderSyncDto(): GetPostingsDto {
        return {
            limit: 1000,
            with: {
                analytics_data: true,
                financial_data: true,
            },
        };
    }

    private async performSynchronization(): Promise<void> {
        await Promise.all([
            this.transactionService.sync(),
            this.orderService.sync(this.createDefaultOrderSyncDto()),
            this.advertisingService.sync(),
        ]);
    }

    private async ensureSynchronized(): Promise<void> {
        if (!this.synchronizationPromise) {
            this.synchronizationPromise = this.performSynchronization().finally(() => {
                this.synchronizationPromise = null;
            });
        }

        await this.synchronizationPromise;
    }

    async aggregateCsv(dto: AggregateUnitDto): Promise<string> {
        await this.ensureSynchronized();
        const items = await this.unitService.aggregate(dto);
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
        ];
        const rows = items.map((item) => {
            return [
                item.product,
                item.orderId,
                item.orderNumber,
                item.postingNumber,
                item.statusOzon,
                dayjs(item.createdAt).format('YYYY-MM'),
                item.price,
                item.currencyCode,
                item.status,
                item.margin,
                item.costPrice,
                item.totalServices,
                item.advertisingPerUnit,
            ].join(',');
        });
        return [header.join(','), ...rows].join('\n');
    }

    async aggregateOrdersCsv(dto: AggregateUnitDto): Promise<string> {
        await this.ensureSynchronized();
        const items = await this.unitService.aggregate(dto);
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
}
