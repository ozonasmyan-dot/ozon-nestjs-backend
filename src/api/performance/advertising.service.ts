import {Injectable} from "@nestjs/common";
import {PerformanceApiService} from "@/api/performance/performance.service";

@Injectable()
export class AdvertisingApiService {
    constructor(private readonly http: PerformanceApiService) {
    }

    async getCampaigns() {
        const {data: response} = await this.http.client.axiosRef.get('/api/client/campaign');

        return response?.list;
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
}