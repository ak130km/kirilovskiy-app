/** Рубли из поля ввода → копейки. «1 250,50» → 125050 */
export function parseRubles(input: string): number | null {
  const normalized = input.replace(/\s/g, '').replace(',', '.');
  if (!normalized) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/** Копейки → строка для поля ввода: 125050 → «1250,5» */
export function kopecksToInput(kopecks: number | null | undefined): string {
  if (kopecks === null || kopecks === undefined) return '';
  return String(kopecks / 100).replace('.', ',');
}

export function timeToInput(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function inputToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** ISO → значение для <input type="datetime-local"> в московском времени */
export function isoToMskInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + 3 * 3600_000);
  return d.toISOString().slice(0, 16);
}

/** Значение <input type="datetime-local"> (Москва) → ISO */
export function mskInputToIso(value: string): string | null {
  if (!value) return null;
  return new Date(`${value}:00+03:00`).toISOString();
}
