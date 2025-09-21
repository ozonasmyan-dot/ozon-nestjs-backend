import {Injectable} from '@nestjs/common';
import {AdvertisingApiService} from "@/api/performance/advertising.service";
import Decimal from '@/shared/utils/decimal';
import {getDatesUntilToday} from '@/shared/utils/date.utils';
import {parseNumber} from '@/shared/utils/parse-number.utils';
import {toDecimal} from '@/shared/utils/to-decimal.utils';
import {AdvertisingRepository} from "@/modules/advertising/advertising.repository";
import {AdvertisingEntity} from "@/modules/advertising/entities/advertising.entity";
import {CreateAdvertisingDto} from "@/modules/advertising/dto/create-advertising.dto";

type AdvertisingAccumulator = {
    campaignId: string;
    sku: string;
    date: string;
    type: 'CPC' | 'CPO';
    clicks: number;
    toCart: number;
    avgBid: Decimal;
    moneySpent: Decimal;
    competitiveBid: Decimal;
    minBidCpo: Decimal;
    minBidCpoTop: Decimal;
    weeklyBudget: Decimal;
};

@Injectable()
export class AdvertisingService {
    constructor(
        private readonly advertisingApiService: AdvertisingApiService,
        private readonly advertisingRepository: AdvertisingRepository,
    ) {
    }

    async get(): Promise<AdvertisingEntity[]> {
        const dates = getDatesUntilToday('2025-09-21');
        const result: AdvertisingEntity[] = [];
        const groupedCampaigns: Record<string, AdvertisingAccumulator> = {};

        const addEntity = async (accumulator: AdvertisingAccumulator) => {
            const dto: CreateAdvertisingDto = {
                campaignId: accumulator.campaignId,
                sku: accumulator.sku,
                date: accumulator.date,
                type: accumulator.type,
                clicks: accumulator.clicks,
                toCart: accumulator.toCart,
                minBidCpo: accumulator.minBidCpo.toNumber(),
                minBidCpoTop: accumulator.minBidCpoTop.toNumber(),
                competitiveBid: accumulator.competitiveBid.toNumber(),
                weeklyBudget: accumulator.weeklyBudget.toNumber(),
                avgBid: accumulator.avgBid.toNumber(),
                moneySpent: accumulator.moneySpent.toNumber(),
            };
            const entity = this.createEntity(dto);

            result.push(entity);

            await this.advertisingRepository.upsertMany([dto]);
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
                    let competitiveBid = 0;
                    let minBidCpo = 0;
                    let minBidCpoTop = 0;

                    const otherStats = await this.advertisingApiService.getStatisticsExpense({
                        campaignIds: campaignId,
                        dateFrom: date,
                        dateTo: date,
                    });

                    if (campaignId !== '12950100') {
                        const competitiveBidQuery = await this.advertisingApiService.getProductsBidsCompetitiveInCampaign(campaignId, {
                            skus: sku,
                        });

                        const minBidsCpoQuery = await this.advertisingApiService.getMinBidSku({
                            sku: [sku],
                            paymentType: 'CPC',
                        });

                        const minBidsCpoTopQuery = await this.advertisingApiService.getMinBidSku({
                            sku: [sku],
                            paymentType: 'CPC_TOP',
                        });

                        minBidCpo = minBidsCpoQuery.minBids[0].bid ?? 0;
                        minBidCpoTop = minBidsCpoTopQuery.minBids[0].bid ?? 0;
                        competitiveBid = Math.floor(competitiveBidQuery.bids[0].bid / 1_000_000);
                    }

                    const accumulator: AdvertisingAccumulator = {
                        campaignId: campaignId === '12950100' ? `${row.date}-12950100` : campaignId,
                        sku,
                        date: String(row?.date ?? ''),
                        type: campaignId === '12950100' ? 'CPO' : 'CPC',
                        clicks: parseNumber(row?.clicks),
                        toCart: parseNumber(row?.toCart),
                        avgBid: toDecimal(row?.avgBid),
                        competitiveBid: toDecimal(competitiveBid),
                        minBidCpo: toDecimal(minBidCpo),
                        minBidCpoTop: toDecimal(minBidCpoTop),
                        moneySpent: toDecimal(row?.moneySpent),
                        weeklyBudget: toDecimal(otherStats[0]?.weeklyBudget ?? 0),
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

    private createEntity(dto: CreateAdvertisingDto): AdvertisingEntity {
        return new AdvertisingEntity(dto);
    }
}
