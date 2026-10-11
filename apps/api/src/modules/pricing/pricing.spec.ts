import { deliveryPrice, mergeItems } from './pricing.service';

describe('pricing', () => {
  it('объединяет одинаковые позиции', () => {
    expect(
      mergeItems([
        { productId: 'a', quantity: 2 },
        { productId: 'b', quantity: 1 },
        { productId: 'a', quantity: 3 },
      ]),
    ).toEqual([
      { productId: 'a', quantity: 5 },
      { productId: 'b', quantity: 1 },
    ]);
  });

  it('бесплатная доставка от порога', () => {
    const zone = { price: 40_000, freeFromAmount: 500_000 };
    expect(deliveryPrice(zone, 499_900)).toBe(40_000);
    expect(deliveryPrice(zone, 500_000)).toBe(0);
    expect(deliveryPrice({ price: 40_000, freeFromAmount: null }, 9_999_900)).toBe(40_000);
  });
});
