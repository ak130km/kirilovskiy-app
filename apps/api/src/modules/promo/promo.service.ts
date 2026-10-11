import { Injectable } from '@nestjs/common';
import { formatRub } from '@kirilovskiy/shared';
import type { PromoCode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { calcDiscount } from './promo-calc';

export interface PromoEvaluation {
  code: string;
  valid: boolean;
  discountAmount: number;
  message: string;
  promo: PromoCode | null;
}

@Injectable()
export class PromoService {
  constructor(private readonly prisma: PrismaService) {}

  normalize(code: string): string {
    return code.trim().toUpperCase().replace(/\s+/g, '');
  }

  async evaluate(rawCode: string, subtotal: number, customerId?: string | null): Promise<PromoEvaluation> {
    const code = this.normalize(rawCode);
    const fail = (message: string): PromoEvaluation => ({ code, valid: false, discountAmount: 0, message, promo: null });

    const promo = await this.prisma.promoCode.findUnique({ where: { code } });
    const now = new Date();
    if (!promo || !promo.isActive) return fail('Промокод не найден');
    if (promo.startsAt && promo.startsAt > now) return fail('Промокод ещё не действует');
    if (promo.endsAt && promo.endsAt < now) return fail('Срок действия промокода истёк');
    if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
      return fail('Промокод больше не действует');
    }
    if (promo.usageLimitPerCustomer !== null && customerId) {
      const used = await this.prisma.order.count({
        where: { promoCodeId: promo.id, customerId, status: { not: 'CANCELLED' } },
      });
      if (used >= promo.usageLimitPerCustomer) return fail('Вы уже использовали этот промокод');
    }
    if (subtotal < promo.minOrderAmount) {
      return fail(`Промокод действует при заказе от ${formatRub(promo.minOrderAmount)}`);
    }
    const discountAmount = calcDiscount(promo, subtotal);
    return {
      code,
      valid: true,
      discountAmount,
      message: `Скидка ${formatRub(discountAmount)}`,
      promo,
    };
  }
}
