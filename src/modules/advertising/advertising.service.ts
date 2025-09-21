import {Injectable, Logger} from '@nestjs/common';
import {AdvertisingApiService} from "@/api/performance/advertising.service";
import {getDatesUntilToday} from '@/shared/utils/date.utils';
import {parseNumber} from '@/shared/utils/parse-number.utils';
import {toDecimal} from '@/shared/utils/to-decimal.utils';
import {AdvertisingRepository} from "@/modules/advertising/advertising.repository";
import {AdvertisingEntity} from "@/modules/advertising/entities/advertising.entity";
import {CreateAdvertisingDto} from "@/modules/advertising/dto/create-advertising.dto";
import {AdvertisingAccumulator} from "@/modules/advertising/utils/advertising-accumulator";

const SPECIAL_CAMPAIGN_ID = '12950100';

@Injectable()
export class AdvertisingService {
    private readonly logger = new Logger(AdvertisingService.name);

    constructor(
        private readonly advertisingApiService: AdvertisingApiService,
        private readonly advertisingRepository: AdvertisingRepository,
    ) {
    }

    async get(): Promise<AdvertisingEntity[]> {
        this.logger.log('Starting advertising statistics synchronization');
        const dates = getDatesUntilToday('2025-09-21');
        this.logger.debug(`Resolved ${dates.length} dates to process`);
        const result: AdvertisingEntity[] = [];
        const groupedCampaigns: Record<string, AdvertisingAccumulator> = {};

        for (const date of dates) {
            this.logger.log(`Processing statistics for date ${date}`);
            const statistics = await this.fetchStatisticsForDate(date);

            await this.processCampaignStatistics(date, statistics, result, groupedCampaigns);
        }

        this.logger.log(`Persisting grouped campaigns: ${Object.keys(groupedCampaigns).length} accumulators`);
        await this.persistGroupedCampaigns(groupedCampaigns, result);

        this.logger.log(`Finished synchronization with ${result.length} advertising entities`);
        return result;
    }

    private async fetchStatisticsForDate(date: string): Promise<Record<string, unknown>> {
        this.logger.debug(`Fetching daily statistics for ${date}`);
        const dailyStatistics = await this.advertisingApiService.getDailyStatistics({
            dateFrom: date,
            dateTo: date,
        });
        const campaignIds = dailyStatistics?.rows?.map((row) => row.id) ?? [];

        this.logger.debug(`Daily statistics for ${date} returned ${campaignIds.length} campaigns`);

        if (!campaignIds.length) {
            this.logger.warn(`No campaign ids returned for ${date}`);
            return {};
        }

        this.logger.debug(`Fetching grouped statistics for campaigns ${campaignIds.join(', ')} on ${date}`);
        return (await this.advertisingApiService.getStatistics({
            campaigns: campaignIds,
            groupBy: 'DATE',
            dateFrom: date,
            dateTo: date,
        })) ?? {};
    }

    private async processCampaignStatistics(
        date: string,
        statistics: Record<string, unknown>,
        result: AdvertisingEntity[],
        groupedCampaigns: Record<string, AdvertisingAccumulator>,
    ): Promise<void> {
        for (const [campaignId, campaign] of Object.entries(statistics)) {
            this.logger.debug(`Processing campaign ${campaignId} for date ${date}`);
            const rows = (campaign as any)?.report?.rows ?? [];

            for (const row of rows) {
                const accumulator = await this.buildAccumulator(date, campaignId, row);

                if (campaignId === SPECIAL_CAMPAIGN_ID) {
                    this.logger.debug(`Adding row to grouped campaign ${accumulator.aggregationKey}`);
                    this.addToGroupedCampaigns(groupedCampaigns, accumulator);
                    continue;
                }

                this.logger.debug(`Persisting accumulator for campaign ${campaignId} and SKU ${accumulator.sku}`);
                const entity = await this.persistAccumulator(accumulator);
                result.push(entity);
            }
        }
    }

    private async buildAccumulator(date: string, campaignId: string, row: any): Promise<AdvertisingAccumulator> {
        const sku = this.resolveSku(campaignId, row);
        this.logger.debug(`Building accumulator for campaign ${campaignId}, date ${date}, sku ${sku}`);
        const expenseStatistics = await this.advertisingApiService.getStatisticsExpense({
            campaignIds: campaignId,
            dateFrom: date,
            dateTo: date,
        });

        let competitiveBid = 0;
        let minBidCpo = 0;
        let minBidCpoTop = 0;

        if (campaignId !== SPECIAL_CAMPAIGN_ID) {
            this.logger.debug(`Fetching bid information for campaign ${campaignId} and sku ${sku}`);
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

            const competitiveBidValue = competitiveBidQuery?.bids?.[0]?.bid ?? 0;
            const minBidCpoValue = minBidsCpoQuery?.minBids?.[0]?.bid ?? 0;
            const minBidCpoTopValue = minBidsCpoTopQuery?.minBids?.[0]?.bid ?? 0;

            minBidCpo = minBidCpoValue;
            minBidCpoTop = minBidCpoTopValue;
            competitiveBid = Math.floor(competitiveBidValue / 1_000_000);
        }

        const resolvedDate = this.resolveDate(row);
        this.logger.debug(`Accumulator resolved date ${resolvedDate} for campaign ${campaignId}`);

        return new AdvertisingAccumulator({
            campaignId: campaignId === SPECIAL_CAMPAIGN_ID ? `${resolvedDate}-${SPECIAL_CAMPAIGN_ID}` : campaignId,
            sku,
            date: resolvedDate,
            type: campaignId === SPECIAL_CAMPAIGN_ID ? 'CPO' : 'CPC',
            clicks: parseNumber(row?.clicks),
            toCart: parseNumber(row?.toCart),
            avgBid: toDecimal(row?.avgBid),
            competitiveBid: toDecimal(competitiveBid),
            minBidCpo: toDecimal(minBidCpo),
            minBidCpoTop: toDecimal(minBidCpoTop),
            moneySpent: toDecimal(row?.moneySpent),
            weeklyBudget: toDecimal(expenseStatistics?.[0]?.weeklyBudget ?? 0),
        });
    }

    private resolveSku(campaignId: string, row: any): string {
        const skuValue = campaignId === SPECIAL_CAMPAIGN_ID ? row?.advSku : row?.sku;

        if (skuValue === undefined || skuValue === null) {
            return '';
        }

        return String(skuValue);
    }

    private resolveDate(row: any): string {
        const dateValue = row?.date;

        if (dateValue === undefined || dateValue === null) {
            return '';
        }

        return String(dateValue);
    }

    private addToGroupedCampaigns(
        groupedCampaigns: Record<string, AdvertisingAccumulator>,
        accumulator: AdvertisingAccumulator,
    ): void {
        const key = accumulator.aggregationKey;
        const existing = groupedCampaigns[key];

        if (existing) {
            this.logger.debug(`Merging accumulator into existing grouped campaign ${key}`);
            existing.mergeWith(accumulator);
            return;
        }

        this.logger.debug(`Creating new grouped accumulator ${key}`);
        groupedCampaigns[key] = accumulator;
    }

    private async persistGroupedCampaigns(
        groupedCampaigns: Record<string, AdvertisingAccumulator>,
        result: AdvertisingEntity[],
    ): Promise<void> {
        for (const accumulator of Object.values(groupedCampaigns)) {
            this.logger.debug(`Persisting grouped accumulator ${accumulator.aggregationKey}`);
            const entity = await this.persistAccumulator(accumulator);
            result.push(entity);
        }
    }

    private async persistAccumulator(accumulator: AdvertisingAccumulator): Promise<AdvertisingEntity> {
        this.logger.debug(`Upserting advertising data for campaign ${accumulator.campaignId} and sku ${accumulator.sku}`);
        const dto = accumulator.toDto();
        const entity = this.createEntity(dto);

        await this.advertisingRepository.upsertMany([dto]);

        return entity;
    }

    private createEntity(dto: CreateAdvertisingDto): AdvertisingEntity {
        return new AdvertisingEntity(dto);
    }
}
