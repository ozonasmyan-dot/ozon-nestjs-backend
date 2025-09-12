import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { SellerApiService } from "./seller.service";

@Module({
  imports: [
    HttpModule.register({
      baseURL: "https://api-seller.ozon.ru",
      headers: {
        "Content-Type": "application/json",
        "Client-Id": SELLER_CLIENT_ID,
        "Api-Key": SELLER_API_KEY,
      },
    }),
  ],
  providers: [SellerApiService],
  exports: [SellerApiService],
})
export class SellerApiModule {}
