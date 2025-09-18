import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { PerformanceApiService } from "./performance.service";
import { OZON_PERFORMANCE_API_URL } from "@/config";

@Module({
  imports: [
    HttpModule.register({
      baseURL: 'https://api-performance.ozon.ru:443/',
      headers: {
        "Content-Type": "application/json",
      },
    }),
  ],
  providers: [PerformanceApiService],
  exports: [PerformanceApiService],
})
export class PerformanceApiModule {}

