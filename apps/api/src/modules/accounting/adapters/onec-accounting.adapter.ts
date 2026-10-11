import type { AppConfig } from '../../../config/configuration';
import { httpJson } from '../../integrations/http';
import type { AccountingAdapter, AccountingCatalogItem, AccountingOrder } from './accounting-adapter';

/**
 * 1С:Управление нашей фирмой через HTTP-сервис публикации базы.
 * На стороне 1С публикуется HTTP-сервис (например, корневой URL «kirilovskiy») с методами:
 *   POST /hs/kirilovskiy/orders              — создать «Заказ покупателя» (ответ { documentId })
 *   POST /hs/kirilovskiy/orders/{number}/cancel — пометить заказ отменённым
 *   GET  /hs/kirilovskiy/catalog             — [{ externalId, price (руб.), inStock }]
 * Номенклатура сопоставляется по products.external_id (GUID номенклатуры 1С).
 */
export class OneCAccountingAdapter implements AccountingAdapter {
  readonly provider = 'onec';

  constructor(private readonly cfg: AppConfig['onec']) {}

  private headers() {
    if (!this.cfg.baseUrl) throw new Error('1С не настроена: задайте ONEC_BASE_URL, ONEC_USER, ONEC_PASSWORD');
    return {
      Authorization: `Basic ${Buffer.from(`${this.cfg.user}:${this.cfg.password}`).toString('base64')}`,
      'Content-Type': 'application/json; charset=utf-8',
    };
  }

  private url(path: string) {
    return `${this.cfg.baseUrl.replace(/\/$/, '')}/hs/kirilovskiy${path}`;
  }

  async exportOrder(order: AccountingOrder) {
    const res = await httpJson<{ documentId?: string }>(this.url('/orders'), {
      method: 'POST',
      headers: this.headers(),
      // 1С удобнее работать с рублями
      body: JSON.stringify({
        ...order,
        items: order.items.map((i) => ({ ...i, price: i.price / 100, sum: i.sum / 100 })),
        subtotal: order.subtotal / 100,
        delivery: order.delivery / 100,
        discount: order.discount / 100,
        total: order.total / 100,
      }),
    });
    return { documentId: res?.documentId };
  }

  async cancelOrder(order: AccountingOrder) {
    await httpJson(this.url(`/orders/${order.number}/cancel`), { method: 'POST', headers: this.headers(), body: '{}' });
  }

  async fetchCatalog(): Promise<AccountingCatalogItem[]> {
    const rows = await httpJson<{ externalId: string; price?: number; inStock?: boolean }[]>(this.url('/catalog'), {
      headers: this.headers(),
    });
    return rows.map((r) => ({
      externalId: r.externalId,
      price: r.price !== undefined ? Math.round(r.price * 100) : undefined,
      inStock: r.inStock,
    }));
  }
}
