import {Injectable} from '@nestjs/common';
import {PrismaService} from '@/prisma/prisma.service';
import {CreateDto} from './dto/create.dto';
import {Prisma, Order} from '@prisma/client';
import dayjs from "dayjs";

@Injectable()
export class OrderRepository {
    constructor(private readonly prisma: PrismaService) {
    }

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
            where: {postingNumber: data.postingNumber},
            create: data,
            update: data,
        });
    }

    transaction<T>(operations: Prisma.PrismaPromise<T>[]) {
        return this.prisma.$transaction(operations);
    }

    findLastNotDelivered(): Promise<Order | null> {
        return this.prisma.order.findFirst({
            where: {status: {notIn: ['delivered', 'cancelled']}},
            orderBy: {createdAt: 'asc'},
        });
    }

    async getAllMonthlyOrders() {
        const items = await this.prisma.order.findMany({
            select: {
                sku: true,
                createdAt: true,
            },
        });

        return items.reduce((acc, item) => {
            const monthKey = dayjs(item.createdAt).format('MM/YY');

            if (!acc[monthKey]) acc[monthKey] = {};
            acc[monthKey][item.sku] = (acc[monthKey][item.sku] || 0) + 1;

            return acc;
        }, {} as Record<string, Record<string, number>>);
    }
}
