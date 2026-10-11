import type { OrderStatus } from '@prisma/client';

/** Доменные события заказа (EventEmitter2) */
export const OrderEvents = {
  CREATED: 'order.created',
  PAID: 'order.paid',
  STATUS_CHANGED: 'order.status_changed',
  CANCELLED: 'order.cancelled',
} as const;

export interface OrderEventPayload {
  orderId: string;
}

export interface OrderStatusChangedPayload extends OrderEventPayload {
  from: OrderStatus;
  to: OrderStatus;
}
