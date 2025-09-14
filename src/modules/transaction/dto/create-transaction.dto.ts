export class CreateTransactionDto {
  operationId: string;
  name: string;
  date: Date;
  postingNumber: string;
  price: number;
  inOrder?: boolean;
}
