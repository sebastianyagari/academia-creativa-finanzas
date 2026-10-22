/** Períodos del dashboard (SPEC 5.6) y quincenas (SPEC 5.5). */
import { addMonths, daysInMonth, monthOf } from './dates';
import type { Transaction } from './types';

export type PeriodKind = 'mes' | '6m' | 'anio';
export type Quincena = 1 | 2;

export interface DateRange {
  /** Inclusive, 'YYYY-MM-DD'. */
  from: string;
  /** Inclusive, 'YYYY-MM-DD'. */
  to: string;
}

/** Meses que abarca el período, del más antiguo al más reciente. */
export function periodMonths(kind: PeriodKind, month: string): string[] {
  if (kind === 'mes') return [month];
  if (kind === '6m') return [5, 4, 3, 2, 1, 0].map((n) => addMonths(month, -n));
  const year = month.slice(0, 4);
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
}

/** Cuánto mueven las flechas: 12 meses en Año, 1 en Mes y 6 meses. */
export function periodStep(kind: PeriodKind): number {
  return kind === 'anio' ? 12 : 1;
}

export function monthRange(month: string): DateRange {
  return { from: `${month}-01`, to: `${month}-${String(daysInMonth(month)).padStart(2, '0')}` };
}

export function rangeOfMonths(months: string[]): DateRange {
  const first = months[0];
  const last = months[months.length - 1];
  if (!first || !last) throw new RangeError('Se necesita al menos un mes');
  return { from: monthRange(first).from, to: monthRange(last).to };
}

/** Quincena 1: del 1 al 15. Quincena 2: del 16 a fin de mes. */
export function quincenaRange(month: string, quincena: Quincena): DateRange {
  const full = monthRange(month);
  return quincena === 1
    ? { from: full.from, to: `${month}-15` }
    : { from: `${month}-16`, to: full.to };
}

export function inRange(date: string, range: DateRange): boolean {
  return date >= range.from && date <= range.to;
}

/**
 * Meses transcurridos del período hasta el mes actual, mínimo 1 (SPEC 5.1):
 * multiplica el presupuesto mensual en las vistas de 6 meses y Año.
 */
export function monthsElapsed(months: string[], currentMonth: string): number {
  return Math.max(1, months.filter((m) => m <= currentMonth).length);
}

/** Vista por defecto de Inicio: 6 meses si hay movimientos en más de un mes (Anexo D.17). */
export function defaultPeriod(transactions: Transaction[]): PeriodKind {
  const months = new Set(transactions.map((t) => monthOf(t.date)));
  return months.size > 1 ? '6m' : 'mes';
}
