import {Injectable} from '@nestjs/common';
import {AdvertisingApiService} from "@/api/performance/advertising.service";
import Decimal from 'decimal.js';
import {buildPeriods} from '@/shared/utils/date.utils';
import dayjs from "dayjs";
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
        const campaigns = await this.advertisingApiService.getCampaigns();
        const periods = buildPeriods('2025-07-01');

        const regularEntities: AdvertisingEntity[] = [];
        const groupedCampaigns: Record<string, AdvertisingAccumulator> = {};
        const groupedEntities = new Map<string, AdvertisingEntity>();

        for (const period of periods) {
            const activeCampaignIds = campaigns
                .filter((c: { id: string; createdAt: string }) =>
                    dayjs(c.createdAt).isBefore(period.to, 'day') || dayjs(c.createdAt).isSame(period.to, 'day')
                )
                .map((c: any) => c.id);

            if (!activeCampaignIds.length) {
                continue;
            }

            const chunks = Array.from(
                {length: Math.ceil(activeCampaignIds.length / 10)},
                (_, i) => activeCampaignIds.slice(i * 10, i * 10 + 10),
            ).filter((chunk) => chunk.length);

            for (const chunk of chunks) {
                const chunkRegularAccumulators: AdvertisingAccumulator[] = [];
                const changedGroupedKeys = new Set<string>();

                const statistics = await this.advertisingApiService.getStatistics({
                    campaigns: chunk,
                    groupBy: "DATE",
                    dateFrom: period.from,
                    dateTo: period.to,
                });

                for (const [campaignId, campaign] of Object.entries(statistics ?? {})) {
                    const rows = (campaign as any)?.report?.rows ?? [];

                    for (const row of rows) {
                        const skuValue = campaignId === '12950100' ? row?.advSku : row?.sku;
                        const sku = skuValue === undefined || skuValue === null ? '' : String(skuValue);

                        const accumulator: AdvertisingAccumulator = {
                            campaignId,
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
                                existing.avgBid = accumulator.avgBid;
                            } else {
                                groupedCampaigns[key] = accumulator;
                            }

                            changedGroupedKeys.add(key);
                        } else {
                            chunkRegularAccumulators.push(accumulator);
                        }
                    }
                }

                const chunkRegularEntities = chunkRegularAccumulators
                    .map((item) => this.createEntity(item))
                    .filter((item): item is AdvertisingEntity => Boolean(item));

                const chunkGroupedEntities: AdvertisingEntity[] = [];

                for (const key of changedGroupedKeys) {
                    const entity = this.createEntity(groupedCampaigns[key]);

                    if (entity) {
                        groupedEntities.set(key, entity);
                        chunkGroupedEntities.push(entity);
                    }
                }

                const chunkEntitiesToPersist = [...chunkRegularEntities, ...chunkGroupedEntities];

                if (chunkEntitiesToPersist.length) {
                    await this.advertisingRepository.upsertMany(chunkEntitiesToPersist);
                }

                regularEntities.push(...chunkRegularEntities);
            }
        }

        const groupedEntitiesList = Array.from(groupedEntities.values());

        return [...regularEntities, ...groupedEntitiesList];
    }

    private createEntity(item: AdvertisingAccumulator | undefined): AdvertisingEntity | null {
        if (!item) {
            return null;
        }

        const date = dayjs(item.date);
        const normalizedDate = date.isValid() ? date.toDate() : new Date(item.date);

        if (Number.isNaN(normalizedDate.getTime())) {
            return null;
        }

        return new AdvertisingEntity({
            campaignId: item.campaignId,
            sku: item.sku,
            date: normalizedDate,
            type: item.type,
            clicks: item.clicks,
            toCart: item.toCart,
            avgBid: item.avgBid.toNumber(),
            moneySpent: item.moneySpent.toNumber(),
        });
    }
}
