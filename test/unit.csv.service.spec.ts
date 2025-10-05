import { CsvService } from "@/modules/unit/services/csv.service";
import { UnitService } from "@/modules/unit/unit.service";
import { OrderRepository } from "@/modules/order/order.repository";
import { TransactionRepository } from "@/modules/transaction/transaction.repository";
import { UnitFactory } from "@/modules/unit/unit.factory";
import ordersFixture from "@/shared/data/orders.fixture";
import dayjs from "dayjs";
import { AdvertisingRepository } from "@/modules/advertising/advertising.repository";

describe("UnitCsvService", () => {
  let service: UnitService;
  let csvService: CsvService;
  let orders: any[];
  let transactions: any[];

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

    csvService = new CsvService(service);
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
  });

  it("returns only header when there are no units", async () => {
    const emptyService = {
      aggregate: jest.fn().mockResolvedValue([]),
    } as unknown as UnitService;
    const emptyCsvService = new CsvService(emptyService);

    const csv = await emptyCsvService.aggregateOrdersCsv({});

    expect(csv).toBe("date,sku,ordersMoney,count");
  });

  it("includes advertisingPerUnit column in unit export", async () => {
    const csv = await csvService.aggregateCsv({});
    const [header, firstDataRow] = csv.split("\n");

    expect(header.split(",")).toContain("advertisingPerUnit");
    expect(firstDataRow.split(",").length).toBe(header.split(",").length);
  });

  it("adds service columns and fills missing values with zero", async () => {
    const csv = await csvService.aggregateCsv({});
    const lines = csv.split("\n");
    const headerColumns = lines[0].split(",");
    const rows = lines.slice(1).map((line) => line.split(","));

    const expectedServices = [
      "MarketplaceServiceItemLogistics",
      "MarketplaceServiceItemReturnFlowLogistic",
      "SaleCommission",
    ];

    expectedServices.forEach((service) => {
      expect(headerColumns).toContain(service);
    });

    const postingNumberIndex = headerColumns.indexOf("postingNumber");
    const serviceIndices = Object.fromEntries(
      expectedServices.map((service) => [service, headerColumns.indexOf(service)]),
    );

    const rowByPostingNumber = (postingNumber: string) =>
      rows.find((columns) => columns[postingNumberIndex] === postingNumber);

    const withoutServices = rowByPostingNumber("PN2");
    expect(withoutServices).toBeDefined();
    expectedServices.forEach((service) => {
      expect(withoutServices?.[serviceIndices[service]]).toBe("0");
    });

    const returnLogistic = rowByPostingNumber("PN1");
    expect(
      returnLogistic?.[
        serviceIndices["MarketplaceServiceItemReturnFlowLogistic"]
      ],
    ).toBe("-400");

    const logistics = rowByPostingNumber("PN5");
    expect(
      logistics?.[serviceIndices["MarketplaceServiceItemLogistics"]],
    ).toBe("-5");

    const saleCommission = rowByPostingNumber("PN3");
    expect(saleCommission?.[serviceIndices["SaleCommission"]]).toBe("-10");
  });
});
