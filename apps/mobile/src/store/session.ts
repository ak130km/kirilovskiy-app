import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CustomerDto, FulfillmentType, PaymentMethod } from '@kirilovskiy/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { secureStorage } from '@/lib/storage';

const TOKEN_KEY = 'kirilovskiy.customerToken';

/** Гостевой заказ, созданный на этом устройстве: токен даёт доступ к статусу без аккаунта */
export interface GuestOrderRef {
  id: string;
  accessToken: string;
  number: number;
  createdAt: string;
}

/** Данные последнего оформления — чтобы не вводить заново */
export interface CheckoutDefaults {
  customerName: string;
  customerPhone: string;
  fulfillmentType: FulfillmentType;
  deliveryZoneId?: string;
  address: string;
  apartment: string;
  entrance: string;
  floor: string;
  intercom: string;
  paymentMethod: PaymentMethod;
}

interface SessionState {
  token: string | null;
  customer: CustomerDto | null;
  guestOrders: GuestOrderRef[];
  deviceId: string | null;
  checkout: Partial<CheckoutDefaults>;
  hydrated: boolean;
  signIn: (token: string, customer: CustomerDto) => Promise<void>;
  signOut: () => Promise<void>;
  setCustomer: (customer: CustomerDto) => void;
  addGuestOrder: (ref: GuestOrderRef) => void;
  orderToken: (orderId: string) => string | undefined;
  setDeviceId: (id: string | null) => void;
  saveCheckout: (data: Partial<CheckoutDefaults>) => void;
  forgetEverything: () => Promise<void>;
}

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      token: null,
      customer: null,
      guestOrders: [],
      deviceId: null,
      checkout: {},
      hydrated: false,
      signIn: async (token, customer) => {
        await secureStorage.set(TOKEN_KEY, token);
        set({ token, customer });
      },
      signOut: async () => {
        await secureStorage.set(TOKEN_KEY, null);
        set({ token: null, customer: null });
      },
      setCustomer: (customer) => set({ customer }),
      addGuestOrder: (ref) => set((s) => ({ guestOrders: [ref, ...s.guestOrders.filter((o) => o.id !== ref.id)].slice(0, 100) })),
      orderToken: (orderId) => get().guestOrders.find((o) => o.id === orderId)?.accessToken,
      setDeviceId: (deviceId) => set({ deviceId }),
      saveCheckout: (data) => set((s) => ({ checkout: { ...s.checkout, ...data } })),
      /** После удаления аккаунта стираем персональные данные с устройства */
      forgetEverything: async () => {
        await secureStorage.set(TOKEN_KEY, null);
        set({ token: null, customer: null, guestOrders: [], checkout: {} });
      },
    }),
    {
      name: 'kirilovskiy.session',
      storage: createJSONStorage(() => AsyncStorage),
      // Токен хранится отдельно в защищённом хранилище
      partialize: (s) => ({ customer: s.customer, guestOrders: s.guestOrders, deviceId: s.deviceId, checkout: s.checkout }),
      onRehydrateStorage: () => async (state) => {
        const token = await secureStorage.get(TOKEN_KEY);
        useSession.setState({ token, customer: token ? (state?.customer ?? null) : null, hydrated: true });
      },
    },
  ),
);
