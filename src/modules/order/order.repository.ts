import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Prisma, Order } from '@prisma/client';

export interface OrderCountDateRange {
  key: string;
  sku: string;
  dateFrom: string;
  dateTo: string;
}

@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  count(): Promise<number> {
    return this.prisma.order.count();
  }

  findAll(where: Prisma.OrderWhereInput = {}): Promise<Order[]> {
    return this.prisma.order.findMany({ where });
  }

  async countBySkuAndDateRanges(
    ranges: OrderCountDateRange[],
  ): Promise<Map<string, number>> {
    if (!ranges.length) {
      return new Map();
    }

    const counts = new Map<string, number>();

    const queries = ranges.map((range) => {
      if (!range.sku || !range.key) {
        return Promise.resolve();
      }

      const from = dayjs(range.dateFrom);
      const to = dayjs(range.dateTo);

      if (!from.isValid() || !to.isValid()) {
        return Promise.resolve();
      }

      return this.prisma.order
        .count({
          where: {
            sku: range.sku,
            createdAt: {
              gte: from.toDate(),
              lt: to.toDate(),
            },
          },
        })
        .then((count) => {
          counts.set(range.key, count);
        });
    });

    await Promise.all(queries);

    return counts;
  }

  upsert(data: CreateOrderDto): Promise<Order> {
    return this.prisma.order.upsert({
      where: { postingNumber: data.postingNumber },
      create: data,
      update: data,
    });
  }

  transaction<T>(operations: Prisma.PrismaPromise<T>[]) {
    return this.prisma.$transaction(operations);
  }

  findLastNotDelivered(): Promise<Order | null> {
    return this.prisma.order.findFirst({
      where: { status: { notIn: ['delivered', 'cancelled'] } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
