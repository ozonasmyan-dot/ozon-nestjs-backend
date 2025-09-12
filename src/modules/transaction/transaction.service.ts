import { Injectable } from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionRepository } from './transaction.repository';
import { TransactionApiService } from '@/api/seller/transaction.service';

@Injectable()
export class TransactionService {
  constructor(
    private readonly repository: TransactionRepository,
    private readonly transactionApi: TransactionApiService,
  ) {}

  create(data: CreateTransactionDto) {
    return this.repository.create(data);
  }

  findAll() {
    return this.repository.findAll();
  }

  findOne(id: string) {
    return this.repository.findById(id);
  }

  update(id: string, data: UpdateTransactionDto) {
    return this.repository.update(id, data);
  }

  remove(id: string) {
    return this.repository.remove(id);
  }

  async sync() {
    const count = await this.repository.count();
    const last = count === 0 ? null : await this.repository.findLast();
    let from = last?.date ?? new Date('2024-10-01T00:00:00.000Z');
    const now = new Date();
    let total = 0;

    while (from < now) {
      const to = new Date(from);
      to.setMonth(to.getMonth() + 1);
      if (to > now) {
        to.setTime(now.getTime());
      }

      const transactions = await this.transactionApi.list({
        filter: {
          date: {
            from: from.toISOString(),
            to: to.toISOString(),
          },
        },
      });

      if (transactions.length) {
        const operations = transactions.flatMap((t: any) => {
          const base: CreateTransactionDto = {
            operationType: t.operation_type ?? '',
            operationTypeName: t.operation_type_name ?? '',
            operationServiceName: t.operation_service_name ?? '',
            date: new Date(t.transaction_date ?? t.date ?? Date.now()),
            type: t.type ?? '',
            postingNumber: t.posting_number ?? '',
            price: Number(t.price ?? t.amount ?? 0),
          };

          const ops: any[] = [this.repository.create(base)];

          const services = Array.isArray(t.services) ? t.services : [];
          for (const s of services) {
            const serviceData: CreateTransactionDto = {
              ...base,
              operationServiceName: s.name ?? '',
              price: Number(s.price ?? 0),
            };
            ops.push(this.repository.create(serviceData));
          }

          const saleCommission = Number(t.sale_commission ?? 0);
          if (saleCommission !== 0) {
            const commissionData: CreateTransactionDto = {
              ...base,
              operationServiceName: 'sale_commission',
              price: saleCommission,
            };
            ops.push(this.repository.create(commissionData));
          }

          return ops;
        });

        await this.repository.transaction(operations as any);
        total += operations.length;
      }

      from = to;
    }

    return total;
  }
}
