import Decimal from '@/shared/utils/decimal';
import {CreateAdvertisingDto} from '@/modules/advertising/dto/create-advertising.dto';
import {AdvertisingEntity} from '@/modules/advertising/entities/advertising.entity';

type AdvertisingAccumulatorType = 'CPC' | 'CPO';

interface AdvertisingAccumulatorParams {
    campaignId: string;
    sku: string;
    date: string;
    type: AdvertisingAccumulatorType;
    clicks: number;
    toCart: number;
    avgBid: Decimal;
    moneySpent: Decimal;
    competitiveBid: Decimal;
    minBidCpo: Decimal;
    minBidCpoTop: Decimal;
    weeklyBudget: Decimal;
}

export class AdvertisingAccumulator {
    readonly campaignId: string;
    readonly sku: string;
    readonly date: string;
    readonly type: AdvertisingAccumulatorType;
    clicks: number;
    toCart: number;
    readonly avgBid: Decimal;
    moneySpent: Decimal;
    readonly competitiveBid: Decimal;
    readonly minBidCpo: Decimal;
    readonly minBidCpoTop: Decimal;
    readonly weeklyBudget: Decimal;

    constructor(params: AdvertisingAccumulatorParams) {
        this.campaignId = params.campaignId;
        this.sku = params.sku;
        this.date = params.date;
        this.type = params.type;
        this.clicks = params.clicks;
        this.toCart = params.toCart;
        this.avgBid = params.avgBid;
        this.moneySpent = params.moneySpent;
        this.competitiveBid = params.competitiveBid;
        this.minBidCpo = params.minBidCpo;
        this.minBidCpoTop = params.minBidCpoTop;
        this.weeklyBudget = params.weeklyBudget;
    }

    get aggregationKey(): string {
        return `${this.date}_${this.sku}`;
    }

    mergeWith(accumulator: AdvertisingAccumulator): void {
        this.clicks += accumulator.clicks;
        this.toCart += accumulator.toCart;
        this.moneySpent = this.moneySpent.plus(accumulator.moneySpent);
    }

    toDto(): CreateAdvertisingDto {
        return {
            campaignId: this.campaignId,
            sku: this.sku,
            date: this.date,
            type: this.type,
            clicks: this.clicks,
            toCart: this.toCart,
            minBidCpo: this.minBidCpo.toNumber(),
            minBidCpoTop: this.minBidCpoTop.toNumber(),
            competitiveBid: this.competitiveBid.toNumber(),
            weeklyBudget: this.weeklyBudget.toNumber(),
            avgBid: this.avgBid.toNumber(),
            moneySpent: this.moneySpent.toNumber(),
        };
    }

    toEntity(): AdvertisingEntity {
        return new AdvertisingEntity(this.toDto());
    }
}
