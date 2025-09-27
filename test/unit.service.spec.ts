import { UnitService } from "@/modules/unit/unit.service";
import { OrderRepository } from "@/modules/order/order.repository";
import { TransactionRepository } from "@/modules/transaction/transaction.repository";
import { UnitFactory } from "@/modules/unit/unit.factory";
import ordersFixture from "@/shared/data/orders.fixture";
import { CustomStatus } from "@/modules/unit/ts/custom-status.enum";

describe("UnitService", () => {
  let service: UnitService;
  let orders: any[];
  let transactions: any[];
  let unitFactory: UnitFactory;

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
    unitFactory = new UnitFactory();
    service = new UnitService(
      orderRepository,
      transactionRepository,
      unitFactory,
    );
  });

  it("calculates custom statuses and economy for each order", async () => {
    const result = await service.aggregate({});
    expect(result).toHaveLength(orders.length);

    const delivered = result.find((item) => item.id === "delivered-negative");
    expect(delivered?.status).toBe(CustomStatus.Delivered);
    expect(delivered?.costPrice).toBe(771);
    expect(delivered?.margin).toBeCloseTo(219);

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
  });
});
