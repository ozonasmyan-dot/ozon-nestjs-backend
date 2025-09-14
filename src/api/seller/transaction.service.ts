import { Injectable } from "@nestjs/common";
import { SellerApiService } from "./seller.service";
import { GetTransactionsDto } from "./dto/get-transactions.dto";
import dayjs from "dayjs";
import { TransactionEntity } from "@/modules/transaction/entities/transaction.entity";
import { ADS_EXCLUDED_OPERATION_TYPES } from "@/shared/constants/transaction-types.constants";

interface DateRange {
  from: Date;
  to: Date;
}

@Injectable()
export class TransactionApiService {
  constructor(private readonly sellerApi: SellerApiService) {}

  async list(data: GetTransactionsDto): Promise<TransactionEntity[]> {
    const ranges = this.buildRanges(data);
    const transactions: TransactionEntity[] = [];

    if (ranges.length === 0) {
      const batch = await this.fetchMonth(data);
      for (const t of batch) {
        transactions.push(...this.normalize(t));
      }
      return transactions;
    }

    for (const range of ranges) {
      const batch = await this.fetchMonth({
        ...data,
        filter: {
          ...(data.filter ?? {}),
          date: {
            from: range.from.toISOString(),
            to: range.to.toISOString(),
          },
        },
      });

      for (const t of batch) {
        transactions.push(...this.normalize(t));
      }
    }

    return transactions;
  }

  private buildRanges(data: GetTransactionsDto): DateRange[] {
    const from = data?.filter?.date?.from
      ? new Date(data.filter.date.from)
      : null;
    const to = data?.filter?.date?.to ? new Date(data.filter.date.to) : null;

    if (!from || !to) {
      return [];
    }

    const ranges: DateRange[] = [];
    let cursor = from;

    while (cursor < to) {
      let end = dayjs(cursor).add(1, "month").toDate();
      if (end > to) {
        end = to;
      }

      ranges.push({ from: cursor, to: end });
      cursor = dayjs(end).add(1, "day").toDate();
    }

    return ranges;
  }

  private normalize(t: any): TransactionEntity[] {
    const baseDate = dayjs(t.operation_date, "YYYY-MM-DD HH:mm:ss").toDate();
    const results: TransactionEntity[] = [];

    const isAds =
      Array.isArray(t.services) &&
      t.services.length &&
      !ADS_EXCLUDED_OPERATION_TYPES.has(t.operation_type);

    if (isAds) {
      for (const s of t.services) {
        results.push(
          new TransactionEntity({
            operationId: String(t.operation_id ?? ""),
            name: s.name ?? "",
            date: baseDate,
            postingNumber: t.posting?.posting_number,
            price: Number(s.price ?? 0),
          })
        );
      }
    } else {
      results.push(
        new TransactionEntity({
          operationId: String(t.operation_id ?? ""),
          name: t.operation_type,
          date: baseDate,
          postingNumber: t.posting?.posting_number,
          price: Number(t.amount ?? 0),
        })
      );
    }

    const saleCommission = Number(t.sale_commission ?? 0);
    if (saleCommission !== 0) {
      results.push(
        new TransactionEntity({
          operationId: String(t.operation_id ?? ""),
          name: "SaleCommission",
          date: baseDate,
          postingNumber: t.posting?.posting_number ?? "",
          price: saleCommission,
        })
      );
    }

    return results;
  }

  private async fetchMonth(data: GetTransactionsDto) {
    let page = 1;
    const page_size = 1000;
    const transactions: any[] = [];

    while (true) {
      const { data: response } = await this.sellerApi.client.axiosRef.post(
        "/v3/finance/transaction/list",
        {
          ...data,
          page,
          page_size,
        }
      );

      const batch = response?.result?.operations ?? response?.result ?? [];
      transactions.push(...batch);

      if (batch.length < page_size) {
        break;
      }

      page += 1;
    }

    return transactions;
  }
}
