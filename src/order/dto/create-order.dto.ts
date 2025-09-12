export class CreateOrderDto {
  product: string;
  orderId: string;
  orderNumber: string;
  postingNumber: string;
  status: string;
  createdAt: Date;
  inProcessAt: Date;
  deliveryType: string;
  city?: string;
  isPremium: boolean;
  paymentTypeGroupName: string;
  warehouseId: string;
  warehouseName: string;
  sku: string;
  oldPrice: number;
  price: number;
  currencyCode: string;
  clusterFrom: string;
  clusterTo: string;
}
