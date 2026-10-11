export const COURIER_ADAPTER = Symbol('COURIER_ADAPTER');

export interface CourierOrderInfo {
  orderId: string;
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  address: string;
  apartment: string | null;
  entrance: string | null;
  floor: string | null;
  intercom: string | null;
  comment: string | null;
  latitude: number | null;
  longitude: number | null;
  totalAmount: number;
  items: { name: string; quantity: number; unitPrice: number; weightGrams: number }[];
}

export interface CourierClaim {
  externalId: string;
  status: string;
  price?: number | null;
  trackingUrl?: string | null;
  courierName?: string | null;
  courierPhone?: string | null;
  /** Какой статус заказа соответствует состоянию доставки */
  orderStatus?: 'HANDED_TO_COURIER' | 'COMPLETED' | null;
  /** Заявка завершена или отменена — больше не опрашивать */
  final?: boolean;
  raw?: unknown;
}

/** Адаптер курьерской службы. Реализации: test (эмулятор) и yandex (Яндекс Доставка). */
export interface CourierAdapter {
  readonly provider: string;
  createClaim(order: CourierOrderInfo): Promise<CourierClaim>;
  getClaim(externalId: string): Promise<CourierClaim>;
  cancelClaim(externalId: string): Promise<void>;
}

/** Человекочитаемые статусы заявки (статусы Яндекс Доставки) */
export const COURIER_STATUS_LABELS: Record<string, string> = {
  new: 'Заявка создана',
  estimating: 'Расчёт стоимости',
  ready_for_approval: 'Ожидает подтверждения',
  accepted: 'Подтверждена',
  performer_lookup: 'Ищем курьера',
  performer_draft: 'Ищем курьера',
  performer_found: 'Курьер назначен',
  pickup_arrived: 'Курьер в кондитерской',
  ready_for_pickup_confirmation: 'Курьер забирает заказ',
  pickuped: 'Курьер забрал заказ',
  delivery_arrived: 'Курьер у клиента',
  delivered: 'Доставлено',
  delivered_finish: 'Доставлено',
  cancelled: 'Отменена',
  cancelled_by_taxi: 'Отменена службой',
  failed: 'Ошибка',
};
