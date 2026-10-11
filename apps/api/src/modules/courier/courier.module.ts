import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';
import { OrdersModule } from '../orders/orders.module';
import { COURIER_ADAPTER, type CourierAdapter } from './adapters/courier-adapter';
import { TestCourierAdapter } from './adapters/test-courier.adapter';
import { YandexCourierAdapter } from './adapters/yandex-courier.adapter';
import { CourierController } from './courier.controller';
import { CourierService } from './courier.service';

@Module({
  imports: [OrdersModule],
  controllers: [CourierController],
  providers: [
    {
      provide: COURIER_ADAPTER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): CourierAdapter =>
        config.get('providers', { infer: true }).courier === 'yandex'
          ? new YandexCourierAdapter(config.get('yandexDelivery', { infer: true }))
          : new TestCourierAdapter(),
    },
    CourierService,
  ],
})
export class CourierModule {}
