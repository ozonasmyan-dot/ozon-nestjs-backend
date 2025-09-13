import { Injectable } from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionRepository } from './transaction.repository';
import { TransactionApiService } from '@/api/seller/transaction.service';
import * as dayjs from 'dayjs';

@Injectable()
export class TransactionService {
  constructor(
    private readonly repository: TransactionRepository,
    private readonly transactionApi: TransactionApiService,
  ) {}

  async sync() {
    const count = await this.repository.count();
    const last = count === 0 ? null : await this.repository.findLast();

    // если нет записей, стартуем с октября 2024
    let from = last?.date ?? new Date('2024-10-01T00:00:00.000Z');
    const now = new Date();

    let total = 0;

    while (from < now) {
      // конец месяца от текущего from
      let to = dayjs(from).add(1, 'month').toDate();
      if (to > now) {
        to = now;
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
        const operations: CreateTransactionDto[] = [];

        for (const t of transactions) {
          const services = Array.isArray(t.services) ? t.services : [];

          for (const s of services) {
            operations.push({
              operationType: t.operation_type ?? '',
              operationTypeName: t.operation_type_name ?? '',
              operationServiceName: s.name ?? '',
              date: new Date(t.transaction_date ?? t.date ?? Date.now()),
              type: t.type ?? '',
              postingNumber: t.posting?.posting_number ?? '',
              price: Number(s.price ?? 0),
            });
          }

          const saleCommission = Number(t.sale_commission ?? 0);
          if (saleCommission !== 0) {
            operations.push({
              operationType: t.operation_type ?? '',
              operationTypeName: t.operation_type_name ?? '',
              operationServiceName: 'SaleCommission',
              date: new Date(t.transaction_date ?? t.date ?? Date.now()),
              type: t.type ?? '',
              postingNumber: t.posting?.posting_number ?? '',
              price: saleCommission,
            });
          }
        }

        if (operations.length) {
          const queries = operations.map((op) =>
              this.repository.create(op) // здесь должен вернуться Prisma Promise
          );

          await this.repository.transaction(queries);
          total += operations.length;
        }
      }

      from = dayjs(to).add(1, "day").toDate();
    }

    return total;
  }
}
