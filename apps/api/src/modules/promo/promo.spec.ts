import { calcDiscount } from './promo-calc';

describe('calcDiscount', () => {
  it('процент округляется вниз до рублей', () => {
    expect(calcDiscount({ type: 'PERCENT', value: 10, maxDiscountAmount: null }, 123_456)).toBe(12_300);
  });
  it('ограничение максимальной скидкой', () => {
    expect(calcDiscount({ type: 'PERCENT', value: 50, maxDiscountAmount: 50_000 }, 400_000)).toBe(50_000);
  });
  it('фиксированная скидка не больше суммы товаров', () => {
    expect(calcDiscount({ type: 'FIXED', value: 50_000, maxDiscountAmount: null }, 30_000)).toBe(30_000);
  });
});
