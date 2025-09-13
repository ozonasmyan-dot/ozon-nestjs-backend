import { Query, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { OrderService } from './order.service';
import { GetPostingsDto } from '@/api/seller/dto/get-postings.dto';
import { AggregateOrderDto } from './dto/aggregate-order.dto';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  aggregate(@Query() dto: AggregateOrderDto) {
    return this.orderService.aggregate(dto);
  }

  @Get('sync')
  sync(@Query() dto: GetPostingsDto) {
    return this.orderService.sync(dto);
  }
}
