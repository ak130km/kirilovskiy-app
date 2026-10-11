import { ConflictException, Injectable, Logger } from '@nestjs/common';
import type { CustomerDto, DeviceDto, OrderDto } from '@kirilovskiy/shared';
import { ACTIVE_ORDER_STATUSES } from '@kirilovskiy/shared';
import { safeEqual, sha256 } from '../../common/utils/crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { toCustomerDto } from '../auth/auth.service';
import { GuestOrderRefDto } from '../orders/orders.dto';
import { OrdersService } from '../orders/orders.service';
import { RegisterDeviceDto, UpdateProfileDto } from './account.dto';

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
  ) {}

  async me(customerId: string): Promise<CustomerDto> {
    return toCustomerDto(await this.prisma.customer.findUniqueOrThrow({ where: { id: customerId } }));
  }

  async update(customerId: string, dto: UpdateProfileDto): Promise<CustomerDto> {
    return toCustomerDto(await this.prisma.customer.update({ where: { id: customerId }, data: dto }));
  }

  orderHistory(customerId: string): Promise<OrderDto[]> {
    return this.orders.listForCustomer(customerId);
  }

  /** После входа гостевые заказы этого устройства привязываются к аккаунту */
  async claimOrders(customerId: string, refs: GuestOrderRefDto[]): Promise<{ claimed: number }> {
    const rows = await this.prisma.order.findMany({
      where: { id: { in: refs.map((r) => r.id) }, customerId: null },
      select: { id: true, accessTokenHash: true },
    });
    const ids = rows
      .filter((o) => refs.some((r) => r.id === o.id && safeEqual(sha256(r.accessToken), o.accessTokenHash)))
      .map((o) => o.id);
    if (ids.length) await this.prisma.order.updateMany({ where: { id: { in: ids } }, data: { customerId } });
    return { claimed: ids.length };
  }

  /** Регистрация push-токена. Без авторизации устройство отвязывается от аккаунта (выход). */
  async registerDevice(dto: RegisterDeviceDto, customerId: string | null): Promise<DeviceDto> {
    const device = await this.prisma.device.upsert({
      where: { expoPushToken: dto.expoPushToken },
      create: { expoPushToken: dto.expoPushToken, platform: dto.platform, customerId },
      update: { platform: dto.platform, customerId },
    });
    return { id: device.id };
  }

  /**
   * Удаление аккаунта (требование App Store и Google Play).
   * Персональные данные стираются, заказы обезличиваются: суммы и состав остаются для учёта.
   */
  async deleteAccount(customerId: string): Promise<void> {
    const active = await this.prisma.order.count({
      where: { customerId, status: { in: ACTIVE_ORDER_STATUSES } },
    });
    if (active > 0) {
      throw new ConflictException(
        'У вас есть заказ в работе. Удалить аккаунт можно после его выполнения или отмены.',
      );
    }
    await this.prisma.$transaction([
      this.prisma.order.updateMany({
        where: { customerId },
        data: {
          customerId: null,
          customerName: 'Удалённый клиент',
          customerPhone: '',
          address: null,
          apartment: null,
          entrance: null,
          floor: null,
          intercom: null,
          latitude: null,
          longitude: null,
          comment: null,
        },
      }),
      this.prisma.device.deleteMany({ where: { customerId } }),
      this.prisma.customer.delete({ where: { id: customerId } }),
    ]);
    this.logger.log(`Аккаунт ${customerId} удалён по запросу пользователя`);
  }
}
