import {Injectable} from '@nestjs/common';
import {PrismaService} from '@/prisma/prisma.service';
import {CreateOrderDto} from './dto/create-order.dto';
import {GetPostingsDto} from '@/api/seller/dto/get-postings.dto';
import {PostingApiService} from '@/api/seller/posting.service';

@Injectable()
export class OrderService {
    constructor(
        private prisma: PrismaService,
        private readonly postingApi: PostingApiService,
    ) {
    }

    async saveOrders(dto: GetPostingsDto) {
        const result = await this.postingApi.list(dto);
        const postings = result ?? [];

        const operations = postings.map((posting: any) => {
            const product = posting.products?.[0] ?? {};
            const financial = posting.financial_data?.products?.[0] ?? {};

            const data: CreateOrderDto = {
                product: product.name ?? '',
                orderId: String(posting.order_id ?? ''),
                orderNumber: posting.order_number ?? '',
                postingNumber: posting.posting_number ?? '',
                status: posting.status ?? '',
                createdAt: new Date(posting.created_at ?? Date.now()),
                inProcessAt: new Date(posting.in_process_at ?? Date.now()),
                sku: String(product.sku ?? ''),
                oldPrice: Number(financial.old_price ?? product.old_price ?? 0),
                price: Number(financial.price ?? product.price ?? 0),
                currencyCode: financial.currency_code ?? 'RUB',
            };

            return this.prisma.order.upsert({
                where: {postingNumber: data.postingNumber},
                create: data,
                update: data,
            });
        });

        await this.prisma.$transaction(operations);
        return postings.length;
    }
}
