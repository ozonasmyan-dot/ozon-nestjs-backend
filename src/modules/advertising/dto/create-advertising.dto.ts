export class CreateAdvertisingDto {
  campaignId: string;
  sku: string;
  date: string;
  type: 'CPC' | 'CPO';
  clicks: number;
  toCart: number;
  avgBid: number;
  minBidCpo: number;
  minBidCpoTop: number;
  competitiveBid: number;
  weeklyBudget: number;
  moneySpent: number;
}
