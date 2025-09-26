import { Injectable } from '@nestjs/common';
import { UnitService } from '@/modules/unit/unit.service';
import { AggregateUnitDto } from '@/modules/unit/dto/aggregate-unit.dto';
import dayjs from 'dayjs';

@Injectable()
export class UnitCsvService {
    constructor(private readonly unitService: UnitService) {}

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
}
