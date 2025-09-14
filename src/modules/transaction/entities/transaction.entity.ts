import { Transaction } from '@prisma/client';

export class TransactionEntity implements Transaction {
  id: string;
  operationId: string;
  name: string;
  date: Date;
  postingNumber: string;
  price: number;
  sku: string;

  constructor(partial: Partial<Transaction>) {
    Object.assign(this, partial);
  }
}
