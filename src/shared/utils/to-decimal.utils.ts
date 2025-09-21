import Decimal from './decimal';

export const toDecimal = (value: string | number | null | undefined): Decimal => {
  if (value === null || value === undefined) {
    return new Decimal(0);
  }

  if (typeof value === 'number') {
    return new Decimal(value);
  }

  const normalized = value.replace(',', '.').trim();

  return new Decimal(normalized.length ? normalized : '0');
};

export const toDecimalUtils = toDecimal;
