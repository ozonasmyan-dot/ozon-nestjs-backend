import {Injectable} from "@nestjs/common";
import {SellerApiService} from "./seller.service";
import {GetPostingsDto} from "./dto/get-postings.dto";

@Injectable()
export class PostingApiService {
    constructor(private readonly sellerApi: SellerApiService) {
    }

    async list(data: GetPostingsDto) {
        const x = await this.sellerApi.client.axiosRef.post(
            "/v2/posting/fbo/list",
            data,
        );

        return [];
    }
}
