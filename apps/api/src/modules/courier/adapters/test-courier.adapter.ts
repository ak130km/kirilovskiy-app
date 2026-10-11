import type { CourierAdapter, CourierClaim, CourierOrderInfo } from './courier-adapter';

/**
 * Эмулятор курьерской службы: статусы меняются со временем после создания заявки.
 * 0–30 с — поиск курьера, 30–60 с — курьер назначен, 1–3 мин — в пути, позже — доставлено.
 */
export class TestCourierAdapter implements CourierAdapter {
  readonly provider = 'test';
  private readonly cancelled = new Set<string>();

  async createClaim(order: CourierOrderInfo): Promise<CourierClaim> {
    return {
      externalId: `test-${Date.now()}-${order.orderNumber}`,
      status: 'performer_lookup',
      price: 45_000,
      trackingUrl: null,
    };
  }

  async getClaim(externalId: string): Promise<CourierClaim> {
    if (this.cancelled.has(externalId)) return { externalId, status: 'cancelled', final: true };
    const createdAt = Number(externalId.split('-')[1]) || Date.now();
    const elapsed = (Date.now() - createdAt) / 1000;
    const courier = { courierName: 'Тестовый курьер Иван', courierPhone: '+7 900 000-00-00' };
    if (elapsed < 30) return { externalId, status: 'performer_lookup' };
    if (elapsed < 60) return { externalId, status: 'performer_found', ...courier };
    if (elapsed < 180) return { externalId, status: 'pickuped', orderStatus: 'HANDED_TO_COURIER', ...courier };
    return { externalId, status: 'delivered_finish', orderStatus: 'COMPLETED', final: true, ...courier };
  }

  async cancelClaim(externalId: string): Promise<void> {
    this.cancelled.add(externalId);
  }
}
