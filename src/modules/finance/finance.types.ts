export interface FinanceItem {
  sku: string;
  totalCost: number;
  totalServices: number;
  totalRevenue: number;
  salesCount: number;
  statusCounts: Record<string, number>;
  otherTransactions: Record<string, number>;
  sharedTransactions: Record<string, number>;
  buyoutPercent: number;
  margin: number;
  marginPercent: number;
  profitabilityPercent: number;
}

export interface FinanceMonth {
  month: string;
  items: FinanceItem[];
  totals: {
    totalCost: number;
    totalServices: number;
    totalRevenue: number;
    salesCount: number;
    statusCounts: Record<string, number>;
    buyoutPercent: number;
    margin: number;
    marginPercent: number;
    profitabilityPercent: number;
  };
}

export interface FinanceAggregate {
  months: FinanceMonth[];
  totals: FinanceMonth['totals'];
}
