import { Module } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionController } from './transaction.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { TransactionRepository } from './transaction.repository';
import { SellerApiModule } from '@/api/seller/seller.module';

@Module({
  imports: [PrismaModule, SellerApiModule],
  controllers: [TransactionController],
  providers: [TransactionService, TransactionRepository],
})
export class TransactionModule {}
