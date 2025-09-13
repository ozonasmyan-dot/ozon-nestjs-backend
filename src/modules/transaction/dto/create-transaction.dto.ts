export class CreateTransactionDto {
  operationId: string;
  operationType: string;
  operationTypeName: string;
  operationServiceName: string;
  date: Date;
  type: string;
  postingNumber: string;
  price: number;
}
