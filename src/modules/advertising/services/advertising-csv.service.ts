import { Injectable } from '@nestjs/common';
import { AdvertisingService } from '@/modules/advertising/advertising.service';
import { FilterAdvertisingDto } from '@/modules/advertising/dto/filter-advertising.dto';

@Injectable()
export class AdvertisingCsvService {
    constructor(private readonly advertisingService: AdvertisingService) {}

    async findManyCsv(filters: FilterAdvertisingDto): Promise<string> {
        const items = await this.advertisingService.findMany(filters);
        const header = [
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
        ];

        const rows = items.map((item) =>
            [
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
            ]
                .map((value) => {
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
