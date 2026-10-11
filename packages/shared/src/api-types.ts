// Формы ответов и запросов REST API (/api/v1).
// Даты и моменты времени передаются строками ISO 8601, суммы — в копейках.

import type {
  FulfillmentType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PromoCodeType,
  StaffRole,
} from './enums';

// ─────────── Каталог ───────────

export interface AllergenDto {
  id: string;
  code: string;
  name: string;
}

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  productCount: number;
}

export interface ProductListItemDto {
  id: string;
  slug: string;
  name: string;
  categoryId: string;
  price: number;
  oldPrice: number | null;
  weightGrams: number;
  imageUrl: string | null;
  isAvailable: boolean;
  isFeatured: boolean;
  leadTimeHours: number;
}

export interface ProductImageDto {
  id: string;
  url: string;
  sortOrder: number;
}

export interface ProductDetailsDto extends ProductListItemDto {
  description: string | null;
  composition: string | null;
  storageConditions: string | null;
  caloriesKcal: number | null;
  proteins: number | null;
  fats: number | null;
  carbohydrates: number | null;
  images: ProductImageDto[];
  allergens: AllergenDto[];
  category: { id: string; name: string; slug: string };
}

// ─────────── Магазин, доставка, слоты ───────────

export interface StoreSettings {
  name: string;
  phone: string;
  pickupAddress: string;
  pickupHours: string;
  minOrderAmount: number;
  minLeadTimeMinutes: number;
  orderHorizonDays: number;
  paymentTimeoutMinutes: number;
  acceptingOrders: boolean;
  acceptingOrdersMessage: string;
  privacyPolicyUrl: string;
}

export interface DeliveryZoneDto {
  id: string;
  name: string;
  description: string | null;
  price: number;
  freeFromAmount: number | null;
  minOrderAmount: number;
  estimatedMinutes: number | null;
}

export interface SlotAvailabilityDto {
  id: string;
  startMinutes: number;
  endMinutes: number;
  label: string;
  available: boolean;
  remaining: number;
}

export interface DayAvailabilityDto {
  date: string; // YYYY-MM-DD по Москве
  label: string; // «пн, 12 октября»
  isToday: boolean;
  slots: SlotAvailabilityDto[];
}

// ─────────── Корзина и заказ ───────────

export interface CartItemInput {
  productId: string;
  quantity: number;
}

export interface CartQuoteRequest {
  items: CartItemInput[];
  fulfillmentType?: FulfillmentType;
  deliveryZoneId?: string;
  promoCode?: string;
}

export interface CartQuoteItemDto {
  productId: string;
  name: string;
  imageUrl: string | null;
  unitPrice: number;
  weightGrams: number;
  quantity: number;
  totalAmount: number;
  isAvailable: boolean;
  unavailableReason: string | null;
}

export interface CartQuoteDto {
  items: CartQuoteItemDto[];
  subtotalAmount: number;
  deliveryAmount: number;
  discountAmount: number;
  totalAmount: number;
  minOrderAmount: number;
  leadTimeHours: number;
  promoCode: { code: string; applied: boolean; message: string } | null;
  canCheckout: boolean;
  problems: string[];
}

export interface CreateOrderRequest {
  items: CartItemInput[];
  fulfillmentType: FulfillmentType;
  deliveryZoneId?: string;
  address?: string;
  apartment?: string;
  entrance?: string;
  floor?: string;
  intercom?: string;
  latitude?: number;
  longitude?: number;
  deliveryDate: string; // YYYY-MM-DD
  timeSlotId: string;
  customerName: string;
  customerPhone: string;
  comment?: string;
  paymentMethod: PaymentMethod;
  promoCode?: string;
  deviceId?: string;
}

export interface OrderItemDto {
  id: string;
  productId: string | null;
  productName: string;
  imageUrl: string | null;
  unitPrice: number;
  weightGrams: number;
  quantity: number;
  totalAmount: number;
}

export interface OrderStatusHistoryDto {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actor: 'CUSTOMER' | 'STAFF' | 'SYSTEM' | 'INTEGRATION';
  staffName: string | null;
  comment: string | null;
  createdAt: string;
}

export interface OrderDto {
  id: string;
  number: number;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  customerName: string;
  customerPhone: string;
  comment: string | null;
  deliveryZone: { id: string; name: string } | null;
  address: string | null;
  apartment: string | null;
  entrance: string | null;
  floor: string | null;
  intercom: string | null;
  pickupAddress: string | null;
  deliveryDate: string;
  slotStartMinutes: number;
  slotEndMinutes: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  subtotalAmount: number;
  deliveryAmount: number;
  discountAmount: number;
  totalAmount: number;
  promoCode: string | null;
  cancelReason: string | null;
  canPay: boolean;
  createdAt: string;
  paidAt: string | null;
  items: OrderItemDto[];
  history: OrderStatusHistoryDto[];
}

export interface CreateOrderResponse {
  order: OrderDto;
  /** Секрет для доступа гостя к заказу: заголовок X-Order-Token */
  accessToken: string;
}

export interface PaymentStartResponse {
  paymentId: string;
  status: PaymentStatus;
  confirmationUrl: string | null;
}

export interface ReorderItemDto {
  productId: string;
  name: string;
  imageUrl: string | null;
  price: number;
  quantity: number;
  isAvailable: boolean;
}

export interface ReorderResponse {
  items: ReorderItemDto[];
  unavailable: string[];
}

export interface PromoValidationDto {
  code: string;
  valid: boolean;
  discountAmount: number;
  message: string;
}

// ─────────── Клиент ───────────

export interface CustomerDto {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  createdAt: string;
}

export interface OtpRequestResponse {
  sent: boolean;
  retryAfterSeconds: number;
  /** Только в режиме разработки (SMS_PROVIDER=log) */
  devCode?: string;
}

export interface CustomerAuthResponse {
  accessToken: string;
  customer: CustomerDto;
}

export interface DeviceDto {
  id: string;
}

// ─────────── Админ-панель ───────────

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface StaffDto {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface StaffAuthResponse {
  accessToken: string;
  staff: StaffDto;
}

export interface PaymentDto {
  id: string;
  provider: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  refundedAmount: number;
  externalId: string | null;
  failureReason: string | null;
  createdAt: string;
  paidAt: string | null;
}

export interface CourierDeliveryDto {
  id: string;
  provider: string;
  externalId: string | null;
  status: string;
  price: number | null;
  trackingUrl: string | null;
  courierName: string | null;
  courierPhone: string | null;
  createdAt: string;
}

export interface AdminOrderDto extends OrderDto {
  customerId: string | null;
  source: string;
  nextStatuses: OrderStatus[];
  payments: PaymentDto[];
  courier: CourierDeliveryDto | null;
  confirmedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface AdminOrderListItemDto {
  id: string;
  number: number;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  customerName: string;
  customerPhone: string;
  deliveryDate: string;
  slotStartMinutes: number;
  slotEndMinutes: number;
  address: string | null;
  deliveryZoneName: string | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  itemsCount: number;
  itemsSummary: string;
  comment: string | null;
  nextStatuses: OrderStatus[];
  createdAt: string;
  paidAt: string | null;
}

export interface AdminOrderCounts {
  new: number;
  inProgress: number;
  ready: number;
  unpaid: number;
}

export interface AdminProductDto extends ProductDetailsDto {
  isActive: boolean;
  inStopList: boolean;
  stopListReason: string | null;
  stopListUntil: string | null;
  sortOrder: number;
  externalId: string | null;
  archivedAt: string | null;
  updatedAt: string;
}

export interface AdminCategoryDto extends CategoryDto {
  isActive: boolean;
}

export interface AdminDeliveryZoneDto extends DeliveryZoneDto {
  isActive: boolean;
  sortOrder: number;
  polygon: unknown | null;
}

export interface TimeSlotDto {
  id: string;
  fulfillmentType: FulfillmentType | null;
  startMinutes: number;
  endMinutes: number;
  weekdays: number[];
  capacity: number;
  isActive: boolean;
  sortOrder: number;
}

export interface BlackoutDateDto {
  id: string;
  date: string;
  reason: string | null;
}

export interface PromoCodeDto {
  id: string;
  code: string;
  description: string | null;
  type: PromoCodeType;
  value: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  usageLimitPerCustomer: number | null;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface AuditLogDto {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  changes: unknown;
  ip: string | null;
  createdAt: string;
  staff: { id: string; name: string; email: string } | null;
}

/** Событие из SSE-потока /admin/orders/stream */
export interface OrderStreamEvent {
  type: 'order.created' | 'order.paid' | 'order.updated';
  orderId: string;
  number: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  at: string;
}

/** Ошибка API */
export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
}
