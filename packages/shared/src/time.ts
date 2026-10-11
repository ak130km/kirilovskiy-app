export const STORE_TIME_ZONE = 'Europe/Moscow';

const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];
const WEEKDAYS_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/** 600 → «10:00» */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** «10:00» → 600 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** 600, 720 → «10:00–12:00» */
export function formatSlot(startMinutes: number, endMinutes: number): string {
  return `${minutesToTime(startMinutes)}–${minutesToTime(endMinutes)}`;
}

/** Разбирает «2026-10-12» без учёта часового пояса */
function parseIsoDate(isoDate: string): { y: number; m: number; d: number } {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return { y, m, d };
}

/** «2026-10-12» → «пн, 12 октября» */
export function formatDateRu(isoDate: string, withWeekday = true): string {
  const { y, m, d } = parseIsoDate(isoDate);
  const weekday = WEEKDAYS_SHORT[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const base = `${d} ${MONTHS_GENITIVE[m - 1]}`;
  return withWeekday ? `${weekday}, ${base}` : base;
}

/** Дата и время момента по Москве: «12 октября, 14:05» */
export function formatDateTimeMsk(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  // Москва — UTC+3 без перехода на летнее время
  const msk = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  const d = msk.getUTCDate();
  const m = MONTHS_GENITIVE[msk.getUTCMonth()];
  const hh = String(msk.getUTCHours()).padStart(2, '0');
  const mm = String(msk.getUTCMinutes()).padStart(2, '0');
  return `${d} ${m}, ${hh}:${mm}`;
}
