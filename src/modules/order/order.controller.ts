import { Query, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { OrderService } from './order.service';
import { GetPostingsDto } from '@/api/seller/dto/get-postings.dto';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  aggregate() {
    return this.orderService.aggregate();
  }

  @Get('sync')
  sync(@Query() dto: GetPostingsDto) {
    return this.orderService.sync(dto);
  }
}
