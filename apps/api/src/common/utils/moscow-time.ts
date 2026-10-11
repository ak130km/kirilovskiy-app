import { DateTime } from 'luxon';
import { STORE_TIME_ZONE } from '@kirilovskiy/shared';

/** Текущий момент по Москве */
export function nowMsk(): DateTime {
  return DateTime.now().setZone(STORE_TIME_ZONE);
}

/** «2026-10-12» → DateTime на начало дня по Москве */
export function mskDate(isoDate: string): DateTime {
  return DateTime.fromISO(isoDate, { zone: STORE_TIME_ZONE }).startOf('day');
}

/** Дата для колонки типа date: полночь UTC того же календарного дня */
export function toDbDate(isoDate: string): Date {
  return new Date(`${isoDate.slice(0, 10)}T00:00:00.000Z`);
}

/** Колонка date → «YYYY-MM-DD» */
export function fromDbDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Момент начала интервала (дата по Москве + минуты от полуночи) */
export function slotStartMoment(isoDate: string, startMinutes: number): DateTime {
  return mskDate(isoDate).plus({ minutes: startMinutes });
}

export function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && DateTime.fromISO(value).isValid;
}
