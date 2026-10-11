/** Все суммы в системе — целые копейки */

export function rublesToKopecks(rubles: number): number {
  return Math.round(rubles * 100);
}

export function kopecksToRubles(kopecks: number): number {
  return kopecks / 100;
}

/** 125000 → «1 250 ₽», 12550 → «125,50 ₽» */
export function formatRub(kopecks: number): string {
  const negative = kopecks < 0;
  const abs = Math.abs(Math.round(kopecks));
  const rubles = Math.floor(abs / 100);
  const kop = abs % 100;
  const rublesStr = String(rubles).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const result = kop === 0 ? rublesStr : `${rublesStr},${String(kop).padStart(2, '0')}`;
  return `${negative ? '−' : ''}${result} ₽`;
}

/** 1250 → «1,25 кг», 350 → «350 г» */
export function formatWeight(grams: number): string {
  if (grams >= 1000) {
    const kg = grams / 1000;
    return `${String(Number(kg.toFixed(2))).replace('.', ',')} кг`;
  }
  return `${grams} г`;
}
