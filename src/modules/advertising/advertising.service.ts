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

dayjs.extend(customParseFormat);

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
            from: date + 'T21:00:00Z',
            to: date + 'T20:59:59Z',
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
                this.logger.debug(`Skipping campaign ${row.id} for date ${date} due to zero spend`);
                continue;
            }

            try {
                const sku = await this.advertisingApiService.getProductsInCampaign(row.id);

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

    async saveParsedCpo() {
        const ads: any = this.cpoParserService.parseCPO();

        for (const ad of ads) {
            await this.advertisingRepository.upsertMany([{
                campaignId: String(ad['ID заказа']),
                sku: String(ad['SKU продвигаемого товара']),
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

    async sync() {
        // const dates = getDatesUntilTodayUTC3('2025-09-24');
        //
        // for (const date of dates) {
        //     await this.getStatisticsExpense(date);
        // }
        //
        // return 'OK';


        return await this.saveParsedCpo();
    }
}
