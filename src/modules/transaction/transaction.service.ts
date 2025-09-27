import { Injectable } from '@nestjs/common';
import { TransactionRepository } from './transaction.repository';
import { TransactionApiService } from '@/api/seller/transaction.service';
import { ADS_EXCLUDED_OPERATION_TYPES } from '@/shared/constants/transaction-types.constants';

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
    const from = last?.date ?? new Date('2024-10-01T00:00:00.000Z');
    const to = new Date();

    const operations = await this.transactionApi.list({
      filter: {
        date: {
          from: from.toISOString(),
          to: to.toISOString(),
        },
      },
    });

    const filtered = operations.filter(
      (op) => !ADS_EXCLUDED_OPERATION_TYPES.has(op.name),
    );

    if (!filtered.length) {
      return 0;
    }

    const queries = filtered.map((op) => this.repository.create(op));

    await this.repository.transaction(queries);

    return this.repository.findAll();
  }

  async getNames () {
    return (
        await this.repository.findAll({
          distinct: ['name'],
          select: { name: true },
        })
    ).map((item) => item.name);
  }
}
