import Decimal from '@/shared/utils/decimal';
import { EconomyContext } from './economy-context.interface';
import { CustomStatus } from './custom-status.enum';

export type StatusRule = (
  ctx: EconomyContext,
) => { statusCustom: CustomStatus; costPrice: Decimal; margin: Decimal };
