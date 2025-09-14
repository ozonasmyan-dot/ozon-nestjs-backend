import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { Prisma, Transaction } from '@prisma/client';

@Injectable()
export class TransactionRepository {
  constructor(private readonly prisma: PrismaService) {}

  count() {
    return this.prisma.transaction.count();
  }

  create(data: CreateTransactionDto) {
    const payload = {
      ...data,
      postingNumber: data.postingNumber ?? null,
      sku:
        data.sku === undefined || data.sku === null
          ? null
          : String(data.sku),
    } as const;

    return this.prisma.transaction.upsert({
      where: {
        name_operationId: {
          name: data.name,
          operationId: data.operationId,
        },
      },
      create: payload,
      update: payload,
    });
  }

  findAll() {
    return this.prisma.transaction.findMany();
  }

  groupByPostingNumber() {
    return this.prisma.transaction.groupBy({
      by: ['postingNumber'],
      _sum: { price: true },
    });
  }

  findById(id: string) {
    return this.prisma.transaction.findUnique({ where: { id } });
  }

  findLast(): Promise<Transaction | null> {
    return this.prisma.transaction.findFirst({ orderBy: { date: 'desc' } });
  }

  update(id: string, data: UpdateTransactionDto) {
    return this.prisma.transaction.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.transaction.delete({ where: { id } });
  }

  transaction<T>(operations: Prisma.PrismaPromise<T>[]) {
    return this.prisma.$transaction(operations);
  }
}
