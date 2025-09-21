import { UnitService } from "@/modules/unit/unit.service";
import { OrderRepository } from "@/modules/order/order.repository";
import { TransactionRepository } from "@/modules/transaction/transaction.repository";
import { UnitFactory } from "@/modules/unit/unit.factory";
import ordersFixture from "@/shared/data/orders.fixture";
import { AdvertisingRepository } from "@/modules/advertising/advertising.repository";

describe("UnitService", () => {
  let service: UnitService;
  let orders: any[];
  let transactions: any[];
  let unitFactory: UnitFactory;
  let findBySkuAndDateRanges: jest.Mock;

  beforeEach(() => {
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
    findBySkuAndDateRanges = jest.fn().mockResolvedValue([
      { sku: "1828048543", date: "2024-01-05", moneySpent: 12.34 },
      { sku: "1828048543", date: "2024-01-15", moneySpent: 7.66 },
    ]);
    const advertisingRepository = {
      findBySkuAndDateRanges,
    } as unknown as AdvertisingRepository;
    unitFactory = new UnitFactory();
    service = new UnitService(
      orderRepository,
      transactionRepository,
      unitFactory,
      advertisingRepository,
    );
  });

  it("passes monthly advertising expenses to the factory", async () => {
    const spy = jest.spyOn(unitFactory, "createUnit");
    await service.aggregate({});
    expect(findBySkuAndDateRanges).toHaveBeenCalledWith([
      { sku: "1828048543", dateFrom: "2024-01-01", dateTo: "2024-02-01" },
    ]);
    expect(spy).toHaveBeenCalledTimes(orders.length);
    for (const call of spy.mock.calls) {
      expect(call[2]).toBeCloseTo(20, 2);
    }
  });

  it("parses dot separated advertising dates", async () => {
    findBySkuAndDateRanges.mockResolvedValueOnce([
      { sku: "1828048543", date: "05.01.2024", moneySpent: 20 },
    ]);

    const items = await service.aggregate({});

    for (const item of items) {
      expect(item.advertisingExpense).toBeCloseTo(20, 2);
    }
  });

  it("returns csv representation of units with advertising expense", async () => {
    const csv = await service.aggregateCsv({});
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe(
      "product,postingNumber,createdAt,status,margin,costPrice,transactionTotal,price,advertisingExpense",
    );
    expect(lines.length).toBe(orders.length + 1);
    const firstRow = lines[1].split(",");
    expect(firstRow[firstRow.length - 1]).toBe("20");
  });
});
