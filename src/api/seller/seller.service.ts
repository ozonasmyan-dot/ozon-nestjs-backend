import {HttpService} from "@nestjs/axios";
import {Injectable} from "@nestjs/common";
import {waitRateLimit} from "@/shared/utils/rate-limit.utils";

@Injectable()
export class SellerApiService {
    constructor(private readonly http: HttpService) {
        this.http.axiosRef.interceptors.request.use(async (config) => {
            await waitRateLimit();
            return config;
        });
    }

    get client() {
        return this.http;
    }
}
