import { AdvertisingService } from "@/modules/advertising/advertising.service";
import { AdvertisingRepository } from "@/modules/advertising/advertising.repository";
import { AdvertisingApiService } from "@/api/performance/advertising.service";
import { FilterAdvertisingDto } from "@/modules/advertising/dto/filter-advertising.dto";

describe("AdvertisingService", () => {
  let repository: jest.Mocked<AdvertisingRepository>;
  let service: AdvertisingService;

  beforeEach(() => {
    repository = {
      findMany: jest.fn(),
      upsertMany: jest.fn(),
    } as unknown as jest.Mocked<AdvertisingRepository>;

    const apiService = {} as AdvertisingApiService;
    service = new AdvertisingService(apiService, repository);
  });

  describe("findManyCsv", () => {
    it("returns csv representation of advertising data", async () => {
      const filters = { campaignId: "campaign-1" } as FilterAdvertisingDto;
      const createdAt = new Date("2024-05-02T00:00:00.000Z");
      repository.findMany.mockResolvedValue([
        {
          id: "1",
          campaignId: "campaign-1",
          sku: "sku-1",
          date: "2024-05-01",
          type: "CPC",
          clicks: 10,
          toCart: 4,
          avgBid: 1.5,
          moneySpent: 2.5,
          minBidCpo: 0.1,
          minBidCpoTop: 0.2,
          competitiveBid: 0.3,
          weeklyBudget: 5,
          createdAt,
        } as any,
      ]);

      const csv = await service.findManyCsv(filters);

      expect(repository.findMany).toHaveBeenCalledWith(filters);
      const lines = csv.trim().split("\n");
      expect(lines[0]).toBe(
        "id,campaignId,sku,date,type,clicks,toCart,avgBid,moneySpent,minBidCpo,minBidCpoTop,competitiveBid,weeklyBudget,createdAt",
      );
      expect(lines[1].split(",")).toEqual([
        "1",
        "campaign-1",
        "sku-1",
        "2024-05-01",
        "CPC",
        "10",
        "4",
        "1.5",
        "2.5",
        "0.1",
        "0.2",
        "0.3",
        "5",
        createdAt.toISOString(),
      ]);
    });

    it("returns header when repository returns no items", async () => {
      repository.findMany.mockResolvedValue([]);

      const csv = await service.findManyCsv({} as FilterAdvertisingDto);

      expect(csv).toBe(
        "id,campaignId,sku,date,type,clicks,toCart,avgBid,moneySpent,minBidCpo,minBidCpoTop,competitiveBid,weeklyBudget,createdAt",
      );
    });
  });
});
