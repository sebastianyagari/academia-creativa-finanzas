/**
 * Totales de un período con la regla central de la SPEC 4.2:
 * - Las transferencias no cuentan en ningún total.
 * - Un pago de deuda cuenta en "deudas" por (monto − interés) y su interés cuenta
 *   como gasto en la categoría de sistema "Intereses y cuotas de manejo".
 */
import { INTEREST_CATEGORY_ID } from './defaults';
import { monthOf } from './dates';
import { inRange, type DateRange } from './periods';
import type { Transaction } from './types';

export interface Totals {
  ingresos: number;
  facturas: number;
  gastos: number;
  inversiones: number;
  ahorros: number;
  deudas: number;
  /** facturas + gastos + inversiones + ahorros + deudas. */
  salidas: number;
  /** ingresos − salidas ("Te queda" en Mes, "Balance" en 6 meses y Año). */
  balance: number;
}

export function emptyTotals(): Totals {
  return {
    ingresos: 0,
    facturas: 0,
    gastos: 0,
    inversiones: 0,
    ahorros: 0,
    deudas: 0,
    salidas: 0,
    balance: 0,
  };
}

function interestOf(t: Transaction): number {
  return t.kind === 'pago_deuda' ? Math.min(t.interestPart ?? 0, t.amount) : 0;
}

function addTo(totals: Totals, t: Transaction): void {
  switch (t.kind) {
    case 'ingreso':
      totals.ingresos += t.amount;
      break;
    case 'factura':
      totals.facturas += t.amount;
      break;
    case 'gasto':
      totals.gastos += t.amount;
      break;
    case 'inversion':
      totals.inversiones += t.amount;
      break;
    case 'ahorro':
      totals.ahorros += t.amount;
      break;
    case 'pago_deuda': {
      const interest = interestOf(t);
      totals.deudas += t.amount - interest;
      totals.gastos += interest;
      break;
    }
    case 'transferencia':
      break;
  }
}

function finish(totals: Totals): Totals {
  totals.salidas =
    totals.facturas + totals.gastos + totals.inversiones + totals.ahorros + totals.deudas;
  totals.balance = totals.ingresos - totals.salidas;
  return totals;
}

/** Totales de los movimientos cuya fecha cae en el rango. */
export function totalsFor(transactions: Transaction[], range: DateRange): Totals {
  const totals = emptyTotals();
  for (const t of transactions) if (inRange(t.date, range)) addTo(totals, t);
  return finish(totals);
}

/** Totales mes a mes (barras y tabla de detalle). */
export function totalsByMonth(transactions: Transaction[], months: string[]): Map<string, Totals> {
  const out = new Map(months.map((m) => [m, emptyTotals()]));
  for (const t of transactions) {
    const totals = out.get(monthOf(t.date));
    if (totals) addTo(totals, t);
  }
  for (const totals of out.values()) finish(totals);
  return out;
}

/** Real por categoría en el rango; incluye los intereses en la categoría de sistema. */
export function categoryActuals(
  transactions: Transaction[],
  range: DateRange,
): Map<string, number> {
  const out = new Map<string, number>();
  const add = (id: string, amount: number) => out.set(id, (out.get(id) ?? 0) + amount);
  for (const t of transactions) {
    if (!inRange(t.date, range)) continue;
    if (t.kind === 'pago_deuda') {
      const interest = interestOf(t);
      if (interest > 0) add(INTEREST_CATEGORY_ID, interest);
    } else if (t.categoryId && t.kind !== 'transferencia') {
      add(t.categoryId, t.amount);
    }
  }
  return out;
}
