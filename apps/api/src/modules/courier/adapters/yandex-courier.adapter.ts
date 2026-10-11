import { randomUUID } from 'crypto';
import type { AppConfig } from '../../../config/configuration';
import { httpJson } from '../../integrations/http';
import type { CourierAdapter, CourierClaim, CourierOrderInfo } from './courier-adapter';

interface YandexClaim {
  id: string;
  status: string;
  version: number;
  pricing?: { offer?: { price?: string }; final_price?: string };
  performer_info?: { courier_name?: string; legal_name?: string };
  route_points?: { visit_status?: string }[];
}

/**
 * Яндекс Доставка (API «Доставка в день заказа», claims v2).
 * Каркас для боевой интеграции — проверить по актуальной документации:
 *  - POST /b2b/cargo/integration/v2/claims/create?request_id=…
 *  - POST /b2b/cargo/integration/v2/claims/accept?claim_id=…
 *  - POST /b2b/cargo/integration/v2/claims/info?claim_id=…
 *  - POST /b2b/cargo/integration/v2/claims/cancel?claim_id=…
 *  - POST /b2b/cargo/integration/v2/driver-voiceforwarding — телефон курьера
 * Для точки назначения нужны координаты: в следующих этапах добавить геокодер адреса.
 */
export class YandexCourierAdapter implements CourierAdapter {
  readonly provider = 'yandex';

  constructor(private readonly cfg: AppConfig['yandexDelivery']) {}

  private async post<T>(path: string, body: unknown): Promise<T> {
    if (!this.cfg.token) throw new Error('Яндекс Доставка не настроена: задайте YANDEX_DELIVERY_TOKEN');
    return httpJson<T>(`${this.cfg.apiUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.cfg.token}`,
        'Accept-Language': 'ru',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  async createClaim(o: CourierOrderInfo): Promise<CourierClaim> {
    if (o.latitude === null || o.longitude === null) {
      throw new Error('Для Яндекс Доставки нужны координаты адреса клиента');
    }
    const fullAddress = [o.address, o.apartment && `кв. ${o.apartment}`].filter(Boolean).join(', ');
    const claim = await this.post<YandexClaim>(`/b2b/cargo/integration/v2/claims/create?request_id=${randomUUID()}`, {
      items: o.items.map((i) => ({
        title: i.name,
        quantity: i.quantity,
        cost_value: (i.unitPrice / 100).toFixed(2),
        cost_currency: 'RUB',
        weight: i.weightGrams / 1000,
        pickup_point: 1,
        droppof_point: 2,
      })),
      route_points: [
        {
          point_id: 1,
          visit_order: 1,
          type: 'source',
          address: { fullname: this.cfg.sourceAddress, coordinates: [this.cfg.sourceLon, this.cfg.sourceLat] },
          contact: { name: 'Кондитерская Артёма Кирилловского', phone: this.cfg.contactPhone },
        },
        {
          point_id: 2,
          visit_order: 2,
          type: 'destination',
          address: {
            fullname: fullAddress,
            coordinates: [o.longitude, o.latitude],
            porch: o.entrance ?? undefined,
            sfloor: o.floor ?? undefined,
            sflat: o.apartment ?? undefined,
            door_code: o.intercom ?? undefined,
            comment: o.comment ?? undefined,
          },
          contact: { name: o.customerName, phone: o.customerPhone },
          external_order_id: String(o.orderNumber),
        },
      ],
      client_requirements: { taxi_class: 'courier' },
      comment: `Заказ №${o.orderNumber}. Хрупкое: кондитерские изделия, держать горизонтально.`,
      skip_confirmation: true,
    });
    return this.map(claim);
  }

  async getClaim(externalId: string): Promise<CourierClaim> {
    const claim = await this.post<YandexClaim>(`/b2b/cargo/integration/v2/claims/info?claim_id=${externalId}`, {});
    if (claim.status === 'ready_for_approval') {
      const accepted = await this.post<YandexClaim>(`/b2b/cargo/integration/v2/claims/accept?claim_id=${externalId}`, {
        version: claim.version,
      });
      return this.map(accepted);
    }
    return this.map(claim);
  }

  async cancelClaim(externalId: string): Promise<void> {
    const claim = await this.post<YandexClaim>(`/b2b/cargo/integration/v2/claims/info?claim_id=${externalId}`, {});
    await this.post(`/b2b/cargo/integration/v2/claims/cancel?claim_id=${externalId}`, {
      cancel_state: 'free',
      version: claim.version,
    });
  }

  private map(c: YandexClaim): CourierClaim {
    const price = c.pricing?.final_price ?? c.pricing?.offer?.price;
    const delivered = ['delivered', 'delivered_finish'].includes(c.status);
    const pickedUp = ['pickuped', 'delivery_arrived', 'ready_for_delivery_confirmation'].includes(c.status);
    return {
      externalId: c.id,
      status: c.status,
      price: price ? Math.round(Number(price) * 100) : null,
      courierName: c.performer_info?.courier_name ?? null,
      orderStatus: delivered ? 'COMPLETED' : pickedUp ? 'HANDED_TO_COURIER' : null,
      final: delivered || c.status.startsWith('cancelled') || c.status === 'failed',
      raw: c,
    };
  }
}
