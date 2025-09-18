import { Advertising } from '@prisma/client';

type AdvertisingConstructor = Partial<Advertising>;

export class AdvertisingEntity implements Advertising {
  id: string;
  campaignId: string;
  sku: string;
  date: string;
  type: string;
  clicks: number;
  toCart: number;
  avgBid: number;
  moneySpent: number;
  createdAt: Date;

  constructor(partial: AdvertisingConstructor) {
    Object.assign(this, partial);
  }
}
