import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthCustomer } from './auth/auth.types';
import { safeEqual, sha256 } from './utils/crypto';

export const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/**
 * Доступ к заказу: владелец-клиент (JWT) или гость с токеном заказа (заголовок X-Order-Token).
 * Чужой заказ отдаёт 404, чтобы нельзя было перебирать id.
 */
export async function assertOrderAccess(
  prisma: PrismaService,
  orderId: string,
  customer: AuthCustomer | undefined,
  token: string | undefined,
): Promise<void> {
  if (!isUuid(orderId)) throw new NotFoundException('Заказ не найден');
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { customerId: true, accessTokenHash: true },
  });
  if (order) {
    if (customer && order.customerId === customer.id) return;
    if (token && safeEqual(sha256(token), order.accessTokenHash)) return;
  }
  throw new NotFoundException('Заказ не найден');
}
