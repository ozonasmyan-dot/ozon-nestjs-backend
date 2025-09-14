import { Prisma } from '@prisma/client';
import { AggregateUnitDto } from '../dto/aggregate-unit.dto';

const DIRECT_FILTERS: (keyof AggregateUnitDto)[] = ['postingNumber', 'sku'];

export const buildOrderWhere = (
  dto: AggregateUnitDto,
): Prisma.OrderWhereInput => {
  const where = DIRECT_FILTERS.reduce((acc, key) => {
    const value = dto[key];
    if (value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {} as Prisma.OrderWhereInput);

  const createdAt = buildCreatedAtFilter(dto.from, dto.to);
  if (createdAt) {
    where.createdAt = createdAt;
  }

  return where;
};

export const buildCreatedAtFilter = (
  from?: string,
  to?: string,
): Prisma.DateTimeFilter | undefined => {
  if (!from && !to) {
    return undefined;
  }

  const filter: Prisma.DateTimeFilter = {};

  if (from) {
    const fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);
    filter.gte = fromDate;
  }

  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    filter.lte = toDate;
  }

  return filter;
};
