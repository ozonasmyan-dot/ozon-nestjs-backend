import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateAdvertisingDto } from './dto/create-advertising.dto';

@Injectable()
export class AdvertisingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertMany(items: CreateAdvertisingDto[]) {
    if (!items.length) {
      return [];
    }

    const operations = items.map((item) =>
      this.prisma.advertising.upsert({
        where: {
          campaignId_sku_date_type: {
            campaignId: item.campaignId,
            sku: item.sku,
            date: item.date,
            type: item.type,
          },
        },
        create: {
          campaignId: item.campaignId,
          sku: item.sku,
          date: item.date,
          type: item.type,
          clicks: item.clicks,
          toCart: item.toCart,
          avgBid: item.avgBid,
          moneySpent: item.moneySpent,
        },
        update: {
          clicks: item.clicks,
          toCart: item.toCart,
          avgBid: item.avgBid,
          moneySpent: item.moneySpent,
        },
      }),
    );

    return this.prisma.$transaction(operations);
  }
}
