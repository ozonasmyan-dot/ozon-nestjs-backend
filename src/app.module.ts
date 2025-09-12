import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { TransactionModule } from './transaction/transaction.module';
import { OrderModule } from './order/order.module';
import { APP_CONSTANTS } from './config/constants';

@Module({
  imports: [PrismaModule, TransactionModule, OrderModule],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: 'APP_CONSTANTS',
      useValue: APP_CONSTANTS,
    },
  ],
})
export class AppModule {}
