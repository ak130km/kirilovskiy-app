import type {
  AdminOrderDto,
  AdminOrderListItemDto,
  OrderDto,
  StoreSettings,
} from '@kirilovskiy/shared';
import { getNextStatuses } from '@kirilovskiy/shared';
import type { Prisma } from '@prisma/client';
import { fromDbDate } from '../../common/utils/moscow-time';

export const orderInclude = {
  items: { orderBy: { productName: 'asc' } },
  deliveryZone: { select: { id: true, name: true } },
  statusHistory: {
    orderBy: { createdAt: 'asc' },
    include: { staffUser: { select: { name: true } } },
  },
} satisfies Prisma.OrderInclude;

export const adminOrderInclude = {
  ...orderInclude,
  payments: { orderBy: { createdAt: 'desc' } },
  courierDelivery: true,
} satisfies Prisma.OrderInclude;

export type OrderFull = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;
export type AdminOrderFull = Prisma.OrderGetPayload<{ include: typeof adminOrderInclude }>;

const iso = (d: Date | null) => d?.toISOString() ?? null;

export function toOrderDto(o: OrderFull, store: StoreSettings, forStaff = false): OrderDto {
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    fulfillmentType: o.fulfillmentType,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    comment: o.comment,
    deliveryZone: o.deliveryZone,
    address: o.address,
    apartment: o.apartment,
    entrance: o.entrance,
    floor: o.floor,
    intercom: o.intercom,
    pickupAddress: o.fulfillmentType === 'PICKUP' ? store.pickupAddress : null,
    deliveryDate: fromDbDate(o.deliveryDate),
    slotStartMinutes: o.slotStartMinutes,
    slotEndMinutes: o.slotEndMinutes,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    subtotalAmount: o.subtotalAmount,
    deliveryAmount: o.deliveryAmount,
    discountAmount: o.discountAmount,
    totalAmount: o.totalAmount,
    promoCode: o.promoCodeValue,
    cancelReason: o.cancelReason,
    canPay:
      o.status === 'NEW' && (o.paymentStatus === 'PENDING' || o.paymentStatus === 'FAILED'),
    createdAt: o.createdAt.toISOString(),
    paidAt: iso(o.paidAt),
    items: o.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      imageUrl: i.imageUrl,
      unitPrice: i.unitPrice,
      weightGrams: i.weightGrams,
      quantity: i.quantity,
      totalAmount: i.totalAmount,
    })),
    history: o.statusHistory.map((h) => ({
      id: h.id,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      actor: h.actor,
      // Клиенту не показываем имена сотрудников
      staffName: forStaff ? (h.staffUser?.name ?? null) : null,
      comment: forStaff || h.toStatus === 'CANCELLED' ? h.comment : null,
      createdAt: h.createdAt.toISOString(),
    })),
  };
}

export function toAdminOrderDto(o: AdminOrderFull, store: StoreSettings): AdminOrderDto {
  return {
    ...toOrderDto(o, store, true),
    customerId: o.customerId,
    source: o.source,
    nextStatuses: getNextStatuses(o.status, o.fulfillmentType),
    confirmedAt: iso(o.confirmedAt),
    completedAt: iso(o.completedAt),
    cancelledAt: iso(o.cancelledAt),
    payments: o.payments.map((p) => ({
      id: p.id,
      provider: p.provider,
      method: p.method,
      status: p.status,
      amount: p.amount,
      refundedAmount: p.refundedAmount,
      externalId: p.externalId,
      failureReason: p.failureReason,
      createdAt: p.createdAt.toISOString(),
      paidAt: iso(p.paidAt),
    })),
    courier: o.courierDelivery
      ? {
          id: o.courierDelivery.id,
          provider: o.courierDelivery.provider,
          externalId: o.courierDelivery.externalId,
          status: o.courierDelivery.status,
          price: o.courierDelivery.price,
          trackingUrl: o.courierDelivery.trackingUrl,
          courierName: o.courierDelivery.courierName,
          courierPhone: o.courierDelivery.courierPhone,
          createdAt: o.courierDelivery.createdAt.toISOString(),
        }
      : null,
  };
}

export const adminListInclude = {
  items: { select: { productName: true, quantity: true } },
  deliveryZone: { select: { name: true } },
} satisfies Prisma.OrderInclude;

export type AdminListOrder = Prisma.OrderGetPayload<{ include: typeof adminListInclude }>;

export function toAdminListItem(o: AdminListOrder): AdminOrderListItemDto {
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    fulfillmentType: o.fulfillmentType,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    deliveryDate: fromDbDate(o.deliveryDate),
    slotStartMinutes: o.slotStartMinutes,
    slotEndMinutes: o.slotEndMinutes,
    address: o.address,
    deliveryZoneName: o.deliveryZone?.name ?? null,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    totalAmount: o.totalAmount,
    itemsCount: o.items.reduce((sum, i) => sum + i.quantity, 0),
    itemsSummary: o.items.map((i) => `${i.productName} ×${i.quantity}`).join(', '),
    comment: o.comment,
    nextStatuses: getNextStatuses(o.status, o.fulfillmentType),
    createdAt: o.createdAt.toISOString(),
    paidAt: iso(o.paidAt),
  };
}
