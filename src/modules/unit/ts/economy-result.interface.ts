import { CustomStatus } from './custom-status.enum';

export interface EconomyResult {
  status: CustomStatus;
  costPrice: number;
  totalServices: number;
  margin: number;
}
