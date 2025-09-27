import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateDto } from './dto/create.dto';

@Injectable()
export class AdvertisingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany() {
    return this.prisma.advertising.findMany({
      orderBy: [
        { date: 'desc' },
      ],
    });
  }

  async upsertMany(items: CreateDto[]) {
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
          product: item.product,
          type: item.type,
          clicks: item.clicks,
          toCart: item.toCart,
          avgBid: item.avgBid,
          minBidCpo: item.minBidCpo,
          minBidCpoTop: item.minBidCpoTop,
          competitiveBid: item.competitiveBid,
          weeklyBudget: item.weeklyBudget,
          moneySpent: item.moneySpent,
        },
        update: {
          clicks: item.clicks,
          toCart: item.toCart,
          avgBid: item.avgBid,
          moneySpent: item.moneySpent,
          minBidCpo: item.minBidCpo,
          minBidCpoTop: item.minBidCpoTop,
          competitiveBid: item.competitiveBid,
          weeklyBudget: item.weeklyBudget,
        },
      }),
    );

    return this.prisma.$transaction(operations);
  }

  async findLatestDate(): Promise<string | null> {
    const lastRecord = await this.prisma.advertising.findFirst({
      orderBy: {
        date: 'desc',
      },
      select: {
        date: true,
      },
    });

    return lastRecord?.date ?? null;
  }

  async findBySkusAndDateRange(
    skus: string[],
    dateFrom: string,
    dateTo: string,
  ) {
    if (!skus.length) {
      return [];
    }

    return this.prisma.advertising.findMany({
      where: {
        sku: { in: skus },
        date: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
    });
  }
}
