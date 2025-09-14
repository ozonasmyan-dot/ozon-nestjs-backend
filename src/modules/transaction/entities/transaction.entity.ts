import { Transaction as PrismaTransaction } from '@prisma/client';

export interface Transaction extends PrismaTransaction {
  inOrder: boolean;
}

export class TransactionEntity implements Transaction {
  id: string;
  operationId: string;
  name: string;
  date: Date;
  postingNumber: string;
  price: number;
  inOrder = false;

  constructor(partial: Partial<Transaction>) {
    Object.assign(this, partial);
  }
}
