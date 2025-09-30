import {Injectable} from "@nestjs/common";
import {OrderRepository} from "@/modules/order/order.repository";
import {TransactionRepository} from "@/modules/transaction/transaction.repository";
import {AdvertisingRepository} from "@/modules/advertising/advertising.repository";
import {UnitEntity} from "@/modules/unit/entities/unit.entity";
import dayjs from "dayjs";
import Decimal from "decimal.js";

@Injectable()
export class UnitService {
    constructor(
        private readonly orderRepository: OrderRepository,
        private readonly transactionRepository: TransactionRepository,
        private readonly advertisingRepository: AdvertisingRepository,
    ) {
    }

    async aggregate(): Promise<any> {
        const allMonthlySpend = await this.advertisingRepository.getAllMonthlySpend();
        const allMonthlyOrders = await this.orderRepository.getAllMonthlyOrders();
        const orders = await this.orderRepository.findAll();
        const postingNumbers = Array.from(new Set(
            orders
                .flatMap((o) => [o.postingNumber, o.orderNumber])
                .filter((n): n is string => Boolean(n)),
        ));
        const transactions = await this.transactionRepository.findByPostingNumbers(postingNumbers);
        const groupedTransactions = transactions.reduce((acc, item) => {
            const key = item.postingNumber;

            if (!acc[key]) {
                acc[key] = [];
            }

            acc[key].push(item);

            return acc;
        }, {});

        return orders.map((order) => {
            const orderMountKey = dayjs(order.createdAt).format('MM/YY');
            let advertisingPerUnit: Decimal = new Decimal(0);

            const ordersCount = allMonthlyOrders[orderMountKey]?.[order.sku] ?? 0;
            const adMoneySpend = allMonthlySpend[orderMountKey]?.[order.sku] ?? 0;

            if (ordersCount > 0) {
                advertisingPerUnit = new Decimal(adMoneySpend).div(new Decimal(ordersCount));
            }

            return new UnitEntity({
                ...order,
                advertisingPerUnit: advertisingPerUnit.toDecimalPlaces(2).toNumber(),
                transactions: [
                    ...(groupedTransactions[order.postingNumber] || []),
                    ...(groupedTransactions[order.orderNumber] || [])
                ]
            });
        });
    }
}
