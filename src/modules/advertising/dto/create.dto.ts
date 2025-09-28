export class CreateDto {
  campaignId: string;
  sku: string;
  product: string;
  date: string;
  type: 'PPC' | 'CPO';
  clicks: number;
  toCart: number;
  views: number;
  avgBid: number;
  minBidCpo: number;
  minBidCpoTop: number;
  competitiveBid: number;
  weeklyBudget: number;
  moneySpent: number;
}
