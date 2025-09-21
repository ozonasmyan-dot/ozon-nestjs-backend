import {Injectable} from '@nestjs/common';
import {AdvertisingApiService} from "@/api/performance/advertising.service";
import Decimal from 'decimal.js';
import {getDatesUntilToday} from '@/shared/utils/date.utils';
import {AdvertisingRepository} from "@/modules/advertising/advertising.repository";
import {AdvertisingEntity} from "@/modules/advertising/entities/advertising.entity";

type AdvertisingAccumulator = {
    campaignId: string;
    sku: string;
    date: string;
    type: 'CPC' | 'CPO';
    clicks: number;
    toCart: number;
    avgBid: Decimal;
    moneySpent: Decimal;
};

const toDecimal = (value: string | number | null | undefined): Decimal => {
    if (value === null || value === undefined) {
        return new Decimal(0);
    }

    if (typeof value === 'number') {
        return new Decimal(value);
    }

    const normalized = value.replace(',', '.').trim();
    return new Decimal(normalized.length ? normalized : '0');
};

const parseNumber = (value: unknown): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

@Injectable()
export class AdvertisingService {
    constructor(
        private readonly advertisingApiService: AdvertisingApiService,
        private readonly advertisingRepository: AdvertisingRepository,
    ) {
    }

    async get(): Promise<AdvertisingEntity[]> {
        const dates = getDatesUntilToday('2025-09-17');
        const result: AdvertisingEntity[] = [];
        const groupedCampaigns: Record<string, AdvertisingAccumulator> = {};

        const addEntity = async (accumulator: AdvertisingAccumulator) => {
            const entity = this.createEntity(accumulator);

            result.push(entity);

            await this.advertisingRepository.upsertMany([entity]);
        };

        for (const date of dates) {
            const items = await this.advertisingApiService.getDailyStatistics({
                dateFrom: date,
                dateTo: date,
            });

            const statistics = await this.advertisingApiService.getStatistics({
                campaigns: items.rows.map((i) => i.id),
                groupBy: "DATE",
                dateFrom: date,
                dateTo: date,
            });

            for (const [campaignId, campaign] of Object.entries(statistics ?? {})) {
                const rows = (campaign as any)?.report?.rows ?? [];

                for (const row of rows) {
                    const skuValue = campaignId === '12950100' ? row?.advSku : row?.sku;
                    const sku = skuValue === undefined || skuValue === null ? '' : String(skuValue);

                    const accumulator: AdvertisingAccumulator = {
                        campaignId: campaignId === '12950100' ? `${row.date}-12950100` : campaignId,
                        sku,
                        date: String(row?.date ?? ''),
                        type: campaignId === '12950100' ? 'CPO' : 'CPC',
                        clicks: parseNumber(row?.clicks),
                        toCart: parseNumber(row?.toCart),
                        avgBid: toDecimal(row?.avgBid),
                        moneySpent: toDecimal(row?.moneySpent),
                    };

                    if (campaignId === '12950100') {
                        const key = `${accumulator.date}_${accumulator.sku}`;
                        const existing = groupedCampaigns[key];

                        if (existing) {
                            existing.clicks += accumulator.clicks;
                            existing.toCart += accumulator.toCart;
                            existing.moneySpent = existing.moneySpent.plus(accumulator.moneySpent);
                        } else {
                            groupedCampaigns[key] = accumulator;
                        }
                    } else {
                        await addEntity(accumulator);
                    }
                }
            }
        }

        for (const accumulator of Object.values(groupedCampaigns)) {
            await addEntity(accumulator);
        }

        return result;
    }

    private createEntity(accumulator: AdvertisingAccumulator): AdvertisingEntity {
        return new AdvertisingEntity({
            campaignId: accumulator.campaignId,
            sku: accumulator.sku,
            date: accumulator.date,
            type: accumulator.type,
            clicks: accumulator.clicks,
            toCart: accumulator.toCart,
            avgBid: accumulator.avgBid.toNumber(),
            moneySpent: accumulator.moneySpent.toNumber(),
        });
    }
}
