import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateAdvertisingDto } from './dto/create-advertising.dto';

interface AdvertisingFilterParams {
  campaignId?: string;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable()
export class AdvertisingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(filters: AdvertisingFilterParams) {
    const where: Prisma.AdvertisingWhereInput = {};

    if (filters.campaignId) {
      where.campaignId = filters.campaignId;
    }

    if (filters.dateFrom || filters.dateTo) {
      const dateFilter: Prisma.StringFilter = {};

      if (filters.dateFrom) {
        dateFilter.gte = filters.dateFrom;
      }

      if (filters.dateTo) {
        dateFilter.lte = filters.dateTo;
      }

      where.date = dateFilter;
    }

    return this.prisma.advertising.findMany({
      where,
      orderBy: [
        { date: 'desc' },
        { campaignId: 'asc' },
        { sku: 'asc' },
      ],
    });
  }

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
