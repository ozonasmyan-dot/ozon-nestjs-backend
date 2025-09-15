import Decimal from '@/shared/utils/decimal';
import { EconomyContext } from './economy-context.interface';
import { CustomStatus } from './custom-status.enum';

export type StatusRule = (
  ctx: EconomyContext,
) => { status: CustomStatus; costPrice: Decimal; margin: Decimal };
