export class CreateDto {
  product: string;
  orderId: string;
  orderNumber: string;
  postingNumber: string;
  status: string;
  createdAt: Date;
  inProcessAt: Date;
  sku: string;
  oldPrice: number;
  price: number;
  currencyCode: string;
}
