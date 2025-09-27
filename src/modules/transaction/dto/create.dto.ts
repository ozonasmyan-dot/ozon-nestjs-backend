export class CreateDto {
  operationId: string;
  name: string;
  date: Date;
  postingNumber?: string;
  sku?: string | number;
  price: number;
}
