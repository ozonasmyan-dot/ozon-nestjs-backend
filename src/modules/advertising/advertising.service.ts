import {Injectable} from '@nestjs/common';
import {AdvertisingApiService} from "@/api/performance/advertising.service";
import Decimal from 'decimal.js';
import {buildPeriods} from '@/shared/utils/date.utils';

@Injectable()
export class AdvertisingService {
    constructor(
        private readonly advertisingApiService: AdvertisingApiService,
    ) {
    }

    async get() {
        const campaigns = await this.advertisingApiService.getCampaigns();
        const campaignIds = campaigns.map((c: { id: any; }) => c.id);
        const chunks = Array.from({length: Math.ceil(campaignIds.length / 10)}, (_, i) => campaignIds.slice(i * 10, i * 10 + 10));
        const ads: any[] = [];
        const group12950100: Record<string, any> = {};
        const D = (v: string) => new Decimal(v);
        const periods = buildPeriods('2025-07-01');

        for (const chunk of chunks) {
            for (const period of periods) {
                const statistics = await this.advertisingApiService.getStatistics({
                    campaigns: chunk,
                    groupBy: "DATE",
                    dateFrom: period.from,
                    dateTo: period.to,
                });

                for (const [campaignId, campaign] of Object.entries(statistics)) {
                    // @ts-ignore
                    for (const row of campaign?.report.rows as any) {
                        if (campaignId !== '12950100') {
                            ads.push({
                                campaignId,
                                sku: row.sku,
                                date: row.date,
                                type: 'CPC',
                                click: row.clicks,
                                toCart: row.toCart,
                                avgBid: D((row.avgBid ?? '0').replace(',', '.')),
                                moneySpent: D((row.moneySpent ?? '0').replace(',', '.')),
                            });
                        } else {
                            const key = `${row.date}_${row.advSku}`;

                            if (group12950100[key] === undefined) {
                                group12950100[key] = {
                                    campaignId: key,
                                    sku: row.advSku,
                                    date: row.date,
                                    type: 'CPO',
                                    clicks: 0,
                                    toCart: 0,
                                    avgBid: D((row.avgBid ?? '0').replace(',', '.')),
                                    moneySpent: D((row.moneySpent ?? '0').replace(',', '.')),
                                };
                            } else {
                                group12950100[key] = {
                                    ...group12950100[key],
                                    moneySpent: D(group12950100[key].moneySpent)
                                        .plus((row.moneySpent ?? '0').replace(',', '.')),
                                };
                            }
                        }
                    }
                }

                ads.push(...Object.values(group12950100));
            }
        }

        return periods;
    }
}
