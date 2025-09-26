import Decimal from 'decimal.js';

export const money = (
    value: string | number | null | undefined,
    places = 2,
    rounding = Decimal.ROUND_HALF_UP
): Decimal =>
    new Decimal(
        String(value ?? 0)
            .replace(/\s/g, '')
            .replace(/,/g, '.')
    ).toDecimalPlaces(places, rounding);