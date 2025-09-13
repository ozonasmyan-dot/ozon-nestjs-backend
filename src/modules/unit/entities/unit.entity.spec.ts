import { UnitEntity } from './unit.entity';
import { OzonStatus } from '../ts/ozon-status.enum';
import { CustomStatus } from '../ts/custom-status.enum';
import { TransactionEntity } from '@/modules/transaction/entities/transaction.entity';

describe('UnitEntity status mapping', () => {
  const basePrice = 1000;
  const sku = '1828048543';
  const tx = (name, price) =>
    new TransactionEntity({
      operationServiceName: name,
      price,
    } as any);

  const createUnit = (status, transactions = []) =>
    new UnitEntity({
      status,
      price: basePrice,
      sku,
      transactions,
    } as any);

  it('returns CancelPVZ when cancelled with return PVZ service', () => {
    const unit = createUnit(OzonStatus.Cancelled, [
      tx('MarketplaceServiceItemRedistributionReturnsPVZ', -100),
    ]);
    expect(unit.status).toBe(CustomStatus.CancelPVZ);
  });

  it('returns InstantCancel when cancelled without return PVZ service', () => {
    const unit = createUnit(OzonStatus.Cancelled);
    expect(unit.status).toBe(CustomStatus.InstantCancel);
  });

  it('returns AwaitingDelivery for awaiting deliver status', () => {
    const unit = createUnit(OzonStatus.AwaitingDeliver);
    expect(unit.status).toBe(CustomStatus.AwaitingDelivery);
  });

  it('returns AwaitingPackaging for awaiting packaging status', () => {
    const unit = createUnit(OzonStatus.AwaitingPackaging);
    expect(unit.status).toBe(CustomStatus.AwaitingPackaging);
  });

  it('returns Delivering for delivering status', () => {
    const unit = createUnit(OzonStatus.Delivering);
    expect(unit.status).toBe(CustomStatus.Delivering);
  });

  it('returns Delivered when delivered with negative sales commission', () => {
    const unit = createUnit(OzonStatus.Delivered, [tx('SaleCommission', -1)]);
    expect(unit.status).toBe(CustomStatus.Delivered);
  });

  it('returns Return when delivered with positive sales commission', () => {
    const unit = createUnit(OzonStatus.Delivered, [tx('SaleCommission', 10)]);
    expect(unit.status).toBe(CustomStatus.Return);
  });

  it('returns AwaitingPayment when delivered without sales commission', () => {
    const unit = createUnit(OzonStatus.Delivered);
    expect(unit.status).toBe(CustomStatus.AwaitingPayment);
  });

  it('returns Unknown when status is empty', () => {
    const unit = createUnit('');
    expect(unit.status).toBe(CustomStatus.Unknown);
  });
});

