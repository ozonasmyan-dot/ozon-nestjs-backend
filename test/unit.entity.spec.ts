import * as fs from 'fs';
import * as path from 'path';
import {UnitEntity} from '@/modules/unit/entities/unit.entity';
import {CustomStatus} from '@/modules/unit/ts/custom-status.enum';

describe('UnitEntity status calculation', () => {
    let orders: any[];

    beforeAll(() => {
        const file = path.join(__dirname, './', 'unit-status.fixture.json');
        const fixture = JSON.parse(fs.readFileSync(file, 'utf8'));
        orders = fixture.orders.map((o) => ({
            ...o,
            createdAt: new Date(o.createdAt),
            inProcessAt: new Date(o.inProcessAt),
            transactions: o.transactions.map((t) => ({
                ...t,
                date: new Date(t.date),
            })),
        }));
    });

    const getOrder = (id: string) => orders.find((o) => o.id === id);

    it('should return CancelPVZ when cancelled and return transaction exists', () => {
        const unit = new UnitEntity(getOrder('cancel-pvz'));
        expect(unit.status).toBe(CustomStatus.CancelPVZ);
        expect(unit.costPrice).toBe(0);
        expect(unit.margin).toBeCloseTo(-30);
    });

    it('should return InstantCancel when cancelled without return transaction', () => {
        const unit = new UnitEntity(getOrder('instant-cancel'));
        expect(unit.status).toBe(CustomStatus.InstantCancel);
    });

    it('should return Delivered when delivered with negative sales commission', () => {
        const unit = new UnitEntity(getOrder('delivered-negative'));
        expect(unit.status).toBe(CustomStatus.Delivered);
        expect(unit.costPrice).toBe(771);
        expect(unit.margin).toBeCloseTo(219);
    });

    it('should return Return when delivered with positive sales commission', () => {
        const unit = new UnitEntity(getOrder('delivered-positive'));
        expect(unit.status).toBe(CustomStatus.Return);
        expect(unit.costPrice).toBe(0);
        expect(unit.margin).toBeCloseTo(10);
    });

    it('should return AwaitingPayment when delivered without sales commission', () => {
        const unit = new UnitEntity(getOrder('awaiting-payment'));
        expect(unit.status).toBe(CustomStatus.AwaitingPayment);
        expect(unit.costPrice).toBe(0);
        expect(unit.margin).toBeCloseTo(-5);
    });

    it('should return AwaitingDelivery status', () => {
        const unit = new UnitEntity(getOrder('awaiting-delivery'));
        expect(unit.status).toBe(CustomStatus.AwaitingDelivery);
    });

    it('should return AwaitingPackaging status', () => {
        const unit = new UnitEntity(getOrder('awaiting-packaging'));
        expect(unit.status).toBe(CustomStatus.AwaitingPackaging);
    });

    it('should return Delivering status', () => {
        const unit = new UnitEntity(getOrder('delivering'));
        expect(unit.status).toBe(CustomStatus.Delivering);
    });
});
