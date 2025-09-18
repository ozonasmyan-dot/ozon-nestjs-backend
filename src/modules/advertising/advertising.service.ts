import { Injectable } from '@nestjs/common';
import { AdvertisingApiService } from '@/api/performance/advertising.service';
import Decimal from 'decimal.js';
import { getDatesUntilToday } from '@/shared/utils/date.utils';
import { AdvertisingRepository } from '@/modules/advertising/advertising.repository';
import { AdvertisingEntity } from '@/modules/advertising/entities/advertising.entity';

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
    ) {}

    async get(): Promise<AdvertisingEntity[]> {
        const dates = getDatesUntilToday('2025-09-18');
        const persistedEntities: AdvertisingEntity[] = [];

        for (const date of dates) {
            const accumulators = await this.collectStatisticsForDate(date);
            const entities = accumulators
                .map((item) => this.toEntity(item))
                .filter((item): item is AdvertisingEntity => Boolean(item));

            if (!entities.length) {
                continue;
            }

            const saved = await this.advertisingRepository.upsertMany(entities);
            persistedEntities.push(...saved.map((item) => new AdvertisingEntity(item)));
        }

        return persistedEntities;
    }

    private async collectStatisticsForDate(date: string): Promise<AdvertisingAccumulator[]> {
        const regularCampaigns: AdvertisingAccumulator[] = [];
        const groupedCampaigns: Record<string, AdvertisingAccumulator> = {};

        const data = await this.advertisingApiService.getDailyStatistics({
            dateFrom: date,
            dateTo: date,
        });

        if (!data.rows.length) {
            return [];
        }

        const statistics = await this.advertisingApiService.getStatistics({
            campaigns: data.rows.map((item) => item.id),
            groupBy: 'DATE',
            dateFrom: date,
            dateTo: date,
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

                if (!accumulator.date) {
                    continue;
                }

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
                    regularCampaigns.push(accumulator);
                }
            }
        }

        return [...regularCampaigns, ...Object.values(groupedCampaigns)];
    }

    private toEntity(accumulator: AdvertisingAccumulator): AdvertisingEntity | null {
        const parsedDate = this.parseDate(accumulator.date);

        if (!parsedDate) {
            return null;
        }

        return new AdvertisingEntity({
            campaignId: accumulator.campaignId,
            sku: accumulator.sku,
            date: parsedDate,
            type: accumulator.type,
            clicks: accumulator.clicks,
            toCart: accumulator.toCart,
            avgBid: accumulator.avgBid.toNumber(),
            moneySpent: accumulator.moneySpent.toNumber(),
        });
    }

    private parseDate(value: string): Date | null {
        const normalizedDate = value.trim();

        if (!normalizedDate) {
            return null;
        }

        const direct = new Date(normalizedDate);

        if (!Number.isNaN(direct.getTime())) {
            return direct;
        }

        if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
            const isoDate = new Date(`${normalizedDate}T00:00:00.000Z`);

            if (!Number.isNaN(isoDate.getTime())) {
                return isoDate;
            }
        }

        return null;
    }
}
