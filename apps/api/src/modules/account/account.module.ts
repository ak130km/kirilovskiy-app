import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { AccountController, DevicesController } from './account.controller';
import { AccountService } from './account.service';

@Module({
  imports: [OrdersModule],
  controllers: [AccountController, DevicesController],
  providers: [AccountService],
})
export class AccountModule {}
