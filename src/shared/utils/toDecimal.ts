import Decimal from 'decimal.js';

export const toDecimal = (value: number | string | undefined): Decimal =>
  new Decimal(value ?? 0);
