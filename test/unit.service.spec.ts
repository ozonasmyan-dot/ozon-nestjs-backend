import { UnitService } from "@/modules/unit/unit.service";
import { OrderRepository } from "@/modules/order/order.repository";
import { TransactionRepository } from "@/modules/transaction/transaction.repository";
import ordersFixture from "@/shared/data/orders.fixture";

describe("UnitService.aggregate totals", () => {
  it("sums price and costPrice only for delivered items", async () => {
    const orders = ordersFixture.map((o) => ({
      ...o,
      createdAt: new Date(o.createdAt),
      inProcessAt: new Date(o.inProcessAt),
      transactions: o.transactions.map((t) => ({
        ...t,
        date: new Date(t.date),
      })),
    }));
    const transactions = orders.flatMap((o) => o.transactions);
    const orderRepository = {
      findAll: jest.fn().mockResolvedValue(orders),
    } as unknown as OrderRepository;
    const transactionRepository = {
      findAll: jest.fn().mockResolvedValue(transactions),
    } as unknown as TransactionRepository;

    const service = new UnitService(orderRepository, transactionRepository);
    const result = await service.aggregate({});

    expect(result.totals[0].price).toBe(1000);
    expect(result.totals[0].costPrice).toBe(771);
  });
});
