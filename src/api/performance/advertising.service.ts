import {Injectable} from "@nestjs/common";
import {PerformanceApiService} from "@/api/performance/performance.service";

@Injectable()
export class AdvertisingApiService {
    constructor(private readonly http: PerformanceApiService) {
    }

    async getStatistics(data: any) {
        return await this.http.fetchApiReportData('/api/client/statistics/json', data);
    }

    async getDailyStatistics(data: any) {
        const {data: rows} = await this.http.client.axiosRef.get('/api/client/statistics/daily/json', {
            params: data
        });

        return rows;
    }

    async getStatisticsExpense(data: any) {
        const {data: rows} = await this.http.client.axiosRef.get('/api/client/statistics/campaign/product/json', {
            params: data
        });

        return rows;
    }

    async getProductsBidsCompetitiveInCampaign(campaignId: any, params: any) {
        const {data: bids} = await this.http.client.axiosRef.get(`/api/client/campaign/${campaignId}/products/bids/competitive`, {
            params,
        });

        return bids;
    }

    async getMinBidSku(params: any) {
        const {data: minBids} = await this.http.client.axiosRef.post(
            '/api/client/min/sku',
            {
                ...params
            }
        );

        return minBids;
    }
}