import { UnitCsvService } from "@/modules/unit/services/unit-csv.service";
import { UnitService } from "@/modules/unit/unit.service";
import { OrderRepository } from "@/modules/order/order.repository";
import { TransactionRepository } from "@/modules/transaction/transaction.repository";
import { UnitFactory } from "@/modules/unit/unit.factory";
import ordersFixture from "@/shared/data/orders.fixture";
import dayjs from "dayjs";
import { AdvertisingRepository } from "@/modules/advertising/advertising.repository";
import { OrderService } from "@/modules/order/order.service";
import { TransactionService } from "@/modules/transaction/transaction.service";
import { AdvertisingService } from "@/modules/advertising/advertising.service";

describe("UnitCsvService", () => {
  let service: UnitService;
  let csvService: UnitCsvService;
  let orders: any[];
  let transactions: any[];
  let orderService: jest.Mocked<Pick<OrderService, "sync">>;
  let transactionService: jest.Mocked<Pick<TransactionService, "sync">>;
  let advertisingService: jest.Mocked<Pick<AdvertisingService, "sync">>;

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
  });

  beforeEach(() => {
    jest.clearAllMocks();

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
    const advertisingRepository = {
      findBySkusAndDateRange: jest.fn().mockResolvedValue([]),
    } as unknown as AdvertisingRepository;

    service = new UnitService(
      orderRepository,
      transactionRepository,
      new UnitFactory(),
      advertisingRepository,
    );

    orderService = {
      sync: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<Pick<OrderService, "sync">>;
    transactionService = {
      sync: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<Pick<TransactionService, "sync">>;
    advertisingService = {
      sync: jest.fn().mockResolvedValue("OK"),
    } as unknown as jest.Mocked<Pick<AdvertisingService, "sync">>;

    csvService = new UnitCsvService(
      service,
      orderService,
      transactionService,
      advertisingService,
    );
  });

  it("aggregates units by date and sku regardless of status", async () => {
    const units = await service.aggregate({});
    const expected = new Map<
      string,
      { ordersMoney: number; count: number; date: string; sku: string }
    >();

    units.forEach((unit) => {
      const date = dayjs(unit.createdAt).format("YYYY-MM-DD");
      const key = `${unit.sku}_${date}`;
      const current =
        expected.get(key) ?? {
          ordersMoney: 0,
          count: 0,
          date,
          sku: unit.sku,
        };

      current.ordersMoney += unit.price;
      current.count += 1;

      expected.set(key, current);
    });

    const csv = await csvService.aggregateOrdersCsv({});
    const expectedRows = Array.from(expected.values())
      .sort((a, b) => {
        const dateDiff = a.date.localeCompare(b.date);
        if (dateDiff !== 0) {
          return dateDiff;
        }
        return a.sku.localeCompare(b.sku);
      })
      .map((item) =>
        [item.date, item.sku, item.ordersMoney, item.count]
          .map((value) => String(value))
          .join(","),
      );

    const expectedCsv = ["date,sku,ordersMoney,count", ...expectedRows].join("\n");

    expect(csv).toBe(expectedCsv);
    expect(orderService.sync).toHaveBeenCalled();
    expect(transactionService.sync).toHaveBeenCalled();
    expect(advertisingService.sync).toHaveBeenCalled();
  });

  it("returns only header when there are no units", async () => {
    const emptyService = {
      aggregate: jest.fn().mockResolvedValue([]),
    } as unknown as UnitService;
    const emptyOrderService = {
      sync: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<Pick<OrderService, "sync">>;
    const emptyTransactionService = {
      sync: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<Pick<TransactionService, "sync">>;
    const emptyAdvertisingService = {
      sync: jest.fn().mockResolvedValue("OK"),
    } as unknown as jest.Mocked<Pick<AdvertisingService, "sync">>;
    const emptyCsvService = new UnitCsvService(
      emptyService,
      emptyOrderService,
      emptyTransactionService,
      emptyAdvertisingService,
    );

    const csv = await emptyCsvService.aggregateOrdersCsv({});

    expect(csv).toBe("date,sku,ordersMoney,count");
    expect(emptyOrderService.sync).toHaveBeenCalled();
    expect(emptyTransactionService.sync).toHaveBeenCalled();
    expect(emptyAdvertisingService.sync).toHaveBeenCalled();
  });

  it("includes advertisingPerUnit column in unit export", async () => {
    const csv = await csvService.aggregateCsv({});
    const [header, firstDataRow] = csv.split("\n");

    expect(header.split(",")).toContain("advertisingPerUnit");
    expect(firstDataRow.split(",").length).toBe(header.split(",").length);
  });
});
