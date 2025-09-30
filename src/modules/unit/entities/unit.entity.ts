import { Transaction } from '@prisma/client';
import Decimal from '@/shared/utils/decimal';
import { OrderEntity } from '@/modules/order/entities/order.entity';
import { STATUS_RULES, DEFAULT_RULE } from '../utils/status-rules';
import { EconomyContext } from '../ts/economy-context.interface';
import { Service } from '../ts/service.interface';
import { EconomyResult } from '../ts/economy-result.interface';
import { OzonStatus } from '../ts/ozon-status.enum';
import { money } from '@/shared/utils/money.utils';

export class UnitEntity extends OrderEntity {
  transactions: Transaction[];
  costPrice: number;
  totalServices: number;
  margin: number;
  advertisingPerUnit: number;
  statusCustom: OzonStatus | string;

  constructor(partial: Partial<UnitEntity>) {
    super(partial);
    Object.assign(this, partial);

    const services = this.buildServices();
    const economy = this.calculateEconomy(services);

    this.advertisingPerUnit = Decimal(this.advertisingPerUnit || 0).isZero()
        ? 0
        : Decimal(this.advertisingPerUnit).neg().toNumber();
    this.statusCustom = economy.statusCustom;
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

  private getTotalServices(services: Service[]): Decimal {
    return (services.reduce(
      (sum, { price }) => sum.plus(money(price)),
      new Decimal(0),
    ));
  }

  private hasSalesCommission(services: Service[]): boolean {
    return services.some((s) => s.name.trim() === "SaleCommission");
  }

  private getSalesCommissionSum(services: Service[]): Decimal {
    return services
      .filter((s) => s.name === "SaleCommission")
      .reduce((sum, s) => sum.plus(money(s.price)), new Decimal(0));
  }

  private findReturnPVZ(services: Service[]): number {
    return services.findIndex(
      (s) =>
        s.name === "MarketplaceServiceItemRedistributionReturnsPVZ" ||
        s.name === "MarketplaceServiceItemReturnFlowLogistic",
    );
  }

  private calculateEconomy(services: Service[]): EconomyResult {
    const totalServices = this.getTotalServices(services).toNumber();
    const hasSalesCommission = this.hasSalesCommission(services);
    const salesCommissionSum = this.getSalesCommissionSum(services).toNumber();
    const returnPVZ = this.findReturnPVZ(services);
    const advertisingPerUnit = Decimal(this.advertisingPerUnit || 0).isZero()
        ? 0
        : Decimal(this.advertisingPerUnit).neg().toNumber();

    const ctx: EconomyContext = {
      price: this.price,
      services,
      status: this.status as OzonStatus,
      product: this.sku,
      totalServices,
      hasSalesCommission,
      salesCommissionSum,
      advertisingPerUnit,
      returnPVZ,
    };

    const rule = STATUS_RULES[this.status as OzonStatus] || DEFAULT_RULE;
    const { statusCustom, costPrice, margin } = rule(ctx);

    return {
      statusCustom,
      costPrice: costPrice.toDecimalPlaces(2).toNumber(),
      totalServices: totalServices,
      margin: margin.toDecimalPlaces(2).toNumber(),
    };
  }
}
