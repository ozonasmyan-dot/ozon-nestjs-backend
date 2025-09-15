import { Injectable } from '@nestjs/common';
import Decimal from '@/shared/utils/decimal';
import { toDecimalUtils } from '@/shared/utils/to-decimal.utils';

@Injectable()
export class FinanceMetricsService {
  private round2(value: Decimal.Value): number {
    return new Decimal(value).toDecimalPlaces(2).toNumber();
  }

  calculateBuyout(statusCounts: Record<string, number>): number {
    const delivered = toDecimalUtils(statusCounts['\u0414\u043e\u0441\u0442\u0430\u0432\u043b\u0435\u043d']);
    const cancelPvz = toDecimalUtils(statusCounts['\u041e\u0442\u043c\u0435\u043d\u0430 \u041f\u0412\u0417']);
    const returned = toDecimalUtils(statusCounts['\u0412\u043e\u0437\u0432\u0440\u0430\u0442']);
    const instantCancel = toDecimalUtils(statusCounts['\u041c\u043e\u043c\u0435\u043d\u0442\u0430\u043b\u044c\u043d\u0430\u044f \u043e\u0442\u043c\u0435\u043d\u0430']);
    const denom = delivered.plus(cancelPvz).plus(returned).plus(instantCancel);
    if (denom.isZero()) {
      return 0;
    }
    return this.round2(delivered.div(denom).times(100));
  }

  calculateMargin(
    totalRevenue: number,
    totalCost: number,
    totalServices: number,
    sharedSum: Decimal.Value,
    otherSum: Decimal.Value,
  ): number {
    return this.round2(
      toDecimalUtils(totalRevenue)
        .minus(totalCost)
        .minus(totalServices)
        .minus(sharedSum)
        .minus(otherSum),
    );
  }

  calculateMarginPercent(margin: number, totalRevenue: number): number {
    const marginDecimal = toDecimalUtils(margin);
    return totalRevenue > 0
      ? this.round2(marginDecimal.div(totalRevenue).times(100))
      : 0;
  }

  calculateProfitabilityPercent(margin: number, totalCost: number): number {
    const marginDecimal = toDecimalUtils(margin);
    return totalCost > 0
      ? this.round2(marginDecimal.div(totalCost).times(100))
      : 0;
  }
}

