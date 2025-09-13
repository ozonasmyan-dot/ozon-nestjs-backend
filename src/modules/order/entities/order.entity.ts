import { Order } from '@prisma/client';

export class OrderEntity implements Order {
  id: string;
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

  constructor(partial: Partial<Order>) {
    Object.assign(this, partial);
  }
}

