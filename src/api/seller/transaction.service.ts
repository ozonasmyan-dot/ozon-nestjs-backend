import {Injectable} from "@nestjs/common";
import {SellerApiService} from "./seller.service";
import {GetTransactionsDto} from "./dto/get-transactions.dto";

@Injectable()
export class TransactionApiService {
    constructor(private readonly sellerApi: SellerApiService) {}

    async list(data: GetTransactionsDto) {
        let page = 1;
        const page_size = 1000;
        const transactions: any[] = [];

        while (true) {
            const {data: response} = await this.sellerApi.client.axiosRef.post(
                "/v3/finance/transaction/list",
                {...data, page, page_size},
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
