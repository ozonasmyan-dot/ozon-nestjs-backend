import {Injectable} from '@nestjs/common';
import {AdvertisingApiService} from "@/api/performance/advertising.service";
import Decimal from 'decimal.js';
import {buildPeriods} from '@/shared/utils/date.utils';
import dayjs from "dayjs";

@Injectable()
export class AdvertisingService {
    constructor(
        private readonly advertisingApiService: AdvertisingApiService,
    ) {
    }

    async get() {
        const campaigns = await this.advertisingApiService.getCampaigns();
        const periods = buildPeriods('2025-07-01');

        const ads: any[] = [];
        const group12950100: Record<string, any> = {};
        const D = (v: string) => new Decimal(v);

        for (const period of periods) {
            // 1️⃣ Отбираем кампании, которые стартовали не позже конца периода
            const activeCampaignIds = campaigns
                .filter((c: { id: string; createdAt: string }) => {
                    // createdAt в формате ISO/строки — приводим к dayjs
                    const created = dayjs(c.createdAt);
                    return created.isBefore(period.to, 'day') || created.isSame(period.to, 'day');
                })
                .map(c => c.id);

            // 2️⃣ Делим оставшиеся ID на чанки по 10
            const chunks = Array.from(
                {length: Math.ceil(activeCampaignIds.length / 10)},
                (_, i) => activeCampaignIds.slice(i * 10, i * 10 + 10)
            );

            for (const chunk of chunks) {
                const statistics = await this.advertisingApiService.getStatistics({
                    campaigns: chunk,
                    groupBy: "DATE",
                    dateFrom: period.from,
                    dateTo: period.to,
                });

                for (const [campaignId, campaign] of Object.entries(statistics)) {
                    // @ts-ignore
                    for (const row of campaign?.report?.rows ?? []) {
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
                            if (!group12950100[key]) {
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
                                group12950100[key].moneySpent = D(group12950100[key].moneySpent)
                                    .plus((row.moneySpent ?? '0').replace(',', '.'));
                            }
                        }
                    }
                }
            }
        }

        ads.push(...Object.values(group12950100));

        return ads
    }
}
