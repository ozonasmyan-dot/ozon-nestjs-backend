import {Injectable} from "@nestjs/common";
import {SellerApiService} from "./seller.service";
import {GetPostingsDto} from "./dto/get-postings.dto";

@Injectable()
export class PostingApiService {
    constructor(private readonly sellerApi: SellerApiService) {
    }

    async list(data: GetPostingsDto) {
        const limit = data.limit ?? 1000;
        let offset = data.offset ?? 0;
        const postings: any[] = [];

        while (true) {
            const {data: response} = await this.sellerApi.client.axiosRef.post(
                "/v2/posting/fbo/list",
                {...data, limit, offset},
            );

            const batch = response?.result?.postings ?? response?.result ?? [];
            postings.push(...batch);

            if (batch.length < limit) {
                break;
            }

            offset += limit;
        }

        return postings;
    }
}
