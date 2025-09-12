import {HttpService} from "@nestjs/axios";
import {Injectable} from "@nestjs/common";
import axios from "axios";
import {
    PERFORMANCE_CLIENT_ID,
    PERFORMANCE_CLIENT_SECRET,
    OZON_PERFORMANCE_TOKEN_URL,
} from "@/config";
import {waitRateLimit} from "@/shared/utils/rateLimit";

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
            OZON_PERFORMANCE_TOKEN_URL,
            {
                client_id: PERFORMANCE_CLIENT_ID,
                client_secret: PERFORMANCE_CLIENT_SECRET,
                grant_type: "client_credentials",
            },
            {
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );

        this.token = data.access_token;
        this.tokenExpiry = now + data.expires_in * 1000 - 60_000;
        return this.token;
    }

    get client() {
        return this.http;
    }
}

