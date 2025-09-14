import {Injectable} from '@nestjs/common';
import {TransactionRepository} from './transaction.repository';
import {TransactionApiService} from '@/api/seller/transaction.service';
import {TransactionEntity} from './entities/transaction.entity';
import dayjs from "dayjs";
import {TRANSACTION_TYPES_ADS} from "@/shared/constants/transaction-types.constants";

@Injectable()
export class TransactionService {
    constructor(
        private readonly repository: TransactionRepository,
        private readonly transactionApi: TransactionApiService,
    ) {
    }

    async sync() {
        const count = await this.repository.count();
        const last = count === 0 ? null : await this.repository.findLast();
        const operations: TransactionEntity[] = [];
        let total = 0;

        // если нет записей, стартуем с октября 2024
        const from = last?.date ?? new Date('2024-10-01T00:00:00.000Z');
        const to = new Date();

        const transactions = await this.transactionApi.list({
            filter: {
                date: {
                    from: from.toISOString(),
                    to: to.toISOString(),
                },
            },
        });

        if (transactions.length) {
            for (const t of transactions) {
                operations.push(
                    new TransactionEntity({
                        operationId: t.operationId,
                        name: t.name,
                        date: t.date,
                        postingNumber: t.postingNumber,
                        price: t.price,
                    })
                )
            }

            if (operations.length) {
                const queries = operations.map((op) =>
                    this.repository.create(op)
                );

                await this.repository.transaction(queries);
                total += operations.length;
            }
        }

        return total;
    }
}
