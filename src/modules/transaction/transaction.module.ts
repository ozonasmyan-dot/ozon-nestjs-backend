import {Module} from '@nestjs/common';
import {PrismaModule} from '@/prisma/prisma.module';
import {TransactionService} from './transaction.service';
import {TransactionController} from './transaction.controller';
import {TransactionRepository} from './transaction.repository';
import {SellerApiModule} from '@/api/seller/seller.module';

@Module({
    imports: [PrismaModule, SellerApiModule],
    controllers: [TransactionController],
    providers: [TransactionService, TransactionRepository],
    exports: [TransactionService],
})
export class TransactionModule {
}
