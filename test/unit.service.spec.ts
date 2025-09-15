import { UnitService } from "@/modules/unit/unit.service";
import { OrderRepository } from "@/modules/order/order.repository";
import { TransactionRepository } from "@/modules/transaction/transaction.repository";
import ordersFixture from "@/shared/data/orders.fixture";

describe("UnitService", () => {
  let service: UnitService;
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
    const orderRepository = {
      findAll: jest.fn().mockResolvedValue(orders),
    } as unknown as OrderRepository;
    const transactionRepository = {
      findAll: jest.fn().mockResolvedValue(transactions),
    } as unknown as TransactionRepository;
    service = new UnitService(orderRepository, transactionRepository);
  });

  it("sums price and costPrice only for delivered items", async () => {
    const result = await service.aggregate({});
    expect(result.totals[0].price).toBe(1000);
    expect(result.totals[0].costPrice).toBe(771);
  });

  it("returns csv representation of units", async () => {
    const csv = await service.aggregateCsv({});
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe(
      "orderNumber,postingNumber,sku,status,price,costPrice,margin,transactionTotal",
    );
    expect(lines.length).toBe(orders.length + 1);
  });
});
