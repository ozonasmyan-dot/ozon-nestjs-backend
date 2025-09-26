import { Transaction } from '@prisma/client';
import Decimal from '@/shared/utils/decimal';
import { OrderEntity } from '@/modules/order/entities/order.entity';
import { STATUS_RULES, DEFAULT_RULE } from '../utils/status-rules';
import { EconomyContext } from '../ts/economy-context.interface';
import { Service } from '../ts/service.interface';
import { EconomyResult } from '../ts/economy-result.interface';
import { OzonStatus } from '../ts/ozon-status.enum';
import { toDecimalUtils } from '@/shared/utils/to-decimal.utils';

export class UnitEntity extends OrderEntity {
  transactions: Transaction[];
  costPrice: number;
  totalServices: number;
  margin: number;
  private statusOzon: OzonStatus | string;

  constructor(partial: Partial<UnitEntity>) {
    super(partial);
    Object.assign(this, partial);
    this.statusOzon = (partial.status as OzonStatus) ?? "";
    const services = this.buildServices();
    const economy = this.calculateEconomy(services);
    this.status = economy.status;
    this.costPrice = economy.costPrice;
    this.totalServices = economy.totalServices;
    this.margin = economy.margin;
  }

  private buildServices(): Service[] {
    return (this.transactions ?? []).map((tx) => ({
      name: tx.name,
      price: tx.price,
    }));
  }

  private getPriceDecimal(): Decimal {
    return toDecimalUtils(this.price);
  }

  private getTotalServices(services: Service[]): Decimal {
    return services.reduce(
      (sum, { price }) => sum.plus(toDecimalUtils(price)),
      new Decimal(0),
    );
  }

  private hasSalesCommission(services: Service[]): boolean {
    return services.some((s) => s.name.trim() === "SaleCommission");
  }

  private getSalesCommissionSum(services: Service[]): Decimal {
    return services
      .filter((s) => s.name === "SaleCommission")
      .reduce((sum, s) => sum.plus(toDecimalUtils(s.price)), new Decimal(0));
  }

  private findReturnPVZ(services: Service[]): number {
    return services.findIndex(
      (s) =>
        s.name === "MarketplaceServiceItemRedistributionReturnsPVZ" ||
        s.name === "MarketplaceServiceItemReturnFlowLogistic",
    );
  }

  private calculateEconomy(services: Service[]): EconomyResult {
    const priceDecimal = this.getPriceDecimal();
    const totalServices = this.getTotalServices(services);
    const hasSalesCommission = this.hasSalesCommission(services);
    const salesCommissionSum = this.getSalesCommissionSum(services);
    const returnPVZ = this.findReturnPVZ(services);

    const ctx: EconomyContext = {
      price: this.price,
      services,
      statusOzon: this.statusOzon as OzonStatus,
      product: this.sku,
      priceDecimal,
      totalServices,
      hasSalesCommission,
      salesCommissionSum,
      returnPVZ,
    };

    const rule = STATUS_RULES[this.statusOzon as OzonStatus] || DEFAULT_RULE;
    const { status, costPrice, margin } = rule(ctx);

    return {
      status,
      costPrice: costPrice.toDecimalPlaces(2).toNumber(),
      totalServices: totalServices.toDecimalPlaces(2).toNumber(),
      margin: margin.toDecimalPlaces(2).toNumber(),
    };
  }
}
