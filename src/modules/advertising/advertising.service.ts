import {Injectable, Logger} from '@nestjs/common';
import {AdvertisingApiService} from "@/api/performance/advertising.service";
import {AdvertisingRepository} from "@/modules/advertising/advertising.repository";
import {AdvertisingEntity} from "@/modules/advertising/entities/advertising.entity";
import {FilterAdvertisingDto} from "@/modules/advertising/dto/filter-advertising.dto";
import {money} from "@/shared/utils/money.utils";
import {parseNumber} from "@/shared/utils/parse-number.utils";
import customParseFormat from 'dayjs/plugin/customParseFormat';
import dayjs from "dayjs";
import {CpoParserService} from "@/modules/advertising/services/cpo-parser.service";
import {getDatesUntilTodayUTC3} from "@/shared/utils/date.utils";
import {PRODUCTS} from "@/shared/constants/products";

dayjs.extend(customParseFormat);

const normalizeSku = (value: unknown): string | null => {
    if (value === null || value === undefined) {
        return null;
    }
    const trimmed = String(value).trim();
    return trimmed.length ? trimmed : null;
};

@Injectable()
export class AdvertisingService {
    private readonly logger = new Logger(AdvertisingService.name);

    constructor(
        private readonly advertisingApiService: AdvertisingApiService,
        private readonly advertisingRepository: AdvertisingRepository,
        private readonly cpoParserService: CpoParserService,
    ) {
    }

    async findMany(filters: FilterAdvertisingDto): Promise<AdvertisingEntity[]> {
        const items = await this.advertisingRepository.findMany(filters);

        return items.map((item) => new AdvertisingEntity(item));
    }

    async getStatisticsExpense(date) {
        this.logger.log(`Fetching advertising expense statistics for date ${date}`);

        const ads = await this.advertisingApiService.getStatisticsExpense({
            dateFrom: date,
            dateTo: date,
        });

        if (!ads) {
            this.logger.warn(`No advertising expense statistics returned for date ${date}`);
            return;
        }

        if (ads.length === 0) {
            this.logger.warn(`Advertising expense statistics returned 0 campaigns for date ${date}`);
            return;
        }

        this.logger.log(`Processing ${ads.length} advertising campaigns for date ${date}`);

        for (const row of ads) {
            if (row.moneySpent === "0") {
                continue;
            }

            try {
                const sku = normalizeSku(
                    await this.advertisingApiService.getProductsInCampaign(row.id),
                );

                if (!sku) {
                    this.logger.warn(
                        `Campaign ${row.id} for date ${date} returned empty SKU. Skipping.`,
                    );
                    continue;
                }

                const competitiveBidQuery = await this.advertisingApiService.getProductsBidsCompetitiveInCampaign(row.id, {
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

                const minBidCpo = minBidCpoValue;
                const minBidCpoTop = minBidCpoTopValue;
                const competitiveBid = Math.floor(competitiveBidValue / 1_000_000);

                await this.advertisingRepository.upsertMany([{
                    campaignId: row.id,
                    sku,
                    // @ts-ignore
                    product: PRODUCTS[sku],
                    date: date,
                    type: 'PPC',
                    clicks: parseNumber(row.clicks),
                    toCart: parseNumber(row.toCart),
                    avgBid: money(row.avgBid).toNumber(),
                    minBidCpo,
                    minBidCpoTop,
                    competitiveBid,
                    weeklyBudget: money(row.weeklyBudget).toNumber(),
                    moneySpent: money(row.moneySpent).toNumber(),
                }]);

                this.logger.log(`Updated advertising campaign ${row.id} for date ${date}`);
            } catch (error) {
                this.logger.error(
                    `Failed to process advertising campaign ${row.id} for date ${date}`,
                    error.stack,
                );
            }
        }
    }

    async saveCPO() {
        const ads: any = await this.cpoParserService.parseCPO();

        if (ads) {
            for (const ad of ads) {
                const campaignId = normalizeSku(ad['ID заказа']);
                const sku = normalizeSku(ad['SKU продвигаемого товара']);

                if (!campaignId || !sku) {
                    this.logger.warn(
                        `CPO row skipped due to missing campaignId or SKU.`,
                    );
                    continue;
                }

                await this.advertisingRepository.upsertMany([{
                    campaignId,
                    sku,
                    product: PRODUCTS[sku],
                    date: dayjs(ad['Дата'], 'DD.MM.YYYY').format('YYYY-MM-DD'),
                    type: 'CPO',
                    clicks: 0,
                    toCart: 0,
                    avgBid: money(ad['Ставка, ₽']).toNumber(),
                    minBidCpo: 0,
                    minBidCpoTop: 0,
                    competitiveBid: 0,
                    weeklyBudget: 0,
                    moneySpent: money(ad['Расход, ₽']).toNumber(),
                }]);
            }
        }
    }

    async sync() {
        const latestDate = await this.advertisingRepository.findLatestDate();
        const startDate = latestDate ?? '2025-09-25';
        const dates = getDatesUntilTodayUTC3(startDate);

        for (const date of dates) {
            await this.getStatisticsExpense(date);
        }

        await this.saveCPO();

        return 'OK';
    }
}
