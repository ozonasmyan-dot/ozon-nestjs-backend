import { FinanceService } from '@/modules/finance/finance.service';
import { OrderRepository } from '@/modules/order/order.repository';
import { TransactionRepository } from '@/modules/transaction/transaction.repository';
import { UnitFactory } from '@/modules/unit/unit.factory';
import { FinanceMetricsService } from '@/modules/finance/finance-metrics.service';
import ordersFixture from '@/shared/data/orders.fixture';

// helper to convert fixture dates
const prepareOrders = () =>
  ordersFixture.map((o) => ({
    ...o,
    createdAt: new Date(o.createdAt),
    inProcessAt: new Date(o.inProcessAt),
    transactions: o.transactions.map((t) => ({
      ...t,
      date: new Date(t.date),
    })),
  }));

describe('FinanceService helpers', () => {
  let service: FinanceService;
  let orderRepository: OrderRepository;
  let transactionRepository: TransactionRepository;
  let unitFactory: UnitFactory;

  beforeEach(() => {
    orderRepository = { findAll: jest.fn() } as any;
    transactionRepository = { findAll: jest.fn() } as any;
    unitFactory = new UnitFactory();
    service = new FinanceService(
      orderRepository,
      transactionRepository,
      unitFactory,
      new FinanceMetricsService(),
    );
  });

  it('loads orders and transactions', async () => {
    (orderRepository.findAll as jest.Mock).mockResolvedValue([1]);
    (transactionRepository.findAll as jest.Mock).mockResolvedValue([2]);
    const result = await (service as any).loadOrdersAndTransactions();
    expect(result).toEqual({ orders: [1], transactions: [2] });
    expect(orderRepository.findAll).toHaveBeenCalled();
    expect(transactionRepository.findAll).toHaveBeenCalled();
  });

  it('builds finance item using UnitFactory', () => {
    const orders = prepareOrders();
    const order = orders[0];
    const txs = order.transactions;
    const spy = jest.spyOn(unitFactory, 'createUnit');
    const item = (service as any).buildFinanceItem(order, txs);
    expect(spy).toHaveBeenCalledWith(order, txs);
    expect(item.salesCount).toBe(1);
    expect(item.statusCounts).toBeDefined();
  });

  it('builds transaction maps', () => {
    const txs = [
      {
        id: '1',
        name: 'Other',
        price: 10,
        date: new Date('2024-01-01'),
        sku: '1',
      },
      {
        id: '2',
        name: 'General',
        price: 20,
        date: new Date('2024-01-01'),
        sku: null,
      },
    ];
    const { otherMap, generalMap } = (service as any).buildTransactionMaps(txs);
    expect(otherMap.get('01-2024')?.get('1')?.Other).toBe(10);
    expect(generalMap.get('01-2024')?.General).toBe(20);
  });

  it('applies transaction maps', () => {
    const monthMap = new Map<string, Map<string, any>>();
    const item = {
      sku: '1',
      totalCost: 0,
      totalServices: 0,
      totalRevenue: 0,
      salesCount: 0,
      statusCounts: {},
      otherTransactions: {},
      sharedTransactions: {},
      buyoutPercent: 0,
      margin: 0,
      marginPercent: 0,
      profitabilityPercent: 0,
    };
    monthMap.set('01-2024', new Map([['1', item]]));
    const otherMap = new Map([
      ['01-2024', new Map([['1', { Other: 10 }]])],
    ]);
    const generalMap = new Map([
      ['01-2024', { General: 20 }],
    ]);
    const monthCounts = new Map([['01-2024', 1]]);

    (service as any).applyTransactionMaps(
      monthMap,
      otherMap,
      generalMap,
      monthCounts,
    );

    const resultItem = monthMap.get('01-2024')!.get('1')!;
    expect(resultItem.otherTransactions.Other).toBe(10);
    expect(resultItem.sharedTransactions.General).toBe(20);
  });
});
