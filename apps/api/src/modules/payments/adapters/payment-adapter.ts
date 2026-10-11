import type { PaymentMethod, PaymentStatus } from '@prisma/client';

export const PAYMENT_ADAPTER = Symbol('PAYMENT_ADAPTER');

export interface CreatePaymentParams {
  paymentId: string;
  orderId: string;
  orderNumber: number;
  amount: number; // коп.
  method: PaymentMethod;
  description: string;
  returnUrl: string;
  customerPhone: string;
}

export interface CreatePaymentResult {
  externalId: string;
  /** Куда отправить клиента: платёжная форма банка или ссылка СБП. Может быть относительной (тестовый провайдер). */
  confirmationUrl: string | null;
  status: PaymentStatus;
  raw?: unknown;
}

export interface PaymentStatusResult {
  status: PaymentStatus;
  failureReason?: string;
  raw?: unknown;
}

/**
 * Платёжный адаптер. Реализации: test (встроенная страница оплаты) и alfabank (карта и СБП).
 * Новый банк подключается новой реализацией без изменений в заказах.
 */
export interface PaymentAdapter {
  readonly provider: string;
  createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult>;
  getStatus(externalId: string): Promise<PaymentStatusResult>;
  refund(externalId: string, amount: number): Promise<{ success: boolean; raw?: unknown }>;
  /** Проверяет уведомление от провайдера и возвращает id платежа у провайдера */
  parseWebhook(input: { query: Record<string, string>; body: unknown }): Promise<{ externalId: string } | null>;
}
