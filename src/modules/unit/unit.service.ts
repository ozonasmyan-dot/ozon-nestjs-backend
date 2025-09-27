import {Injectable} from "@nestjs/common";
import {OrderRepository} from "@/modules/order/order.repository";
import {TransactionRepository} from "@/modules/transaction/transaction.repository";
import {groupTransactionsByPostingNumber} from "@/shared/utils/transaction.utils";
import {AggregateUnitDto} from "./dto/aggregate-unit.dto";
import {UnitEntity} from "./entities/unit.entity";
import {buildOrderWhere} from "./utils/order-filter.utils";
import {UnitFactory} from "./unit.factory";

@Injectable()
export class UnitService {
    constructor(
        private readonly orderRepository: OrderRepository,
        private readonly transactionRepository: TransactionRepository,
        private readonly unitFactory: UnitFactory,
    ) {
    }

    async aggregate(dto: AggregateUnitDto): Promise<UnitEntity[]> {
        const where = buildOrderWhere(dto);

        const orders = await this.orderRepository.findAll(where);
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
            return this.unitFactory.createUnit(order, orderTransactions);
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
