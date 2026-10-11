import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface CartLine {
  productId: string;
  name: string;
  price: number; // коп., цена на момент добавления — для быстрого показа; итог считает сервер
  imageUrl: string | null;
  weightGrams: number;
  quantity: number;
}

interface CartState {
  lines: CartLine[];
  promoCode: string;
  add: (item: Omit<CartLine, 'quantity'>, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  setPromoCode: (code: string) => void;
  replaceAll: (lines: CartLine[]) => void;
}

export const MAX_QTY = 50;

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      promoCode: '',
      add: (item, quantity = 1) =>
        set((s) => {
          const existing = s.lines.find((l) => l.productId === item.productId);
          if (existing) {
            return {
              lines: s.lines.map((l) =>
                l.productId === item.productId ? { ...l, ...item, quantity: Math.min(MAX_QTY, l.quantity + quantity) } : l,
              ),
            };
          }
          return { lines: [...s.lines, { ...item, quantity: Math.min(MAX_QTY, quantity) }] };
        }),
      setQuantity: (productId, quantity) =>
        set((s) => ({
          lines:
            quantity <= 0
              ? s.lines.filter((l) => l.productId !== productId)
              : s.lines.map((l) => (l.productId === productId ? { ...l, quantity: Math.min(MAX_QTY, quantity) } : l)),
        })),
      remove: (productId) => set((s) => ({ lines: s.lines.filter((l) => l.productId !== productId) })),
      clear: () => set({ lines: [], promoCode: '' }),
      setPromoCode: (promoCode) => set({ promoCode }),
      replaceAll: (lines) => set({ lines }),
    }),
    { name: 'kirilovskiy.cart', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

export const cartCount = (lines: CartLine[]) => lines.reduce((s, l) => s + l.quantity, 0);
export const cartSubtotal = (lines: CartLine[]) => lines.reduce((s, l) => s + l.price * l.quantity, 0);
