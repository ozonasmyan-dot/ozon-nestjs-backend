import { Injectable } from "@nestjs/common";
import { GetPostingsDto } from "@/api/seller/dto/get-postings.dto";
import { PostingApiService } from "@/api/seller/posting.service";
import { OrderRepository } from "./order.repository";
import { OrderEntity } from "./entities/order.entity";

@Injectable()
export class OrderService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly postingApi: PostingApiService,
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

      const data = new OrderEntity({
        product: product.offer_id ?? '',
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
      });

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

    const order = new OrderEntity(lastOrder);

    const dto: GetPostingsDto = {
      filter: {
        since: order.createdAt.toISOString(),
        to: new Date().toISOString(),
      },
      limit: 1000,
    };

    return this.saveOrders(dto);
  }

}
