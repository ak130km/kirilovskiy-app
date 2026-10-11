import { FulfillmentType, OrderStatus } from './enums';

/** Статусы, в которых заказ ещё в работе */
export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  'NEW',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'HANDED_TO_COURIER',
];

export const FINAL_ORDER_STATUSES: OrderStatus[] = ['COMPLETED', 'CANCELLED'];

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['HANDED_TO_COURIER', 'COMPLETED', 'CANCELLED'],
  HANDED_TO_COURIER: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

/** Допустимые следующие статусы с учётом способа получения */
export function getNextStatuses(status: OrderStatus, fulfillment: FulfillmentType): OrderStatus[] {
  return TRANSITIONS[status].filter((next) => {
    if (next === 'HANDED_TO_COURIER') return fulfillment === 'DELIVERY';
    if (status === 'READY' && next === 'COMPLETED') return fulfillment === 'PICKUP';
    return true;
  });
}

export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  fulfillment: FulfillmentType,
): boolean {
  return getNextStatuses(from, fulfillment).includes(to);
}

/** Этапы, которые клиент видит на шкале прогресса */
export function getCustomerStatusSteps(fulfillment: FulfillmentType): OrderStatus[] {
  return fulfillment === 'DELIVERY'
    ? ['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'HANDED_TO_COURIER', 'COMPLETED']
    : ['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED'];
}

/** Подпись кнопки перехода в админке */
export const STATUS_ACTION_LABELS: Record<OrderStatus, string> = {
  NEW: 'Новый',
  CONFIRMED: 'Принять',
  PREPARING: 'Начать готовить',
  READY: 'Готов',
  HANDED_TO_COURIER: 'Передан курьеру',
  COMPLETED: 'Выполнен',
  CANCELLED: 'Отменить',
};

/** Тексты push-уведомлений клиенту при смене статуса */
export function getStatusPushText(
  status: OrderStatus,
  orderNumber: number,
  fulfillment: FulfillmentType,
  cancelReason?: string | null,
): { title: string; body: string } | null {
  const n = `№ ${orderNumber}`;
  switch (status) {
    case 'CONFIRMED':
      return { title: `Заказ ${n} подтверждён`, body: 'Мы приняли заказ и скоро начнём его готовить.' };
    case 'PREPARING':
      return { title: `Готовим заказ ${n}`, body: 'Кондитеры уже работают над вашими десертами.' };
    case 'READY':
      return fulfillment === 'PICKUP'
        ? { title: `Заказ ${n} готов`, body: 'Ждём вас в кондитерской!' }
        : { title: `Заказ ${n} готов`, body: 'Скоро передадим его курьеру.' };
    case 'HANDED_TO_COURIER':
      return { title: `Заказ ${n} в пути`, body: 'Курьер уже везёт ваши десерты.' };
    case 'COMPLETED':
      return { title: `Заказ ${n} выполнен`, body: 'Спасибо! Приятного аппетита.' };
    case 'CANCELLED':
      return {
        title: `Заказ ${n} отменён`,
        body: cancelReason ? `Причина: ${cancelReason}` : 'Если заказ был оплачен, деньги вернутся на карту.',
      };
    default:
      return null;
  }
}
