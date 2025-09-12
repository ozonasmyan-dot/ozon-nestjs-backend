import { Injectable } from "@nestjs/common";
import { CreateOrderDto } from "./dto/create-order.dto";
import { GetPostingsDto } from "@/api/seller/dto/get-postings.dto";
import { PostingApiService } from "@/api/seller/posting.service";
import { OrderRepository } from "./order.repository";
import { TransactionRepository } from "@/modules/transaction/transaction.repository";
import { Order, Transaction } from "@prisma/client";

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

  async aggregate(): Promise<
    (Order & { transactionTotal: number; transactions: Transaction[] })[]
  > {
    const [orders, transactions] = await Promise.all([
      this.orderRepository.findAll(),
      this.transactionRepository.findAll(),
    ]);

    const byNumber = new Map<string, Transaction[]>();

    transactions.forEach((tx) => {
      if (tx.postingNumber) {
        const arr = byNumber.get(tx.postingNumber) ?? [];
        arr.push(tx);
        byNumber.set(tx.postingNumber, arr);
      }
    });

    return orders.map((order) => {
      const txsByPosting = byNumber.get(order.postingNumber) ?? [];
      const txsByOrder = byNumber.get(order.orderNumber) ?? [];
      const merged = [...txsByPosting, ...txsByOrder];
      const uniqueTxs = [
        ...new Map(merged.map((t) => [t.id, t])).values(),
      ];
      const transactionTotal = uniqueTxs.reduce((sum, t) => sum + t.price, 0);
      return {
        ...order,
        transactionTotal,
        transactions: uniqueTxs,
      };
    });
  }
}
