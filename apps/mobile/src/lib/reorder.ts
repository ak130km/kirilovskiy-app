import type { ReorderResponse } from '@kirilovskiy/shared';
import { api } from '@/api/client';
import { useCart } from '@/store/cart';
import { useSession } from '@/store/session';

/** «Повторить заказ»: доступные позиции с актуальными ценами добавляются в корзину */
export async function repeatOrder(orderId: string): Promise<ReorderResponse> {
  const orderToken = useSession.getState().orderToken(orderId);
  const res = await api.get<ReorderResponse>(`/orders/${orderId}/reorder`, { orderToken });
  const add = useCart.getState().add;
  for (const item of res.items.filter((i) => i.isAvailable)) {
    add({ productId: item.productId, name: item.name, price: item.price, imageUrl: item.imageUrl, weightGrams: 0 }, item.quantity);
  }
  return res;
}
