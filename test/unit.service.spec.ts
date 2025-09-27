import { UnitService } from "@/modules/unit/unit.service";
import { OrderRepository } from "@/modules/order/order.repository";
import { TransactionRepository } from "@/modules/transaction/transaction.repository";
import { UnitFactory } from "@/modules/unit/unit.factory";
import ordersFixture from "@/shared/data/orders.fixture";
import { CustomStatus } from "@/modules/unit/ts/custom-status.enum";
import { AdvertisingRepository } from "@/modules/advertising/advertising.repository";

describe("UnitService", () => {
  let service: UnitService;
  let orders: any[];
  let transactions: any[];
  let unitFactory: UnitFactory;
  let advertisingRepository: jest.Mocked<AdvertisingRepository>;

  beforeAll(() => {
    orders = ordersFixture.map((o) => ({
      ...o,
      createdAt: new Date(o.createdAt),
      inProcessAt: new Date(o.inProcessAt),
      transactions: o.transactions.map((t) => ({
        ...t,
        date: new Date(t.date),
      })),
    }));
    transactions = orders.flatMap((o) => o.transactions);
    const orderRepository = {
      findAll: jest.fn().mockResolvedValue(orders),
    } as unknown as OrderRepository;
    const transactionRepository = {
      findByPostingNumbers: jest
        .fn()
        .mockImplementation((numbers: string[]) =>
          Promise.resolve(
            transactions.filter((t) => numbers.includes(t.postingNumber)),
          ),
        ),
    } as unknown as TransactionRepository;
    advertisingRepository = {
      findBySkusAndDateRange: jest.fn().mockResolvedValue([
        {
          id: "ad-1",
          campaignId: "cmp-1",
          sku: "1828048543",
          date: "2024-01-05",
          type: "search",
          clicks: 0,
          toCart: 0,
          avgBid: 0,
          minBidCpo: 0,
          minBidCpoTop: 0,
          competitiveBid: 0,
          weeklyBudget: 0,
          moneySpent: 800,
          createdAt: new Date("2024-01-05T00:00:00.000Z"),
        },
      ]),
    } as unknown as jest.Mocked<AdvertisingRepository>;
    unitFactory = new UnitFactory();
    service = new UnitService(
      orderRepository,
      transactionRepository,
      unitFactory,
      advertisingRepository,
    );
  });

  it("calculates custom statuses and economy for each order", async () => {
    const result = await service.aggregate({});
    expect(result).toHaveLength(orders.length);

    const delivered = result.find((item) => item.id === "delivered-negative");
    expect(delivered?.status).toBe(CustomStatus.Delivered);
    expect(delivered?.costPrice).toBe(771);
    expect(delivered?.margin).toBeCloseTo(219);
    expect(delivered?.advertisingPerUnit).toBeCloseTo(100);

    const returnUnit = result.find((item) => item.id === "delivered-positive");
    expect(returnUnit?.status).toBe(CustomStatus.Return);
  });

  it("filters units by custom statuses when status filter provided", async () => {
    const result = await service.aggregate({
      status: CustomStatus.Delivered,
    });

    expect(result).not.toHaveLength(0);
    expect(result.every((unit) => unit.status === CustomStatus.Delivered)).toBe(
      true,
    );
  });

  it("uses UnitFactory to create units", async () => {
    const spy = jest.spyOn(unitFactory, "createUnit");
    await service.aggregate({});
    expect(spy).toHaveBeenCalledTimes(orders.length);
    const [order, orderTransactions, additional] = spy.mock.calls[0];
    expect(order).toBeDefined();
    expect(orderTransactions).toBeInstanceOf(Array);
    expect(additional).toEqual(
      expect.objectContaining({ advertisingPerUnit: expect.any(Number) }),
    );
  });

  it("requests advertising statistics for the aggregated period", async () => {
    await service.aggregate({});
    expect(advertisingRepository.findBySkusAndDateRange).toHaveBeenCalledWith(
      ["1828048543"],
      "2024-01-01",
      "2024-01-31",
    );
  });
});
