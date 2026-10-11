import { DateTime } from 'luxon';
import { bookedKey, computeAvailability, SlotTemplate } from './slots';

const slot = (id: string, start: number, end: number, extra: Partial<SlotTemplate> = {}): SlotTemplate => ({
  id,
  fulfillmentType: null,
  startMinutes: start,
  endMinutes: end,
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  capacity: 2,
  isActive: true,
  sortOrder: 0,
  ...extra,
});

// Понедельник, 12 октября 2026, 11:00 по Москве
const now = DateTime.fromISO('2026-10-12T11:00:00', { zone: 'Europe/Moscow' });

describe('computeAvailability', () => {
  const base = {
    now,
    type: 'DELIVERY' as const,
    horizonDays: 3,
    leadMinutes: 120,
    blackoutDates: new Set<string>(),
    booked: new Map<string, number>(),
  };

  it('скрывает интервалы раньше времени на подготовку', () => {
    const days = computeAvailability({ ...base, slots: [slot('a', 600, 720), slot('b', 780, 900), slot('c', 840, 960)] });
    expect(days[0].date).toBe('2026-10-12');
    expect(days[0].isToday).toBe(true);
    // 13:00 = 11:00 + 2 ч — ещё можно; 10:00 — уже нельзя
    expect(days[0].slots.map((s) => s.id)).toEqual(['b', 'c']);
    expect(days[1].slots.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('учитывает вместимость, нерабочие дни, дни недели и тип получения', () => {
    const days = computeAvailability({
      ...base,
      blackoutDates: new Set(['2026-10-13']),
      booked: new Map([[bookedKey('2026-10-14', 'a'), 2]]),
      slots: [
        slot('a', 600, 720),
        slot('p', 600, 720, { fulfillmentType: 'PICKUP' }),
        slot('w', 600, 720, { weekdays: [6, 7] }),
      ],
    });
    expect(days.map((d) => d.date)).toEqual(['2026-10-14']);
    expect(days[0].slots).toEqual([
      expect.objectContaining({ id: 'a', available: false, remaining: 0, label: '10:00–12:00' }),
    ]);
  });
});
