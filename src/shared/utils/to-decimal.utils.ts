import Decimal from 'decimal.js';

export const toDecimalUtils = (value: number | string | undefined): Decimal =>
  new Decimal(value ?? 0);
