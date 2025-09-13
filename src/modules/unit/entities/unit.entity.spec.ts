import { UnitEntity } from './unit.entity';
import { OzonStatus } from '../ts/ozon-status.enum';
import { CustomStatus } from '../ts/custom-status.enum';

describe('UnitEntity status calculation', () => {
  const tx = (name: string, price: number) =>
    ({ operationServiceName: name, price } as any);

  it('handles Cancelled with return PVZ', () => {
    const unit = new UnitEntity({
      status: OzonStatus.Cancelled,
      price: 1000,
      transactions: [
        tx('MarketplaceServiceItemRedistributionReturnsPVZ', -30),
        tx('Other', -20),
      ],
    });

    expect(unit.status).toBe(CustomStatus.CancelPVZ);
    expect(unit.costPrice).toBe(0);
    expect(unit.totalServices).toBe(-50);
    expect(unit.margin).toBe(-50);
  });

  it('handles Cancelled without return PVZ', () => {
    const unit = new UnitEntity({
      status: OzonStatus.Cancelled,
      price: 1000,
      transactions: [tx('Other', -20)],
    });

    expect(unit.status).toBe(CustomStatus.InstantCancel);
    expect(unit.costPrice).toBe(0);
    expect(unit.totalServices).toBe(-20);
    expect(unit.margin).toBe(-20);
  });

  it('handles AwaitingDeliver', () => {
    const unit = new UnitEntity({
      status: OzonStatus.AwaitingDeliver,
      price: 1000,
      transactions: [tx('Other', -10)],
    });

    expect(unit.status).toBe(CustomStatus.AwaitingDelivery);
    expect(unit.costPrice).toBe(0);
    expect(unit.totalServices).toBe(-10);
    expect(unit.margin).toBe(-10);
  });

  it('handles AwaitingPackaging', () => {
    const unit = new UnitEntity({
      status: OzonStatus.AwaitingPackaging,
      price: 1000,
      transactions: [tx('Other', -10)],
    });

    expect(unit.status).toBe(CustomStatus.AwaitingPackaging);
    expect(unit.costPrice).toBe(0);
    expect(unit.totalServices).toBe(-10);
    expect(unit.margin).toBe(-10);
  });

  it('handles Delivering', () => {
    const unit = new UnitEntity({
      status: OzonStatus.Delivering,
      price: 1000,
      transactions: [tx('Other', -10)],
    });

    expect(unit.status).toBe(CustomStatus.Delivering);
    expect(unit.costPrice).toBe(0);
    expect(unit.totalServices).toBe(-10);
    expect(unit.margin).toBe(-10);
  });

  it('handles Delivered with negative SaleCommission', () => {
    const unit = new UnitEntity({
      status: OzonStatus.Delivered,
      price: 1000,
      sku: '1828048543',
      transactions: [
        tx('SaleCommission', -10),
        tx('Other', -5),
      ],
    });

    expect(unit.status).toBe(CustomStatus.Delivered);
    expect(unit.costPrice).toBe(771);
    expect(unit.totalServices).toBe(-15);
    expect(unit.margin).toBe(214);
  });

  it('handles Delivered with positive SaleCommission', () => {
    const unit = new UnitEntity({
      status: OzonStatus.Delivered,
      price: 1000,
      transactions: [
        tx('SaleCommission', 10),
        tx('Other', -5),
      ],
    });

    expect(unit.status).toBe(CustomStatus.Return);
    expect(unit.costPrice).toBe(0);
    expect(unit.totalServices).toBe(5);
    expect(unit.margin).toBe(5);
  });

  it('handles Delivered without SaleCommission', () => {
    const unit = new UnitEntity({
      status: OzonStatus.Delivered,
      price: 1000,
      transactions: [tx('Other', -5)],
    });

    expect(unit.status).toBe(CustomStatus.AwaitingPayment);
    expect(unit.costPrice).toBe(0);
    expect(unit.totalServices).toBe(-5);
    expect(unit.margin).toBe(-5);
  });

  it('handles unknown status', () => {
    const unit = new UnitEntity({
      price: 1000,
      transactions: [tx('Other', -5)],
    });

    expect(unit.status).toBe(CustomStatus.Unknown);
    expect(unit.costPrice).toBe(0);
    expect(unit.totalServices).toBe(-5);
    expect(unit.margin).toBe(-5);
  });
});

