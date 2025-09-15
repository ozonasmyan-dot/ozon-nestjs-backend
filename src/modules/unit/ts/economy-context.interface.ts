import Decimal from '@/shared/utils/decimal';
import { Service } from './service.interface';
import { OzonStatus } from './ozon-status.enum';

export interface EconomyContext {
  price: number;
  services: Service[];
  statusOzon: OzonStatus;
  product: string;
  priceDecimal: Decimal;
  totalServices: Decimal;
  hasSalesCommission: boolean;
  salesCommissionSum: Decimal;
  returnPVZ: number;
}
