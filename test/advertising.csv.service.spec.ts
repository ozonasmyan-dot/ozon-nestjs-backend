import { AdvertisingCsvService } from "@/modules/advertising/services/advertising-csv.service";
import { AdvertisingService } from "@/modules/advertising/advertising.service";
import { FilterAdvertisingDto } from "@/modules/advertising/dto/filter-advertising.dto";

describe("AdvertisingCsvService", () => {
  it("generates csv without triggering synchronization", async () => {
    const filters = { campaignId: "campaign-1" } as FilterAdvertisingDto;
    const advertisingService = {
      sync: jest.fn().mockResolvedValue("OK"),
      findMany: jest.fn().mockResolvedValue([
        {
          campaignId: "campaign-1",
          sku: "sku-1",
          type: "PPC",
          moneySpent: 10,
          toCart: 5,
          competitiveBid: 2,
          weeklyBudget: 100,
          minBidCpo: 0.5,
          minBidCpoTop: 0.7,
          avgBid: 0.3,
          clicks: 20,
          date: "2024-05-01",
        },
      ]),
    } as jest.Mocked<Pick<AdvertisingService, "sync" | "findMany">>;

    const service = new AdvertisingCsvService(
      advertisingService as unknown as AdvertisingService,
    );

    const csv = await service.findManyCsv(filters);

    expect(advertisingService.sync).not.toHaveBeenCalled();
    expect(advertisingService.findMany).toHaveBeenCalledWith(filters);
    expect(csv.split("\n")[0]).toBe(
      "campaignId,sku,type,views,moneySpent,toCart,competitiveBid,weeklyBudget,minBidCpo,minBidCpoTop,avgBid,empty,clicks,date",
    );
  });
});
