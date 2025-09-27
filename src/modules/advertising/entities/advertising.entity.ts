import { Advertising } from '@prisma/client';

type AdvertisingConstructor = Partial<Advertising>;

export class AdvertisingEntity implements Advertising {
  id: string;
  campaignId: string;
  product: string;
  sku: string;
  date: string;
  type: string;
  clicks: number;
  toCart: number;
  avgBid: number;
  moneySpent: number;
  minBidCpo: number;
  minBidCpoTop: number;
  competitiveBid: number;
  weeklyBudget: number;
  createdAt: Date;

  constructor(partial: AdvertisingConstructor) {
    Object.assign(this, partial);
  }
}
