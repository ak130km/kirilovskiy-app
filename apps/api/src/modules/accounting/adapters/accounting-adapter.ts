export const ACCOUNTING_ADAPTER = Symbol('ACCOUNTING_ADAPTER');

export interface AccountingOrder {
  id: string;
  number: number;
  createdAt: string;
  paidAt: string | null;
  status: string;
  customer: { name: string; phone: string };
  fulfillmentType: 'DELIVERY' | 'PICKUP';
  deliveryDate: string;
  slot: string;
  address: string | null;
  comment: string | null;
  paymentMethod: string;
  items: { externalId: string | null; name: string; quantity: number; price: number; sum: number }[];
  subtotal: number;
  delivery: number;
  discount: number;
  total: number;
}

export interface AccountingCatalogItem {
  externalId: string;
  price?: number; // коп.
  inStock?: boolean;
}

/** Адаптер учётной системы. Реализации: noop (только журнал) и onec (1С:УНФ через HTTP-сервис). */
export interface AccountingAdapter {
  readonly provider: string;
  exportOrder(order: AccountingOrder): Promise<{ documentId?: string }>;
  cancelOrder(order: AccountingOrder): Promise<void>;
  fetchCatalog(): Promise<AccountingCatalogItem[]>;
}
