import { UnitService } from "@/modules/unit/unit.service";
import { OrderRepository } from "@/modules/order/order.repository";
import { TransactionRepository } from "@/modules/transaction/transaction.repository";
import { UnitFactory } from "@/modules/unit/unit.factory";
import ordersFixture from "@/shared/data/orders.fixture";
import { AdvertisingRepository } from "@/modules/advertising/advertising.repository";
import dayjs from "dayjs";

describe("UnitService", () => {
  let service: UnitService;
  let orders: any[];
  let transactions: any[];
  let unitFactory: UnitFactory;
  let orderRepositoryMock: {
    findAll: jest.Mock;
    countByCreatedAtRange: jest.Mock;
  };
  let transactionRepositoryMock: {
    findByPostingNumbers: jest.Mock;
  };
  let advertisingRepositoryMock: {
    sumMoneySpentByDateRange: jest.Mock;
  };

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

    orderRepositoryMock = {
      findAll: jest.fn().mockResolvedValue(orders),
      countByCreatedAtRange: jest.fn().mockResolvedValue(orders.length),
    };

    transactionRepositoryMock = {
      findByPostingNumbers: jest
        .fn()
        .mockImplementation((numbers: string[]) =>
          Promise.resolve(
            transactions.filter((t) => numbers.includes(t.postingNumber)),
          ),
        ),
    };

    advertisingRepositoryMock = {
      sumMoneySpentByDateRange: jest.fn().mockResolvedValue(400),
    };

    unitFactory = new UnitFactory();
    service = new UnitService(
      orderRepositoryMock as unknown as OrderRepository,
      transactionRepositoryMock as unknown as TransactionRepository,
      unitFactory,
      advertisingRepositoryMock as unknown as AdvertisingRepository,
    );
  });

  it("distributes monthly advertising expenses across units", async () => {
    const result = await service.aggregate({});

    expect(result).toHaveLength(orders.length);
    expect(result[0].advertisingExpense).toBe(50);
    expect(advertisingRepositoryMock.sumMoneySpentByDateRange).toHaveBeenCalledWith(
      "2024-01-01",
      "2024-01-31",
    );
    const [from, to] = orderRepositoryMock.countByCreatedAtRange.mock.calls[0];
    expect(dayjs(from).format("YYYY-MM-DD")).toBe("2024-01-01");
    expect(dayjs(to).format("YYYY-MM-DD")).toBe("2024-01-31");
  });

  it("includes advertising expense in CSV export", async () => {
    const csv = await service.aggregateCsv({});
    const lines = csv.trim().split("\n");

    expect(lines[0]).toBe(
      "product,postingNumber,createdAt,status,margin,costPrice,totalServices,price,advertisingExpense",
    );
    expect(lines.length).toBe(orders.length + 1);
    const firstRow = lines[1].split(",");
    expect(firstRow[firstRow.length - 1]).toBe("50");
  });

  it("passes advertising expense to UnitFactory", async () => {
    const spy = jest.spyOn(unitFactory, "createUnit");
    await service.aggregate({});

    expect(spy).toHaveBeenCalledTimes(orders.length);
    spy.mock.calls.forEach(([, , advertisingExpense]) => {
      expect(advertisingExpense).toBe(50);
    });
  });
});
