import { Injectable } from '@nestjs/common';
import { OrderRepository } from '@/modules/order/order.repository';
import { TransactionRepository } from '@/modules/transaction/transaction.repository';
import { groupTransactionsByPostingNumber } from '@/shared/utils/transaction.utils';
import { AggregateUnitDto } from './dto/aggregate-unit.dto';
import { UnitEntity } from './entities/unit.entity';
import { buildOrderWhere } from './utils/order-filter.utils';
import { UnitFactory } from './unit.factory';
import dayjs from 'dayjs';
import { AdvertisingRepository } from '@/modules/advertising/advertising.repository';
import { Order } from '@prisma/client';
import { toDecimalUtils } from '@/shared/utils/to-decimal.utils';

@Injectable()
export class UnitService {
    constructor(
        private readonly orderRepository: OrderRepository,
        private readonly transactionRepository: TransactionRepository,
        private readonly unitFactory: UnitFactory,
        private readonly advertisingRepository: AdvertisingRepository,
    ) {
    }

    async aggregate(dto: AggregateUnitDto): Promise<UnitEntity[]> {
        const where = buildOrderWhere(dto);

        const orders = await this.orderRepository.findAll(where);
        if (!orders.length) {
            return [];
        }
        const postingNumbers = Array.from(
            new Set(
                orders
                    .flatMap((o) => [o.postingNumber, o.orderNumber])
                    .filter((n): n is string => Boolean(n)),
            ),
        );
        const transactions = await this.transactionRepository.findByPostingNumbers(
            postingNumbers,
        );

        const byNumber = groupTransactionsByPostingNumber(transactions);
        const advertisingByMonth = await this.getAdvertisingExpensesPerUnit(orders);

        const items = orders.map((order) => {
            const numbers = [order.postingNumber, order.orderNumber];
            const orderTransactions = numbers.flatMap(
                (num) => byNumber.get(num) ?? [],
            );
            const monthKey = dayjs(order.createdAt).format('YYYY-MM');
            const advertisingExpense = advertisingByMonth.get(monthKey) ?? 0;
            return this.unitFactory.createUnit(order, orderTransactions, advertisingExpense);
        });

        const statuses = dto.status
            ?.split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        return statuses
            ? items.filter((item) => statuses.includes(item.status))
            : items;
    }

    async aggregateCsv(dto: AggregateUnitDto): Promise<string> {
        const items = await this.aggregate(dto);
        const header = [
            "product",
            "postingNumber",
            "createdAt",
            "status",
            "margin",
            "costPrice",
            "totalServices",
            "price",
            "advertisingExpense",
        ];
        const rows = items.map((item) => {
            return [
                item.product,
                item.postingNumber,
                dayjs(item.createdAt).format("YYYY-MM"),
                item.status,
                item.margin,
                item.costPrice,
                item.totalServices,
                item.price,
                item.advertisingExpense,
            ].join(",");
        });
        return [header.join(","), ...rows].join("\n");
    }

    private async getAdvertisingExpensesPerUnit(orders: Order[]): Promise<Map<string, number>> {
        const months = new Map<string, {
            monthStart: Date;
            monthEnd: Date;
            monthStartString: string;
            monthEndString: string;
        }>();

        orders.forEach((order) => {
            const createdAt = dayjs(order.createdAt);
            const monthKey = createdAt.format('YYYY-MM');
            if (months.has(monthKey)) {
                return;
            }

            const startOfMonth = createdAt.startOf('month');
            const endOfMonth = createdAt.endOf('month');

            months.set(monthKey, {
                monthStart: startOfMonth.toDate(),
                monthEnd: endOfMonth.toDate(),
                monthStartString: startOfMonth.format('YYYY-MM-DD'),
                monthEndString: endOfMonth.format('YYYY-MM-DD'),
            });
        });

        if (!months.size) {
            return new Map();
        }

        const advertisingPairs = await Promise.all(
            Array.from(months.entries()).map(async ([monthKey, range]) => {
                const [ordersCount, advertisingSum] = await Promise.all([
                    this.orderRepository.countByCreatedAtRange(range.monthStart, range.monthEnd),
                    this.advertisingRepository.sumMoneySpentByDateRange(
                        range.monthStartString,
                        range.monthEndString,
                    ),
                ]);

                if (!ordersCount) {
                    return [monthKey, 0] as const;
                }

                const perUnit = toDecimalUtils(advertisingSum)
                    .dividedBy(ordersCount)
                    .toDecimalPlaces(2)
                    .toNumber();

                return [monthKey, perUnit] as const;
            }),
        );

        return new Map(advertisingPairs);
    }
}
