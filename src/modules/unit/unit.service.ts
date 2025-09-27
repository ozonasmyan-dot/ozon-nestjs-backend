import {Injectable} from "@nestjs/common";
import dayjs from "dayjs";
import {OrderRepository} from "@/modules/order/order.repository";
import {TransactionRepository} from "@/modules/transaction/transaction.repository";
import {groupTransactionsByPostingNumber} from "@/shared/utils/transaction.utils";
import {AggregateUnitDto} from "./dto/aggregate-unit.dto";
import {UnitEntity} from "./entities/unit.entity";
import {buildOrderWhere} from "./utils/order-filter.utils";
import {UnitFactory} from "./unit.factory";
import {AdvertisingRepository} from "@/modules/advertising/advertising.repository";
import {money} from "@/shared/utils/money.utils";

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

        const skuMonthCounts = new Map<
            string,
            { sku: string; month: string; count: number }
        >();
        const skus = new Set<string>();
        let minMonthStart: dayjs.Dayjs | null = null;
        let maxMonthEnd: dayjs.Dayjs | null = null;

        orders.forEach((order) => {
            const orderDate = dayjs(order.createdAt);
            const sku = order.sku?.trim();
            if (!orderDate.isValid() || !sku) {
                return;
            }

            const startOfMonth = orderDate.startOf("month");
            const endOfMonth = orderDate.endOf("month");

            if (!minMonthStart || startOfMonth.isBefore(minMonthStart)) {
                minMonthStart = startOfMonth;
            }
            if (!maxMonthEnd || endOfMonth.isAfter(maxMonthEnd)) {
                maxMonthEnd = endOfMonth;
            }

            const month = orderDate.format("YYYY-MM");
            const key = `${sku}_${month}`;
            const current = skuMonthCounts.get(key) ?? {
                sku,
                month,
                count: 0,
            };
            current.count += 1;
            skuMonthCounts.set(key, current);
            skus.add(sku);
        });

        const advertisingTotals = new Map<string, number>();
        if (skus.size && minMonthStart && maxMonthEnd) {
            const ads = await this.advertisingRepository.findBySkusAndDateRange(
                Array.from(skus),
                minMonthStart.format("YYYY-MM-DD"),
                maxMonthEnd.format("YYYY-MM-DD"),
            );

            ads.forEach((ad) => {
                const adDate = dayjs(ad.date);
                const sku = ad.sku?.trim();
                if (!adDate.isValid() || !sku) {
                    return;
                }
                const month = adDate.format("YYYY-MM");
                const key = `${sku}_${month}`;
                advertisingTotals.set(
                    key,
                    (advertisingTotals.get(key) ?? 0) + ad.moneySpent,
                );
            });
        }

        const advertisingPerUnitByKey = new Map<string, number>();
        skuMonthCounts.forEach((value, key) => {
            const totalAdvertisingDecimal = money(
                advertisingTotals.get(key) ?? 0,
            );
            const perUnitDecimal =
                value.count > 0
                    ? totalAdvertisingDecimal
                          .div(value.count)
                          .toDecimalPlaces(2)
                    : money(0);

            advertisingPerUnitByKey.set(key, perUnitDecimal.toNumber());
        });

        const items = orders.map((order) => {
            const numbers = [order.postingNumber, order.orderNumber];
            const orderTransactions = numbers.flatMap(
                (num) => byNumber.get(num) ?? [],
            );
            const month = dayjs(order.createdAt).format("YYYY-MM");
            const sku = order.sku?.trim();
            const key = sku ? `${sku}_${month}` : null;
            const advertisingPerUnit = key
                ? advertisingPerUnitByKey.get(key) ?? 0
                : 0;

            return this.unitFactory.createUnit(order, orderTransactions, {
                advertisingPerUnit,
            });
        });

        const statuses = dto.status
            ?.split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        return statuses
            ? items.filter((item) => statuses.includes(item.status))
            : items;
    }
}
