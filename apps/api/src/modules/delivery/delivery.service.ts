import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  AdminDeliveryZoneDto,
  BlackoutDateDto,
  DayAvailabilityDto,
  DeliveryZoneDto,
  FulfillmentType,
  TimeSlotDto,
} from '@kirilovskiy/shared';
import { Prisma, type DeliveryZone, type TimeSlot } from '@prisma/client';
import { fromDbDate, nowMsk, toDbDate } from '../../common/utils/moscow-time';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { bookedKey, computeAvailability } from './slots';

type Db = PrismaService | Prisma.TransactionClient;

export function toZoneDto(z: DeliveryZone): DeliveryZoneDto {
  return {
    id: z.id,
    name: z.name,
    description: z.description,
    price: z.price,
    freeFromAmount: z.freeFromAmount,
    minOrderAmount: z.minOrderAmount,
    estimatedMinutes: z.estimatedMinutes,
  };
}

export function toAdminZoneDto(z: DeliveryZone): AdminDeliveryZoneDto {
  return { ...toZoneDto(z), isActive: z.isActive, sortOrder: z.sortOrder, polygon: z.polygon ?? null };
}

export function toTimeSlotDto(s: TimeSlot): TimeSlotDto {
  return {
    id: s.id,
    fulfillmentType: s.fulfillmentType,
    startMinutes: s.startMinutes,
    endMinutes: s.endMinutes,
    weekdays: s.weekdays,
    capacity: s.capacity,
    isActive: s.isActive,
    sortOrder: s.sortOrder,
  };
}

@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async zones(): Promise<DeliveryZoneDto[]> {
    const rows = await this.prisma.deliveryZone.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
    });
    return rows.map(toZoneDto);
  }

  /** Максимальное время изготовления по товарам корзины, часов */
  async leadTimeHours(productIds: string[] = []): Promise<number> {
    const ids = productIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
    if (!ids.length) return 0;
    const agg = await this.prisma.product.aggregate({
      where: { id: { in: ids } },
      _max: { leadTimeHours: true },
    });
    return agg._max.leadTimeHours ?? 0;
  }

  async availability(type: FulfillmentType, productLeadHours: number, db: Db = this.prisma): Promise<DayAvailabilityDto[]> {
    const store = await this.settings.getStore();
    const now = nowMsk();
    const from = now.toISODate()!;
    const to = now.plus({ days: store.orderHorizonDays }).toISODate()!;

    const [slots, blackout, booked] = await Promise.all([
      db.timeSlot.findMany({ where: { isActive: true } }),
      db.blackoutDate.findMany({ where: { date: { gte: toDbDate(from), lte: toDbDate(to) } } }),
      db.order.groupBy({
        by: ['deliveryDate', 'timeSlotId'],
        where: {
          deliveryDate: { gte: toDbDate(from), lte: toDbDate(to) },
          status: { not: 'CANCELLED' },
          timeSlotId: { not: null },
        },
        _count: { _all: true },
      }),
    ]);

    return computeAvailability({
      now,
      type,
      horizonDays: store.orderHorizonDays,
      leadMinutes: Math.max(store.minLeadTimeMinutes, productLeadHours * 60),
      slots,
      blackoutDates: new Set(blackout.map((b) => fromDbDate(b.date))),
      booked: new Map(
        booked.map((b) => [bookedKey(fromDbDate(b.deliveryDate), b.timeSlotId!), b._count._all]),
      ),
    });
  }

  /** Проверяет выбранные дату и интервал. Вызывается внутри транзакции создания заказа. */
  async assertSlotAvailable(
    params: { type: FulfillmentType; date: string; timeSlotId: string; leadHours: number },
    db: Db,
  ): Promise<TimeSlot> {
    const days = await this.availability(params.type, params.leadHours, db);
    const slot = days.find((d) => d.date === params.date)?.slots.find((s) => s.id === params.timeSlotId);
    if (!slot) {
      throw new BadRequestException('Выбранные дата и время недоступны. Выберите другой интервал.');
    }
    if (!slot.available) {
      throw new BadRequestException('На выбранный интервал больше нет мест. Выберите другое время.');
    }
    return (await db.timeSlot.findUnique({ where: { id: params.timeSlotId } }))!;
  }

  // ─────────── Админка ───────────

  async adminZones(): Promise<AdminDeliveryZoneDto[]> {
    const rows = await this.prisma.deliveryZone.findMany({ orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }] });
    return rows.map(toAdminZoneDto);
  }

  async adminSlots(): Promise<TimeSlotDto[]> {
    const rows = await this.prisma.timeSlot.findMany({
      orderBy: [{ startMinutes: 'asc' }, { sortOrder: 'asc' }],
    });
    return rows.map(toTimeSlotDto);
  }

  async adminBlackoutDates(): Promise<BlackoutDateDto[]> {
    const rows = await this.prisma.blackoutDate.findMany({
      where: { date: { gte: toDbDate(nowMsk().minus({ days: 30 }).toISODate()!) } },
      orderBy: { date: 'asc' },
    });
    return rows.map((r) => ({ id: r.id, date: fromDbDate(r.date), reason: r.reason }));
  }
}
