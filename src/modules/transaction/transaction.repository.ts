import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

@Injectable()
export class TransactionRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateTransactionDto) {
    return this.prisma.transaction.create({ data });
  }

  findAll() {
    return this.prisma.transaction.findMany();
  }

  findById(id: string) {
    return this.prisma.transaction.findUnique({ where: { id } });
  }

  update(id: string, data: UpdateTransactionDto) {
    return this.prisma.transaction.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.transaction.delete({ where: { id } });
  }
}
