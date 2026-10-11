// Значения совпадают с enum-ами Prisma (apps/api/prisma/schema.prisma)

export const ORDER_STATUSES = [
  'NEW',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'HANDED_TO_COURIER',
  'COMPLETED',
  'CANCELLED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const FULFILLMENT_TYPES = ['DELIVERY', 'PICKUP'] as const;
export type FulfillmentType = (typeof FULFILLMENT_TYPES)[number];

export const PAYMENT_METHODS = ['CARD', 'SBP'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const STAFF_ROLES = ['ADMIN', 'MANAGER', 'OPERATOR'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const PROMO_CODE_TYPES = ['PERCENT', 'FIXED'] as const;
export type PromoCodeType = (typeof PROMO_CODE_TYPES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: 'Новый',
  CONFIRMED: 'Подтверждён',
  PREPARING: 'Готовится',
  READY: 'Готов',
  HANDED_TO_COURIER: 'Передан курьеру',
  COMPLETED: 'Выполнен',
  CANCELLED: 'Отменён',
};

export const FULFILLMENT_TYPE_LABELS: Record<FulfillmentType, string> = {
  DELIVERY: 'Доставка',
  PICKUP: 'Самовывоз',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CARD: 'Банковская карта',
  SBP: 'СБП',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'Ожидает оплаты',
  SUCCEEDED: 'Оплачен',
  FAILED: 'Ошибка оплаты',
  CANCELLED: 'Платёж отменён',
  REFUNDED: 'Возврат',
};

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  ADMIN: 'Администратор',
  MANAGER: 'Менеджер',
  OPERATOR: 'Оператор',
};

export const WEEKDAY_SHORT_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;
