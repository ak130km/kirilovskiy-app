import type { DayAvailabilityDto, FulfillmentType } from '@kirilovskiy/shared';
import { formatDateRu, formatSlot } from '@kirilovskiy/shared';
import { DateTime } from 'luxon';

export interface SlotTemplate {
  id: string;
  fulfillmentType: FulfillmentType | null;
  startMinutes: number;
  endMinutes: number;
  weekdays: number[];
  capacity: number;
  isActive: boolean;
  sortOrder: number;
}

export interface AvailabilityInput {
  /** Текущий момент в зоне Europe/Moscow */
  now: DateTime;
  type: FulfillmentType;
  horizonDays: number;
  /** Минимальное время от «сейчас» до начала интервала, минут */
  leadMinutes: number;
  slots: SlotTemplate[];
  /** Нерабочие дни YYYY-MM-DD */
  blackoutDates: Set<string>;
  /** Количество неотменённых заказов: ключ `${date}|${slotId}` */
  booked: Map<string, number>;
}

export const bookedKey = (date: string, slotId: string) => `${date}|${slotId}`;

/**
 * Список дней и интервалов, доступных для заказа.
 * Интервалы, которые начинаются раньше «сейчас + время на подготовку», не показываются.
 * Заполненные интервалы показываются как недоступные. Дни без интервалов пропускаются.
 */
export function computeAvailability(input: AvailabilityInput): DayAvailabilityDto[] {
  const { now, type, horizonDays, leadMinutes, slots, blackoutDates, booked } = input;
  const earliest = now.plus({ minutes: leadMinutes });
  const today = now.startOf('day');
  const result: DayAvailabilityDto[] = [];

  const templates = slots
    .filter((s) => s.isActive && (s.fulfillmentType === null || s.fulfillmentType === type))
    .sort((a, b) => a.startMinutes - b.startMinutes || a.sortOrder - b.sortOrder);

  for (let i = 0; i < horizonDays; i++) {
    const day = today.plus({ days: i });
    const date = day.toISODate()!;
    if (blackoutDates.has(date)) continue;

    const daySlots = templates
      .filter((s) => s.weekdays.includes(day.weekday))
      .filter((s) => day.plus({ minutes: s.startMinutes }) >= earliest)
      .map((s) => {
        const remaining = Math.max(0, s.capacity - (booked.get(bookedKey(date, s.id)) ?? 0));
        return {
          id: s.id,
          startMinutes: s.startMinutes,
          endMinutes: s.endMinutes,
          label: formatSlot(s.startMinutes, s.endMinutes),
          available: remaining > 0,
          remaining,
        };
      });

    if (daySlots.length === 0) continue;
    result.push({ date, label: formatDateRu(date), isToday: i === 0, slots: daySlots });
  }
  return result;
}
