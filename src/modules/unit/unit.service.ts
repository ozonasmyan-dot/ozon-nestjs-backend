import { Injectable } from "@nestjs/common";
import { OrderRepository } from "@/modules/order/order.repository";
import { TransactionRepository } from "@/modules/transaction/transaction.repository";
import { groupTransactionsByPostingNumber } from "@/shared/utils/transaction.utils";
import { AggregateUnitDto } from "./dto/aggregate-unit.dto";
import { UnitEntity } from "./entities/unit.entity";
import { buildOrderWhere } from "./utils/order-filter.utils";
import { CustomStatus } from "./ts/custom-status.enum";
import { UnitFactory } from "./unit.factory";

@Injectable()
export class UnitService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly unitFactory: UnitFactory,
  ) {}

  async aggregate(dto: AggregateUnitDto): Promise<{
    items: UnitEntity[];
    totals: {
      statuses: Record<string, number>;
      margin: number;
      price: number;
      costPrice: number;
      transactionTotal: number;
    }[];
  }> {
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
    const filteredItems = statuses
      ? items.filter((item) => statuses.includes(item.status))
      : items;

    const totals = filteredItems.reduce(
      (acc, item) => {
        acc.margin += item.margin;
        if (item.status === CustomStatus.Delivered) {
          acc.price += item.price;
          acc.costPrice += item.costPrice;
        }
        acc.transactionTotal += item.transactionTotal;
        acc.statuses[item.status] = (acc.statuses[item.status] ?? 0) + 1;
        return acc;
      },
      {
        statuses: {} as Record<string, number>,
        margin: 0,
        price: 0,
        costPrice: 0,
        transactionTotal: 0,
      },
    );

    return { items: filteredItems, totals: [totals] };
  }

  async aggregateCsv(dto: AggregateUnitDto): Promise<string> {
    const { items } = await this.aggregate(dto);
    const header = [
      "orderNumber",
      "postingNumber",
      "sku",
      "status",
      "price",
      "costPrice",
      "margin",
      "transactionTotal",
      "transactions",
    ];
    const rows = items.map((item) => {
      const txString = item.transactions
        .map((t) => `${t.id}:${t.price}`)
        .join("|");
      return [
        item.orderNumber,
        item.postingNumber,
        item.sku,
        item.status,
        item.price,
        item.costPrice,
        item.margin,
        item.transactionTotal,
        `"${txString}"`,
      ].join(",");
    });
    return [header.join(","), ...rows].join("\n");
  }
}
