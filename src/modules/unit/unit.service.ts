import { Injectable } from "@nestjs/common";
import { OrderRepository } from "@/modules/order/order.repository";
import { TransactionRepository } from "@/modules/transaction/transaction.repository";
import { Transaction } from "@prisma/client";
import { AggregateUnitDto } from "./dto/aggregate-unit.dto";
import { UnitEntity } from "./entities/unit.entity";
import { buildOrderWhere } from "./utils/order-filter.utils";
import { CustomStatus } from "./ts/custom-status.enum";

@Injectable()
export class UnitService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly transactionRepository: TransactionRepository,
  ) {}

  private groupTransactionsByPostingNumber(
    transactions: Transaction[],
  ): Map<string, Transaction[]> {
    return transactions.reduce((map, tx) => {
      if (!tx.postingNumber) {
        return map;
      }
      const list = map.get(tx.postingNumber) ?? [];
      list.push(tx);
      map.set(tx.postingNumber, list);
      return map;
    }, new Map<string, Transaction[]>());
  }

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

    const [orders, transactions] = await Promise.all([
      this.orderRepository.findAll(where),
      this.transactionRepository.findAll(),
    ]);

    const byNumber = this.groupTransactionsByPostingNumber(transactions);

    const items = orders.map((order) => {
      const numbers = [order.postingNumber, order.orderNumber];
      const orderTransactions = numbers.flatMap(
        (num) => byNumber.get(num) ?? [],
      );
      const uniqueTxs = [
        ...new Map(orderTransactions.map((t) => [t.id, t])).values(),
      ];
      const transactionTotal = uniqueTxs.reduce((sum, t) => sum + t.price, 0);
      return new UnitEntity({
        ...order,
        transactionTotal,
        transactions: uniqueTxs,
      });
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
    ];
    const rows = items.map((item) =>
      [
        item.orderNumber,
        item.postingNumber,
        item.sku,
        item.status,
        item.price,
        item.costPrice,
        item.margin,
        item.transactionTotal,
      ].join(","),
    );
    return [header.join(","), ...rows].join("\n");
  }
}
