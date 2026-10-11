import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';
import { AlfaBankPaymentAdapter } from './adapters/alfabank-payment.adapter';
import { PAYMENT_ADAPTER, type PaymentAdapter } from './adapters/payment-adapter';
import { TestPaymentAdapter } from './adapters/test-payment.adapter';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  controllers: [PaymentsController],
  providers: [
    {
      provide: PAYMENT_ADAPTER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>): PaymentAdapter => {
        switch (config.get('providers', { infer: true }).payment) {
          case 'alfabank':
            return new AlfaBankPaymentAdapter(config.get('alfabank', { infer: true }), config.get('publicUrl', { infer: true }));
          default:
            return new TestPaymentAdapter();
        }
      },
    },
    PaymentsService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
