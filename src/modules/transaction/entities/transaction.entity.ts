import { Transaction } from '@prisma/client';

export class TransactionEntity implements Transaction {
  id: string;
  operationId: string;
  operationType: string;
  operationTypeName: string;
  operationServiceName: string;
  date: Date;
  type: string;
  postingNumber: string;
  price: number;

  constructor(partial: Partial<Transaction>) {
    Object.assign(this, partial);
  }
}
