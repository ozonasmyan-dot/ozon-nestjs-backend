import { CustomStatus } from './custom-status.enum';

export interface EconomyResult {
  statusCustom: CustomStatus;
  costPrice: number;
  totalServices: number;
  margin: number;
}
