import { Injectable } from '@nestjs/common';
import type { StoreSettings } from '@kirilovskiy/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  name: 'Кондитерская Артёма Кирилловского',
  phone: '+7 (495) 000-00-00',
  pickupAddress: 'Москва, ул. Пример, д. 1 (адрес уточняется)',
  pickupHours: 'Ежедневно с 9:00 до 21:00',
  minOrderAmount: 100_000,
  minLeadTimeMinutes: 120,
  orderHorizonDays: 14,
  paymentTimeoutMinutes: 30,
  acceptingOrders: true,
  acceptingOrdersMessage: 'Сейчас мы не принимаем заказы. Попробуйте, пожалуйста, позже.',
  privacyPolicyUrl: '',
};

const STORE_KEY = 'store';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStore(): Promise<StoreSettings> {
    const row = await this.prisma.setting.findUnique({ where: { key: STORE_KEY } });
    return { ...DEFAULT_STORE_SETTINGS, ...((row?.value as Partial<StoreSettings>) ?? {}) };
  }

  async updateStore(patch: Partial<StoreSettings>): Promise<{ before: StoreSettings; after: StoreSettings }> {
    const before = await this.getStore();
    const after = { ...before, ...patch };
    await this.prisma.setting.upsert({
      where: { key: STORE_KEY },
      create: { key: STORE_KEY, value: after as unknown as Prisma.InputJsonValue },
      update: { value: after as unknown as Prisma.InputJsonValue },
    });
    return { before, after };
  }
}
