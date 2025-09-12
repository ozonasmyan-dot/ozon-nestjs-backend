import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { UpdateOrderDto } from "./dto/update-order.dto";
import { GetPostingsDto } from "@/api/seller/dto/get-postings.dto";
import { PostingApiService } from "@/api/seller/posting.service";

@Injectable()
export class OrderService {
  constructor(
    private prisma: PrismaService,
    private readonly postingApi: PostingApiService,
  ) {}

  create(data: CreateOrderDto) {
    return this.prisma.order.create({ data });
  }

  findAll() {
    return this.prisma.order.findMany();
  }

  findOne(id: string) {
    return this.prisma.order.findUnique({ where: { id } });
  }

  update(id: string, data: UpdateOrderDto) {
    return this.prisma.order.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.order.delete({ where: { id } });
  }

  async savePostings(dto: GetPostingsDto) {
    const limit = dto.limit ?? 100;
    let offset = dto.offset ?? 0;
    let total = 0;

    while (true) {
      const { result } = await this.postingApi.list({
        ...dto,
        limit,
        offset,
      });
      const postings = result?.postings ?? [];

      if (postings.length === 0) {
        break;
      }

      const operations = postings.map((posting: any) => {
        const product = posting.products?.[0] ?? {};
        const analytics = posting.analytics_data ?? {};
        const financial = posting.financial_data?.products?.[0] ?? {};

        const data: CreateOrderDto = {
          product: product.name ?? "",
          orderId: String(posting.order_id ?? ""),
          orderNumber: posting.order_number ?? "",
          postingNumber: posting.posting_number ?? "",
          status: posting.status ?? "",
          createdAt: new Date(posting.created_at ?? Date.now()),
          inProcessAt: new Date(posting.in_process_at ?? Date.now()),
          deliveryType: analytics.delivery_type ?? "",
          city: analytics.city ?? undefined,
          isPremium: analytics.is_premium ?? false,
          paymentTypeGroupName: analytics.payment_type_group_name ?? "",
          warehouseId: String(analytics.warehouse_id ?? ""),
          warehouseName: analytics.warehouse_name ?? "",
          sku: String(product.sku ?? ""),
          oldPrice: Number(financial.old_price ?? product.old_price ?? 0),
          price: Number(financial.price ?? product.price ?? 0),
          currencyCode: financial.currency_code ?? "RUB",
          clusterFrom: analytics.cluster_from ?? "",
          clusterTo: analytics.cluster_to ?? "",
        };

        return this.prisma.order.upsert({
          where: { postingNumber: data.postingNumber },
          create: data,
          update: data,
        });
      });

      await this.prisma.$transaction(operations);
      total += postings.length;

      if (postings.length < limit) {
        break;
      }
      offset += limit;
    }

    return total;
  }
}
