import {Injectable} from '@nestjs/common';
import {AdvertisingService} from '@/modules/advertising/advertising.service';
import {PRODUCTS} from "@/shared/constants/products";

@Injectable()
export class CsvService {
    constructor(private readonly advertisingService: AdvertisingService) {
    }

    async findManyCsv(): Promise<string> {
        const items = await this.advertisingService.findMany();
        const header = [
            'campaignId',
            'sku',
            'type',
            'views',
            'moneySpent',
            'toCart',
            'competitiveBid',
            'weeklyBudget',
            'minBidCpo',
            'minBidCpoTop',
            'avgBid',
            'empty',
            'clicks',
            'date',
        ];

        const rows = items.map((item) =>
            [
                item.campaignId,
                // @ts-ignore
                PRODUCTS[item.sku as keyof typeof PRODUCTS] ?? item.sku,
                item.type === 'PPC' ? 'Оплата за клик' : 'Оплата за заказ',
                0,
                item.moneySpent,
                item.toCart,
                item.competitiveBid,
                item.weeklyBudget,
                item.minBidCpo,
                item.minBidCpoTop,
                item.avgBid,
                '-',
                item.clicks,
                item.date,
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
