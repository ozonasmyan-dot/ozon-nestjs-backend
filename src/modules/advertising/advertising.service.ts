import {Injectable} from '@nestjs/common';
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

    async findManyCsv(filters: FilterAdvertisingDto): Promise<string> {
        const items = await this.findMany(filters);
        const header = [
            'id',
            'campaignId',
            'sku',
            'date',
            'type',
            'clicks',
            'toCart',
            'avgBid',
            'moneySpent',
            'minBidCpo',
            'minBidCpoTop',
            'competitiveBid',
            'weeklyBudget',
            'createdAt',
        ];

        const rows = items.map((item) =>
            [
                item.id,
                item.campaignId,
                item.sku,
                item.date,
                item.type,
                item.clicks,
                item.toCart,
                item.avgBid,
                item.moneySpent,
                item.minBidCpo,
                item.minBidCpoTop,
                item.competitiveBid,
                item.weeklyBudget,
                item.createdAt,
            ]
                .map((value) => {
                    if (value instanceof Date) {
                        return value.toISOString();
                    }

                    if (value === undefined || value === null) {
                        return '';
                    }

                    return String(value);
                })
                .join(','),
        );

        return [header.join(','), ...rows].join('\n');
    }

    async getStatisticsExpense(date) {
        const ads = await this.advertisingApiService.getStatisticsExpense({
            from: date + 'T21:00:00Z',
            to: date + 'T20:59:59Z',
        });

        if (ads) {
            for (const row of ads) {
                if (row.moneySpent !== "0") {
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
                }
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
