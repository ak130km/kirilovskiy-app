import { Logger } from '@nestjs/common';
import type {
  CreatePaymentParams,
  CreatePaymentResult,
  PaymentAdapter,
  PaymentStatusResult,
} from './payment-adapter';

/**
 * Тестовый платёжный провайдер для разработки и демонстрации.
 * Клиент попадает на страницу /api/v1/payments/test/:paymentId, где можно «оплатить» или «отклонить» платёж.
 * Статус платежа хранится в БД, поэтому getStatus ничего не меняет.
 */
export class TestPaymentAdapter implements PaymentAdapter {
  readonly provider = 'test';
  private readonly logger = new Logger('TestPayment');

  async createPayment(p: CreatePaymentParams): Promise<CreatePaymentResult> {
    this.logger.log(`Платёж ${p.paymentId}: заказ №${p.orderNumber}, ${p.amount / 100} ₽, ${p.method}`);
    return {
      externalId: `test_${p.paymentId}`,
      confirmationUrl: `/api/v1/payments/test/${p.paymentId}`,
      status: 'PENDING',
    };
  }

  async getStatus(): Promise<PaymentStatusResult> {
    return { status: 'PENDING' };
  }

  async refund(externalId: string, amount: number) {
    this.logger.log(`Возврат ${amount / 100} ₽ по платежу ${externalId}`);
    return { success: true };
  }

  async parseWebhook() {
    return null;
  }
}
