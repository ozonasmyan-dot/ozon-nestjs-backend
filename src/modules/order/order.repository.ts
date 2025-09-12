import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Prisma, Order } from '@prisma/client';

@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  count(): Promise<number> {
    return this.prisma.order.count();
  }

  findAll(): Promise<Order[]> {
    return this.prisma.order.findMany();
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
