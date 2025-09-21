import {Injectable} from "@nestjs/common";
import {OrderRepository} from "@/modules/order/order.repository";
import {TransactionRepository} from "@/modules/transaction/transaction.repository";
import {groupTransactionsByPostingNumber} from "@/shared/utils/transaction.utils";
import {AggregateUnitDto} from "./dto/aggregate-unit.dto";
import {UnitEntity} from "./entities/unit.entity";
import {buildOrderWhere} from "./utils/order-filter.utils";
import {UnitFactory} from "./unit.factory";
import dayjs from "dayjs";
import Decimal from "@/shared/utils/decimal";
import {
    AdvertisingDateRange,
    AdvertisingRepository,
} from "@/modules/advertising/advertising.repository";
import {OrderEntity} from "@/modules/order/entities/order.entity";

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
        const advertisingExpenses = await this.loadAdvertisingExpenses(orders);
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

        const items = orders.map((order) => {
            const numbers = [order.postingNumber, order.orderNumber];
            const orderTransactions = numbers.flatMap(
                (num) => byNumber.get(num) ?? [],
            );
            const advertisingKey = this.buildAdvertisingKey(order);
            const advertisingExpense = advertisingKey
                ? advertisingExpenses.get(advertisingKey) ?? 0
                : 0;
            return this.unitFactory.createUnit(
                order,
                orderTransactions,
                advertisingExpense,
            );
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
            "transactionTotal",
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
                item.transactionTotal,
                item.price,
                item.advertisingExpense,
            ].join(",");
        });
        return [header.join(","), ...rows].join("\n");
    }

    private async loadAdvertisingExpenses(orders: OrderEntity[]): Promise<Map<string, number>> {
        if (!orders.length) {
            return new Map<string, number>();
        }

        const ranges = this.buildAdvertisingRanges(orders);

        if (!ranges.length) {
            return new Map<string, number>();
        }

        const expenses = await this.advertisingRepository.findBySkuAndDateRanges(ranges);
        const totals = new Map<string, Decimal>();

        for (const expense of expenses) {
            if (!expense.sku || !expense.date) {
                continue;
            }

            const monthKey = dayjs(expense.date).format("YYYY-MM");
            const key = `${expense.sku}-${monthKey}`;
            const current = totals.get(key) ?? new Decimal(0);
            totals.set(key, current.plus(expense.moneySpent));
        }

        const result = new Map<string, number>();
        for (const [key, value] of totals.entries()) {
            result.set(key, value.toDecimalPlaces(2).toNumber());
        }

        return result;
    }

    private buildAdvertisingRanges(orders: OrderEntity[]): AdvertisingDateRange[] {
        const ranges = new Map<string, AdvertisingDateRange>();

        for (const order of orders) {
            const key = this.buildAdvertisingKey(order);

            if (!key || !order.createdAt) {
                continue;
            }

            if (!ranges.has(key)) {
                const period = this.resolveAdvertisingPeriod(order.createdAt);

                if (!period) {
                    continue;
                }

                ranges.set(key, {
                    sku: order.sku,
                    dateFrom: period.dateFrom,
                    dateTo: period.dateTo,
                });
            }
        }

        return Array.from(ranges.values());
    }

    private buildAdvertisingKey(order: OrderEntity): string | undefined {
        if (!order.sku || !order.createdAt) {
            return undefined;
        }

        const date = dayjs(order.createdAt);

        if (!date.isValid()) {
            return undefined;
        }

        return `${order.sku}-${date.format("YYYY-MM")}`;
    }

    private resolveAdvertisingPeriod(date: Date): { dateFrom: string; dateTo: string } | undefined {
        const day = dayjs(date);

        if (!day.isValid()) {
            return undefined;
        }

        const start = day.startOf("month");
        const end = start.add(1, "month");

        return {
            dateFrom: start.format("YYYY-MM-DD"),
            dateTo: end.format("YYYY-MM-DD"),
        };
    }
}
