/** Приводит российский номер к виду +7XXXXXXXXXX. Возвращает null, если номер некорректен. */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.length === 11 && (digits.startsWith('8') || digits.startsWith('7'))) {
    digits = digits.slice(1);
  }
  if (digits.length !== 10 || !digits.startsWith('9')) {
    return null;
  }
  return `+7${digits}`;
}

/** +79161234567 → «+7 916 123-45-67» */
export function formatPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  if (!normalized) return phone;
  const d = normalized.slice(2);
  return `+7 ${d.slice(0, 3)} ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}`;
}

/** Маска ввода: по мере набора превращает цифры в «+7 916 123-45-67» */
export function maskPhoneInput(input: string): string {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('7') || digits.startsWith('8')) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  let out = '+7';
  if (digits.length > 0) out += ` ${digits.slice(0, 3)}`;
  if (digits.length > 3) out += ` ${digits.slice(3, 6)}`;
  if (digits.length > 6) out += `-${digits.slice(6, 8)}`;
  if (digits.length > 8) out += `-${digits.slice(8, 10)}`;
  return out;
}
