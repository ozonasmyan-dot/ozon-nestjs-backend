import Decimal from './decimal';

export const toDecimalUtils = (value: number | string | undefined): Decimal =>
  new Decimal(value ?? 0);
