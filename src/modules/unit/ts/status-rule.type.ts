import Decimal from 'decimal.js';
import { EconomyContext } from './economy-context.interface';
import { CustomStatus } from './custom-status.enum';

export type StatusRule = (
  ctx: EconomyContext,
) => { status: CustomStatus; costPrice: Decimal; margin: Decimal };
