export interface FinanceItem {
  sku: string;
  costPrice: number;
  services: number;
  price: number;
  count: number;
  statuses: Record<string, number>;
  other: Record<string, number>;
  generalTransactions: Record<string, number>;
}

export interface FinanceMonth {
  month: string;
  items: FinanceItem[];
  totals: {
    costPrice: number;
    services: number;
    price: number;
    count: number;
    statuses: Record<string, number>;
  };
}

export interface FinanceAggregate {
  months: FinanceMonth[];
  totals: FinanceMonth['totals'];
}
