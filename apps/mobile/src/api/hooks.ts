import type {
  CartQuoteDto,
  CategoryDto,
  DayAvailabilityDto,
  DeliveryZoneDto,
  FulfillmentType,
  OrderDto,
  ProductDetailsDto,
  ProductListItemDto,
  StoreSettings,
} from '@kirilovskiy/shared';
import { ACTIVE_ORDER_STATUSES } from '@kirilovskiy/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSession } from '@/store/session';
import { api } from './client';

export const queryKeys = {
  order: (id: string) => ['order', id] as const,
  orders: ['orders'] as const,
};

export function useStoreInfo() {
  return useQuery({ queryKey: ['store'], queryFn: () => api.get<StoreSettings>('/store'), staleTime: 5 * 60_000 });
}

export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: () => api.get<CategoryDto[]>('/catalog/categories') });
}

export function useProducts(params: { category?: string; featured?: boolean }) {
  const qs = new URLSearchParams();
  if (params.category) qs.set('category', params.category);
  if (params.featured) qs.set('featured', 'true');
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => api.get<ProductListItemDto[]>(`/catalog/products?${qs}`),
  });
}

export function useProduct(id: string) {
  return useQuery({ queryKey: ['product', id], queryFn: () => api.get<ProductDetailsDto>(`/catalog/products/${id}`) });
}

export function useZones() {
  return useQuery({ queryKey: ['zones'], queryFn: () => api.get<DeliveryZoneDto[]>('/delivery/zones'), staleTime: 5 * 60_000 });
}

export function useAvailability(type: FulfillmentType, productIds: string[]) {
  const ids = [...productIds].sort().join(',');
  return useQuery({
    queryKey: ['availability', type, ids],
    queryFn: () => api.get<DayAvailabilityDto[]>(`/delivery/availability?type=${type}&productIds=${ids}`),
    refetchInterval: 60_000,
  });
}

export function useCartQuote(input: {
  items: { productId: string; quantity: number }[];
  fulfillmentType?: FulfillmentType;
  deliveryZoneId?: string;
  promoCode?: string;
}) {
  return useQuery({
    queryKey: ['quote', input],
    queryFn: () => api.post<CartQuoteDto>('/cart/quote', input),
    enabled: input.items.length > 0,
    placeholderData: keepPreviousData,
  });
}

export function useOrder(id: string) {
  const token = useSession((s) => s.guestOrders.find((o) => o.id === id)?.accessToken);
  return useQuery({
    queryKey: queryKeys.order(id),
    queryFn: () => api.get<OrderDto>(`/orders/${id}`, { orderToken: token }),
    // Активный заказ обновляем раз в 15 секунд (дополнительно к push)
    refetchInterval: (q) => (q.state.data && ACTIVE_ORDER_STATUSES.includes(q.state.data.status) ? 15_000 : false),
  });
}

/** История: заказы аккаунта + гостевые заказы этого устройства */
export function useOrderHistory() {
  const token = useSession((s) => s.token);
  const guest = useSession((s) => s.guestOrders);
  return useQuery({
    queryKey: [...queryKeys.orders, token ? 'auth' : 'guest', guest.length],
    queryFn: async () => {
      const [mine, guestOrders] = await Promise.all([
        token ? api.get<OrderDto[]>('/me/orders') : Promise.resolve([]),
        guest.length
          ? api.post<OrderDto[]>('/orders/lookup', { orders: guest.map((g) => ({ id: g.id, accessToken: g.accessToken })) }, { anonymous: true })
          : Promise.resolve([]),
      ]);
      const map = new Map<string, OrderDto>();
      [...mine, ...guestOrders].forEach((o) => map.set(o.id, o));
      return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
  });
}
