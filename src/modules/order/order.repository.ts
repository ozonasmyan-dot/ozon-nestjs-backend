import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateDto } from './dto/create.dto';
import { Prisma, Order } from '@prisma/client';

@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  count(): Promise<number> {
    return this.prisma.order.count();
  }

  findAll(where: Prisma.OrderWhereInput = {}): Promise<Order[]> {
    return this.prisma.order.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  upsert(data: CreateDto): Promise<Order> {
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
