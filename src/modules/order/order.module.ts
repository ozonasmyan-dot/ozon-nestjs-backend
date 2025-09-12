import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { SellerApiModule } from '@/api/seller/seller.module';
import { OrderRepository } from './order.repository';
import { TransactionRepository } from '@/modules/transaction/transaction.repository';

@Module({
  imports: [PrismaModule, SellerApiModule],
  controllers: [OrderController],
  providers: [OrderService, OrderRepository, TransactionRepository],
})
export class OrderModule {}
