/**
 * Fechas como texto: 'YYYY-MM-DD' y meses 'YYYY-MM'. "Hoy" siempre en hora de
 * Colombia (Anexo D.16), sin importar la zona del dispositivo.
 */

export const TIME_ZONE = 'America/Bogota';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Fecha de hoy en Colombia para un instante dado. */
export function todayInColombia(now: Date = new Date()): string {
  // en-CA formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

function parseMonth(month: string): [number, number] {
  const m = MONTH_RE.exec(month);
  if (!m) throw new RangeError(`Mes inválido: ${month}`);
  return [Number(m[1]), Number(m[2])];
}

export function isValidMonth(month: string): boolean {
  const m = MONTH_RE.exec(month);
  return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 12;
}

export function isValidDate(date: string): boolean {
  const m = DATE_RE.exec(date);
  if (!m) return false;
  const month = Number(m[2]);
  const day = Number(m[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(date.slice(0, 7));
}

export function daysInMonth(month: string): number {
  const [y, m] = parseMonth(month);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Suma n meses (n puede ser negativo). */
export function addMonths(month: string, n: number): string {
  const [y, m] = parseMonth(month);
  const index = y * 12 + (m - 1) + n;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

/** Meses de `from` a `to` (positivo si `to` es posterior). */
export function monthsBetween(from: string, to: string): number {
  const [y1, m1] = parseMonth(from);
  const [y2, m2] = parseMonth(to);
  return (y2 - y1) * 12 + (m2 - m1);
}

/** Día del mes ajustado: si el mes no tiene ese día, el último (31 en febrero → 28/29). */
export function clampDay(month: string, day: number): number {
  return Math.min(Math.max(1, day), daysInMonth(month));
}

export function dateIn(month: string, day: number): string {
  return `${month}-${pad(clampDay(month, day))}`;
}

export function dayOf(date: string): number {
  return Number(date.slice(8, 10));
}
