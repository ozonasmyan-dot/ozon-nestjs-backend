import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import dayjs from 'dayjs';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateAdvertisingDto } from './dto/create-advertising.dto';

interface AdvertisingFilterParams {
  campaignId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface AdvertisingDateRange {
  sku: string;
  dateFrom: string;
  dateTo: string;
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

  async findBySkuAndDateRanges(ranges: AdvertisingDateRange[]) {
    if (!ranges.length) {
      return [];
    }

    const orFilters: Prisma.AdvertisingWhereInput[] = [];

    for (const { sku, dateFrom, dateTo } of ranges) {
      if (!sku) {
        continue;
      }

      const dateFilters: Prisma.AdvertisingWhereInput[] = [];

      if (dateFrom && dateTo) {
        dateFilters.push({
          date: {
            gte: dateFrom,
            lt: dateTo,
          },
        });
      }

      const tokens = this.buildMonthTokens(dateFrom);
      for (const token of tokens) {
        dateFilters.push({
          date: {
            contains: token,
          },
        });
      }

      if (!dateFilters.length) {
        continue;
      }

      orFilters.push({
        AND: [{ sku }, { OR: dateFilters }],
      });
    }

    if (!orFilters.length) {
      return [];
    }

    const where: Prisma.AdvertisingWhereInput = {
      OR: orFilters,
    };

    return this.prisma.advertising.findMany({
      where,
      select: {
        sku: true,
        date: true,
        moneySpent: true,
      },
    });
  }

  private buildMonthTokens(dateFrom?: string): string[] {
    if (!dateFrom) {
      return [];
    }

    const parsed = dayjs(dateFrom);

    if (!parsed.isValid()) {
      return [];
    }

    const tokens = new Set<string>();
    tokens.add(parsed.format('YYYY-MM'));
    tokens.add(parsed.format('MM.YYYY'));

    return Array.from(tokens).filter(Boolean);
  }
}
