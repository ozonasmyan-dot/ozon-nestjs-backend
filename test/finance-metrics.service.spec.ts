import { FinanceMetricsService } from '@/modules/finance/finance-metrics.service';

describe('FinanceMetricsService', () => {
  let service: FinanceMetricsService;

  beforeAll(() => {
    service = new FinanceMetricsService();
  });

  it('calculates buyout percent', () => {
    const percent = service.calculateBuyout({
      '\u0414\u043e\u0441\u0442\u0430\u0432\u043b\u0435\u043d': 3,
      '\u041e\u0442\u043c\u0435\u043d\u0430 \u041f\u0412\u0417': 1,
      '\u0412\u043e\u0437\u0432\u0440\u0430\u0442': 1,
      '\u041c\u043e\u043c\u0435\u043d\u0442\u0430\u043b\u044c\u043d\u0430\u044f \u043e\u0442\u043c\u0435\u043d\u0430': 0,
    });
    expect(percent).toBe(60);
  });

  it('calculates margin and percentages', () => {
    const margin = service.calculateMargin(200, 100, 50, 10, 5);
    expect(margin).toBe(35);
    expect(service.calculateMarginPercent(margin, 200)).toBe(17.5);
    expect(service.calculateProfitabilityPercent(margin, 100)).toBe(35);
  });
});
