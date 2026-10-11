import { createHmac } from 'crypto';
import type { PaymentStatus } from '@prisma/client';
import type { AppConfig } from '../../../config/configuration';
import { safeEqual } from '../../../common/utils/crypto';
import { httpJson } from '../../integrations/http';
import type {
  CreatePaymentParams,
  CreatePaymentResult,
  PaymentAdapter,
  PaymentStatusResult,
} from './payment-adapter';

interface AlfaResponse {
  errorCode?: string | number;
  errorMessage?: string;
}

/**
 * Интернет-эквайринг Альфа-Банка (REST API платёжного шлюза): карта и СБП.
 *
 * Каркас для боевой интеграции — перед запуском проверить на тестовом стенде банка
 * (ALFABANK_API_URL=https://alfa.rbsuat.com/payment/rest) по актуальной документации:
 *  - register.do — регистрация заказа, ответ { orderId, formUrl };
 *  - sbp/c2b/qr/dynamic/get.do — динамический QR / ссылка СБП по mdOrder;
 *  - getOrderStatusExtended.do — статус (orderStatus: 2 — оплачен, 4 — возврат, 6 — отклонён);
 *  - refund.do — возврат;
 *  - callback-уведомления с контрольной суммой HMAC-SHA256.
 * Фискализация чеков (54-ФЗ) настраивается на стороне банка или облачной кассы.
 */
export class AlfaBankPaymentAdapter implements PaymentAdapter {
  readonly provider = 'alfabank';

  constructor(
    private readonly cfg: AppConfig['alfabank'],
    private readonly publicUrl: string,
  ) {}

  private assertConfigured() {
    if (!this.cfg.token && !(this.cfg.userName && this.cfg.password)) {
      throw new Error('Альфа-Банк не настроен: задайте ALFABANK_TOKEN или ALFABANK_USERNAME/ALFABANK_PASSWORD');
    }
  }

  private async call<T extends AlfaResponse>(method: string, params: Record<string, string | number>): Promise<T> {
    this.assertConfigured();
    const auth = this.cfg.token ? { token: this.cfg.token } : { userName: this.cfg.userName, password: this.cfg.password };
    const body = new URLSearchParams(
      Object.entries({ ...auth, ...params }).map(([k, v]): [string, string] => [k, String(v)]),
    );
    const res = await httpJson<T>(`${this.cfg.apiUrl.replace(/\/$/, '')}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (res.errorCode !== undefined && String(res.errorCode) !== '0') {
      throw new Error(`Альфа-Банк ${method}: ${res.errorMessage ?? res.errorCode}`);
    }
    return res;
  }

  async createPayment(p: CreatePaymentParams): Promise<CreatePaymentResult> {
    const reg = await this.call<AlfaResponse & { orderId: string; formUrl: string }>('register.do', {
      // Номер должен быть уникальным для каждой попытки оплаты
      orderNumber: `${p.orderNumber}-${p.paymentId.slice(0, 8)}`,
      amount: p.amount,
      currency: 643,
      language: 'ru',
      description: p.description,
      returnUrl: this.cfg.returnUrl || p.returnUrl,
      failUrl: this.cfg.returnUrl || p.returnUrl,
      dynamicCallbackUrl: `${this.publicUrl}/api/v1/payments/webhook/alfabank`,
      jsonParams: JSON.stringify({ phone: p.customerPhone, appOrderId: p.orderId }),
    });

    if (p.method === 'SBP') {
      const qr = await this.call<AlfaResponse & { payload?: string; qrId?: string }>('sbp/c2b/qr/dynamic/get.do', {
        mdOrder: reg.orderId,
        qrFormat: 'matrix',
      });
      // payload — ссылка https://qr.nspk.ru/…, на телефоне открывает приложение банка
      return { externalId: reg.orderId, confirmationUrl: qr.payload ?? reg.formUrl, status: 'PENDING', raw: { reg, qr } };
    }
    return { externalId: reg.orderId, confirmationUrl: reg.formUrl, status: 'PENDING', raw: reg };
  }

  async getStatus(externalId: string): Promise<PaymentStatusResult> {
    const res = await this.call<AlfaResponse & { orderStatus?: number; actionCodeDescription?: string }>(
      'getOrderStatusExtended.do',
      { orderId: externalId },
    );
    const map: Record<number, PaymentStatus> = {
      0: 'PENDING', // зарегистрирован, не оплачен
      1: 'PENDING', // холдирование (двухстадийная оплата)
      2: 'SUCCEEDED',
      3: 'CANCELLED',
      4: 'REFUNDED',
      5: 'PENDING', // авторизация через ACS
      6: 'FAILED',
    };
    return {
      status: map[res.orderStatus ?? 0] ?? 'PENDING',
      failureReason: res.orderStatus === 6 ? res.actionCodeDescription : undefined,
      raw: res,
    };
  }

  async refund(externalId: string, amount: number) {
    const res = await this.call('refund.do', { orderId: externalId, amount });
    return { success: true, raw: res };
  }

  async parseWebhook({ query }: { query: Record<string, string>; body: unknown }) {
    const { checksum, mdOrder } = query;
    if (!mdOrder) return null;
    if (this.cfg.callbackSecret) {
      if (!checksum) return null;
      const data = Object.keys(query)
        .filter((k) => k !== 'checksum' && k !== 'sign_alias')
        .sort()
        .map((k) => `${k};${query[k]};`)
        .join('');
      const expected = createHmac('sha256', this.cfg.callbackSecret).update(data).digest('hex').toUpperCase();
      if (!safeEqual(expected, checksum.toUpperCase())) return null;
    }
    // Статус всё равно перепроверяется запросом getOrderStatusExtended
    return { externalId: mdOrder };
  }
}
