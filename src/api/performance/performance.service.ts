import {HttpService} from "@nestjs/axios";
import {Injectable} from "@nestjs/common";
import axios from "axios";
import {waitRateLimit} from "@/shared/utils/rate-limit.utils";

@Injectable()
export class PerformanceApiService {
    private token: string | null = null;
    private tokenExpiry = 0;

    constructor(private readonly http: HttpService) {
        this.http.axiosRef.interceptors.request.use(async (config: any) => {
            await waitRateLimit();
            const token = await this.refreshToken();
            config.headers = config.headers ?? {};
            config.headers["Authorization"] = `Bearer ${token}`;
            return config;
        });
    }

    private async refreshToken(): Promise<string> {
        const now = Date.now();
        if (this.token && now < this.tokenExpiry) {
            return this.token;
        }

        await waitRateLimit();
        const {data} = await axios.post(
            'https://api-performance.ozon.ru:443/api/client/token',
            {
                client_id: '88264411-1759346888350@advertising.performance.ozon.ru',
                client_secret: 'hgXRnjZMONXAPCvcuBdYvtgOg1tRI27rW2NLOj7KIT0vU5ZbsSxF-uSDGTrPoB3W9DqDpmZJtcRreOuvsg',
                grant_type: "client_credentials",
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );

        this.token = data.access_token;
        this.tokenExpiry = now + data.expires_in * 1000 - 60_000;
        return this.token;
    }

    async fetchApiReportData(url: string, data: any) {
        const {data: response} = await this.client.axiosRef.post(url, data);

        if (!response.UUID) {
            throw new Error('Invalid response');
        }

        let statusOK = 'NOT_STARTED';
        let attempts = 0;

        const delayMs = 10_000;
        const maxAttempts = 40;

        while (statusOK !== 'OK' && attempts < maxAttempts) {
            console.log(
                `[fetchApiReportData] waiting... attempt ${attempts + 1}/${maxAttempts}`,
                { status: statusOK }
            );

            await new Promise((res) => setTimeout(res, delayMs));

            const { data: newState } = await this.client.axiosRef.get(`/api/client/statistics/${response.UUID}`);

            statusOK = newState.state;
            attempts++;
        }

        if (statusOK !== 'OK') {
            console.error(
                '[fetchApiReportData] report not ready after max attempts',
                { finalState: statusOK }
            );
            return null;
        }

        console.log('[fetchApiReportData] report is ready, fetching final report…');
        const { data: report } = await this.http.axiosRef.get(`/api/client/statistics/report?UUID=${response.UUID}`);

        console.log('[fetchApiReportData] final report received', report);

        return report;
    }

    get client() {
        return this.http;
    }
}

