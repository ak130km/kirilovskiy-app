import { Module } from '@nestjs/common';
import { DeliveryModule } from '../delivery/delivery.module';
import { PaymentsModule } from '../payments/payments.module';
import { PricingModule } from '../pricing/pricing.module';
import { AdminOrdersController } from './admin-orders.controller';
import { OrderStreamService } from './order-stream.service';
import { OrdersController } from './orders.controller';
import { OrdersScheduler } from './orders.scheduler';
import { OrdersService } from './orders.service';

@Module({
  imports: [PricingModule, DeliveryModule, PaymentsModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService, OrderStreamService, OrdersScheduler],
  exports: [OrdersService],
})
export class OrdersModule {}
