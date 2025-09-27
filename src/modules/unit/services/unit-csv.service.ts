import {Injectable} from '@nestjs/common';
import {UnitService} from '@/modules/unit/unit.service';
import {AggregateUnitDto} from '@/modules/unit/dto/aggregate-unit.dto';
import dayjs from 'dayjs';

@Injectable()
export class UnitCsvService {
    constructor(private readonly unitService: UnitService) {
    }

    async aggregateCsv(dto: AggregateUnitDto): Promise<string> {
        const items = await this.unitService.aggregate(dto);
        const header = [
            'product',
            'postingNumber',
            'createdAt',
            'status',
            'margin',
            'costPrice',
            'totalServices',
            'price',
        ];
        const rows = items.map((item) => {
            return [
                item.product,
                item.postingNumber,
                dayjs(item.createdAt).format('YYYY-MM'),
                item.status,
                item.margin,
                item.costPrice,
                item.totalServices,
                item.price,
            ].join(',');
        });
        return [header.join(','), ...rows].join('\n');
    }

    async aggregateOrdersCsv(dto: AggregateUnitDto): Promise<string> {
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
