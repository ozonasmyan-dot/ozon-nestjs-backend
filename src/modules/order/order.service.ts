import { Injectable } from "@nestjs/common";
import { CreateOrderDto } from "./dto/create-order.dto";
import { GetPostingsDto } from "@/api/seller/dto/get-postings.dto";
import { PostingApiService } from "@/api/seller/posting.service";
import { OrderRepository } from "./order.repository";
import { TransactionRepository } from "@/modules/transaction/transaction.repository";
import { Order, Transaction, Prisma } from "@prisma/client";
import { economy } from "./economy";
import { AggregateOrderDto } from "./dto/aggregate-order.dto";

@Injectable()
export class OrderService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly postingApi: PostingApiService,
    private readonly transactionRepository: TransactionRepository,
  ) {}

  async sync(dto: GetPostingsDto) {
    const ordersCount = await this.orderRepository.count();
    if (ordersCount === 0) {
      return this.saveOrders(dto);
    }
    return this.updateNotDelivered();
  }

  async saveOrders(dto: GetPostingsDto) {
    const result = await this.postingApi.list(dto);
    const postings = result ?? [];

    const operations = postings.map((posting: any) => {
      const product = posting.products?.[0] ?? {};
      const financial = posting.financial_data?.products?.[0] ?? {};

      const data: CreateOrderDto = {
        product: product.name ?? "",
        orderId: String(posting.order_id ?? ""),
        orderNumber: posting.order_number ?? "",
        postingNumber: posting.posting_number ?? "",
        status: posting.status ?? "",
        createdAt: new Date(posting.created_at ?? Date.now()),
        inProcessAt: new Date(posting.in_process_at ?? Date.now()),
        sku: String(product.sku ?? ""),
        oldPrice: Number(financial.old_price ?? product.old_price ?? 0),
        price: Number(financial.price ?? product.price ?? 0),
        currencyCode: financial.currency_code ?? "RUB",
      };

      return this.orderRepository.upsert(data);
    });

    await this.orderRepository.transaction(operations as any);
    return postings.length;
  }

  async updateNotDelivered() {
    const lastOrder = await this.orderRepository.findLastNotDelivered();

    if (!lastOrder) {
      return 0;
    }

    const dto: GetPostingsDto = {
      filter: {
        since: lastOrder.createdAt.toISOString(),
        to: new Date().toISOString(),
      },
      limit: 1000,
    };

    return this.saveOrders(dto);
  }

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

  async aggregate(dto: AggregateOrderDto): Promise<{
    items: (Order & {
      transactionTotal: number;
      transactions: Transaction[];
      costPrice: number;
      totalServices: number;
      margin: number;
    })[];
    totals: {
      statuses: Record<string, number>;
      margin: number;
      price: number;
      transactionTotal: number;
    }[];
  }> {
    const where: Prisma.OrderWhereInput = {};
    if (dto.postingNumber) {
      where.postingNumber = dto.postingNumber;
    }
    if (dto.sku) {
      where.sku = dto.sku;
    }
    if (dto.from || dto.to) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (dto.from) {
        const from = new Date(dto.from);
        from.setHours(0, 0, 0, 0);
        createdAt.gte = from;
      }
      if (dto.to) {
        const to = new Date(dto.to);
        to.setHours(23, 59, 59, 999);
        createdAt.lte = to;
      }
      where.createdAt = createdAt;
    }

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
      const services = uniqueTxs.map((t) => ({
        name: t.operationServiceName,
        price: t.price,
      }));
      const economyResult = economy({
        price: order.price,
        services,
        statusOzon: order.status,
        product: order.sku,
      });
      return {
        ...order,
        ...economyResult,
        transactionTotal,
        transactions: uniqueTxs,
      };
    });

    const filteredItems = dto.status
      ? items.filter((item) => item.status === dto.status)
      : items;

    const totals = filteredItems.reduce(
      (acc, item) => {
        acc.margin += item.margin;
        acc.price += item.price;
        acc.transactionTotal += item.transactionTotal;
        acc.statuses[item.status] = (acc.statuses[item.status] ?? 0) + 1;
        return acc;
      },
      {
        statuses: {} as Record<string, number>,
        margin: 0,
        price: 0,
        transactionTotal: 0,
      },
    );

    return { items: filteredItems, totals: [totals] };
  }
}
