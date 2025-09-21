export class CreateAdvertisingDto {
  campaignId: string;
  sku: string;
  date: string;
  type: 'CPC' | 'CPO';
  clicks: number;
  toCart: number;
  avgBid: number;
  moneySpent: number;
}
