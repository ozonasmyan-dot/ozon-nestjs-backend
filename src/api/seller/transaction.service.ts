import {Injectable} from "@nestjs/common";
import {SellerApiService} from "./seller.service";
import {GetTransactionsDto} from "./dto/get-transactions.dto";
import dayjs from 'dayjs';
import {TransactionEntity} from "@/modules/transaction/entities/transaction.entity";

@Injectable()
export class TransactionApiService {
    constructor(private readonly sellerApi: SellerApiService) {
    }

    async list(data: GetTransactionsDto) {
        const transactions: any[] = [];

        const from = data?.filter?.date?.from ? new Date(data.filter.date.from) : null;
        const to = data?.filter?.date?.to ? new Date(data.filter.date.to) : null;

        if (from && to) {
            let cursor = from;

            while (cursor < to) {
                let end = dayjs(cursor).add(1, 'month').toDate();
                if (end > to) {
                    end = to;
                }

                const batch = await this.listMonth({
                    ...data,
                    filter: {
                        ...(data.filter ?? {}),
                        date: {
                            from: cursor.toISOString(),
                            to: end.toISOString(),
                        },
                    },
                });

                for (const t of batch) {
                    for (const s of t.services) {
                        if (s.length !== 0) {
                            transactions.push({
                                operationId: String(t.operation_id ?? ''),
                                name: s.name ?? '',
                                date: dayjs(t.operation_date, 'YYYY-MM-DD HH:mm:ss').toDate(),
                                postingNumber: t.posting?.posting_number,
                                price: Number(s.price ?? 0),
                            })
                        } else {
                            transactions.push({
                                operationId: String(t.operation_id ?? ''),
                                name: t.operation_type,
                                date: dayjs(t.operation_date, 'YYYY-MM-DD HH:mm:ss').toDate(),
                                postingNumber: t.posting?.posting_number,
                                price: Number(t.amount ?? 0),
                            })
                        }
                    }

                    const saleCommission = Number(t.sale_commission ?? 0);

                    if (saleCommission !== 0) {
                        transactions.push({
                            operationId: String(t.operation_id ?? ''),
                            name: 'SaleCommission',
                            date: dayjs(t.operation_date, 'YYYY-MM-DD HH:mm:ss').toDate(),
                            postingNumber: t.posting?.posting_number ?? '',
                            price: saleCommission,
                        });
                    }
                }

                transactions.push(...batch);

                cursor = dayjs(end).add(1, 'day').toDate();
            }
        } else {
            const batch = await this.listMonth(data);
            transactions.push(...batch);
        }

        return transactions;
    }

    private async listMonth(data: GetTransactionsDto) {
        let page = 1;
        const page_size = 1000;
        const transactions: any[] = [];

        while (true) {
            const {data: response} = await this.sellerApi.client.axiosRef.post(
                "/v3/finance/transaction/list",
                {
                    ...data,
                    page,
                    page_size
                },
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
