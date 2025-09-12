import {Module} from "@nestjs/common";
import {HttpModule} from "@nestjs/axios";
import {SellerApiService} from "./seller.service";
import {PostingApiService} from "./posting.service";
import {TransactionApiService} from "./transaction.service";

@Module({
    imports: [
        HttpModule.register({
            baseURL: 'https://api-seller.ozon.ru',
            headers: {
                'Content-Type': 'application/json',
                "Client-Id": "2313514",
                "Api-Key": "6dbd1f5d-8825-45fd-b786-9a0f0f94d3b7",
            },
        }),
    ],
    providers: [SellerApiService, PostingApiService, TransactionApiService],
    exports: [SellerApiService, PostingApiService, TransactionApiService],
})
export class SellerApiModule {
}

