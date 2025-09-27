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
import {PRODUCTS} from "@/shared/constants/products";

const PRODUCT_ENTRIES = Object.entries(PRODUCTS);

const CANONICAL_SKU_BY_ALIAS = new Map<string, string>();
const ORIGINAL_SKU_BY_CANONICAL = new Map<string, string>();

PRODUCT_ENTRIES.forEach(([key, value]) => {
    const canonical = value.trim();
    CANONICAL_SKU_BY_ALIAS.set(key, canonical);
    CANONICAL_SKU_BY_ALIAS.set(canonical, canonical);
    ORIGINAL_SKU_BY_CANONICAL.set(canonical, key);
});

const trimNullable = (value?: string | null): string | null => {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
};

const normalizeSku = (value?: string | null): string | null => {
    const trimmed = trimNullable(value);
    if (!trimmed) {
        return null;
    }
    return CANONICAL_SKU_BY_ALIAS.get(trimmed) ?? trimmed;
};

const collectSkuVariants = (
    ...values: Array<string | null | undefined>
): string[] => {
    const variants = new Set<string>();
    values.forEach((value) => {
        const trimmed = trimNullable(value);
        if (!trimmed) {
            return;
        }
        variants.add(trimmed);
        const canonical = CANONICAL_SKU_BY_ALIAS.get(trimmed);
        if (canonical) {
            variants.add(canonical);
            const original = ORIGINAL_SKU_BY_CANONICAL.get(canonical);
            if (original) {
                variants.add(original);
            }
        }
    });
    return Array.from(variants);
};

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
        const skusForAdvertising = new Set<string>();
        let minMonthStart: dayjs.Dayjs | null = null;
        let maxMonthEnd: dayjs.Dayjs | null = null;

        orders.forEach((order) => {
            const orderDate = dayjs(order.createdAt);
            const canonicalSku =
                normalizeSku(order.sku) ?? normalizeSku(order.product);
            if (!orderDate.isValid() || !canonicalSku) {
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
            const key = `${canonicalSku}_${month}`;
            const current = skuMonthCounts.get(key) ?? {
                sku: canonicalSku,
                month,
                count: 0,
            };
            current.count += 1;
            skuMonthCounts.set(key, current);
            collectSkuVariants(order.sku, order.product).forEach((variant) =>
                skusForAdvertising.add(variant),
            );
        });

        const advertisingTotals = new Map<string, number>();
        if (skusForAdvertising.size && minMonthStart && maxMonthEnd) {
            const ads = await this.advertisingRepository.findBySkusAndDateRange(
                Array.from(skusForAdvertising),
                minMonthStart.format("YYYY-MM-DD"),
                maxMonthEnd.format("YYYY-MM-DD"),
            );

            ads.forEach((ad) => {
                const adDate = dayjs(ad.date);
                const canonicalSku = normalizeSku(ad.sku);
                if (!adDate.isValid() || !canonicalSku) {
                    return;
                }
                const month = adDate.format("YYYY-MM");
                const key = `${canonicalSku}_${month}`;
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
            const canonicalSku =
                normalizeSku(order.sku) ?? normalizeSku(order.product);
            const key = canonicalSku ? `${canonicalSku}_${month}` : null;
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
