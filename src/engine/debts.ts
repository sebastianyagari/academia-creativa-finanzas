/**
 * Deudas: tasa y simulación bola de nieve / avalancha (SPEC 5.3).
 * El algoritmo reproduce exactamente el sim() del prototipo; los intereses se
 * acumulan con decimales y solo se redondean al mostrar.
 */
import { debtBalance } from './balances';
import type { AppData, Debt, Strategy } from './types';

export const MAX_SIMULATION_MONTHS = 600;
const PAID_THRESHOLD = 0.5;

/** Tasa mensual equivalente a una EA. Nunca dividir la anual entre 12. */
export function monthlyRate(rateEA: number): number {
  return Math.pow(1 + rateEA / 100, 1 / 12) - 1;
}

export interface SimDebt {
  id: string;
  balance: number;
  rateEA: number;
  minPayment: number;
}

export interface SimulationResult {
  /** Todas las deudas quedan pagadas antes del tope de 600 meses. */
  finished: boolean;
  /** Meses hasta quedar libre; null si no termina ("Sin fecha"). */
  months: number | null;
  /** Intereses totales, con decimales. */
  interest: number;
  /** Mes (1, 2, …) en que se paga cada deuda; null si no se paga. */
  paidMonth: Record<string, number | null>;
  /** Mes en que se paga la primera deuda; null si ninguna. */
  firstPaidMonth: number | null;
}

function strategyOrder(strategy: Strategy) {
  return strategy === 'bola'
    ? (a: { balance: number }, b: { balance: number }) => a.balance - b.balance
    : (a: { balance: number; rate: number }, b: { balance: number; rate: number }) =>
        b.rate - a.rate || a.balance - b.balance;
}

export function simulate(
  debts: SimDebt[],
  strategy: Strategy,
  extraPayment: number,
): SimulationResult {
  const list = debts
    .map((d) => ({
      id: d.id,
      balance: d.balance,
      rate: monthlyRate(d.rateEA),
      min: d.minPayment,
      paid: null as number | null,
    }))
    .filter((d) => d.balance > PAID_THRESHOLD);

  // El presupuesto mensual queda fijo durante toda la simulación.
  const budget = list.reduce((sum, d) => sum + d.min, 0) + extraPayment;
  const order = strategyOrder(strategy);
  let month = 0;
  let interest = 0;

  while (list.some((d) => d.paid === null) && month < MAX_SIMULATION_MONTHS) {
    month++;
    const active = list.filter((d) => d.paid === null);
    for (const d of active) {
      const i = d.balance * d.rate;
      d.balance += i;
      interest += i;
    }
    let remaining = budget;
    for (const d of active) {
      const pay = Math.min(d.min, d.balance);
      d.balance -= pay;
      remaining -= pay;
    }
    for (const d of active.slice().sort(order)) {
      if (remaining <= 0) break;
      const pay = Math.min(remaining, d.balance);
      d.balance -= pay;
      remaining -= pay;
    }
    for (const d of active) {
      if (d.balance <= PAID_THRESHOLD) {
        d.paid = month;
        d.balance = 0;
      }
    }
  }

  const finished = list.every((d) => d.paid !== null);
  const paidMonth: Record<string, number | null> = {};
  let first: number | null = null;
  for (const d of list) {
    paidMonth[d.id] = d.paid;
    if (d.paid !== null && (first === null || d.paid < first)) first = d.paid;
  }
  return { finished, months: finished ? month : null, interest, paidMonth, firstPaidMonth: first };
}

/** Deudas activas con su saldo derivado, listas para simular (tarjetas incluidas: SPEC 4.3). */
export function simDebts(data: Pick<AppData, 'debts' | 'accounts' | 'transactions'>): SimDebt[] {
  return data.debts
    .filter((d) => !d.archived)
    .map((d) => ({
      id: d.id,
      balance: debtBalance(d, data),
      rateEA: d.rateEA,
      minPayment: d.minPayment,
    }));
}

/** Deuda donde va el abono extra según la estrategia ("Abono extra aquí"). */
export function priorityDebtId(debts: SimDebt[], strategy: Strategy): string | null {
  const withBalance = debts
    .filter((d) => d.balance > PAID_THRESHOLD)
    .map((d) => ({ ...d, rate: monthlyRate(d.rateEA) }))
    .sort(strategyOrder(strategy));
  return withBalance[0]?.id ?? null;
}

/**
 * "La cuota no cubre ni los intereses del mes. La deuda no baja."
 * Aplica cuando la cuota mínima es menor o igual al interés de un mes.
 */
export function paymentBelowInterest(debt: SimDebt): boolean {
  return (
    debt.balance > PAID_THRESHOLD && debt.minPayment <= debt.balance * monthlyRate(debt.rateEA)
  );
}

/** Interés de un mes sobre el saldo actual (para mostrar en la advertencia). */
export function monthlyInterest(debt: Pick<Debt, 'rateEA'> & { balance: number }): number {
  return debt.balance * monthlyRate(debt.rateEA);
}
