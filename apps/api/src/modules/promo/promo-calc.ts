import type { PromoCodeType } from '@kirilovskiy/shared';

export interface PromoRule {
  type: PromoCodeType;
  value: number;
  maxDiscountAmount: number | null;
}

/** Скидка в копейках. Процентная скидка округляется вниз до целых рублей. */
export function calcDiscount(rule: PromoRule, subtotal: number): number {
  if (subtotal <= 0) return 0;
  let discount =
    rule.type === 'PERCENT'
      ? Math.floor((subtotal * Math.min(rule.value, 100)) / 100 / 100) * 100
      : rule.value;
  if (rule.maxDiscountAmount !== null && rule.maxDiscountAmount >= 0) {
    discount = Math.min(discount, rule.maxDiscountAmount);
  }
  return Math.max(0, Math.min(discount, subtotal));
}
