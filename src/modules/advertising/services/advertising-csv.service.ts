import { Injectable } from '@nestjs/common';
import { AdvertisingService } from '@/modules/advertising/advertising.service';
import { FilterAdvertisingDto } from '@/modules/advertising/dto/filter-advertising.dto';

@Injectable()
export class AdvertisingCsvService {
    constructor(private readonly advertisingService: AdvertisingService) {}

    async findManyCsv(filters: FilterAdvertisingDto): Promise<string> {
        const items = await this.advertisingService.findMany(filters);
        const header = [
            'id',
            'campaignId',
            'sku',
            'date',
            'type',
            'clicks',
            'toCart',
            'avgBid',
            'moneySpent',
            'minBidCpo',
            'minBidCpoTop',
            'competitiveBid',
            'weeklyBudget',
            'createdAt',
        ];

        const rows = items.map((item) =>
            [
                item.id,
                item.campaignId,
                item.sku,
                item.date,
                item.type,
                item.clicks,
                item.toCart,
                item.avgBid,
                item.moneySpent,
                item.minBidCpo,
                item.minBidCpoTop,
                item.competitiveBid,
                item.weeklyBudget,
                item.createdAt,
            ]
                .map((value) => {
                    if (value instanceof Date) {
                        return value.toISOString();
                    }

                    if (value === undefined || value === null) {
                        return '';
                    }

                    return String(value);
                })
                .join(','),
        );

        return [header.join(','), ...rows].join('\n');
    }
}
