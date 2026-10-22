/**
 * Movimientos que se repiten y sus pendientes (SPEC 5.4 y Anexo D.7–D.10).
 * La app nunca anota sola: un pendiente solo se convierte en movimiento cuando
 * la persona lo registra.
 */
import { clampDay, dateIn, dayOf, monthOf } from './dates';
import type { AppData, Recurring, Transaction } from './types';

/** Fechas programadas de una plantilla en un mes ('YYYY-MM-DD'), ordenadas. */
export function occurrences(recurring: Recurring, month: string): string[] {
  if (!recurring.active || month < recurring.startMonth) return [];
  const s = recurring.schedule;
  let days: number[];
  if (s.type === 'mensual') days = [s.day];
  else if (s.type === 'quincenal') days = [...s.days];
  else days = Number(month.slice(5)) === s.month ? [s.day] : [];
  const clamped = [...new Set(days.map((d) => clampDay(month, d)))].sort((a, b) => a - b);
  return clamped.map((d) => dateIn(month, d));
}

export interface Pending {
  recurringId: string;
  scheduledDate: string;
  recurring: Recurring;
}

/** Pendientes de un mes: fechas programadas sin registrar ni omitir. */
export function pendingFor(
  data: Pick<AppData, 'recurrings' | 'recurringSkips' | 'transactions'>,
  month: string,
): Pending[] {
  const registered = new Set(
    data.transactions
      .filter((t) => t.fromRecurringId && t.scheduledDate && monthOf(t.scheduledDate) === month)
      .map((t) => `${t.fromRecurringId}|${t.scheduledDate}`),
  );
  const skipped = new Set(
    data.recurringSkips
      .filter((s) => s.month === month)
      .map((s) => `${s.recurringId}|${dateIn(month, s.day)}`),
  );
  const out: Pending[] = [];
  for (const r of data.recurrings) {
    for (const date of occurrences(r, month)) {
      const key = `${r.id}|${date}`;
      if (!registered.has(key) && !skipped.has(key))
        out.push({ recurringId: r.id, scheduledDate: date, recurring: r });
    }
  }
  return out.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
}

/**
 * Movimiento que se crea al tocar "Registrar". La persona puede ajustar monto y
 * fecha; la fecha programada queda guardada para no volver a mostrar el pendiente.
 */
export function transactionFromPending(
  pending: Pending,
  id: string,
  overrides: { amount?: number; date?: string; note?: string } = {},
): Transaction {
  const r = pending.recurring;
  const tx: Transaction = {
    id,
    kind: r.kind,
    date: overrides.date ?? pending.scheduledDate,
    amount: overrides.amount ?? r.amount,
    accountId: r.accountId,
    fromRecurringId: r.id,
    scheduledDate: pending.scheduledDate,
  };
  if (r.toAccountId) tx.toAccountId = r.toAccountId;
  if (r.categoryId) tx.categoryId = r.categoryId;
  if (r.goalId) tx.goalId = r.goalId;
  if (r.debtId) tx.debtId = r.debtId;
  const note = overrides.note ?? r.note;
  if (note) tx.note = note;
  return tx;
}

/**
 * "Repetir cada mes" al registrar (SPEC 5.4): crea la plantilla mensual el mismo
 * día y enlaza el movimiento a ella, para que este mes no aparezca como pendiente.
 */
export function repeatMonthly(
  tx: Transaction,
  recurringId: string,
): { transaction: Transaction; recurring: Recurring } {
  const recurring: Recurring = {
    id: recurringId,
    kind: tx.kind,
    amount: tx.amount,
    accountId: tx.accountId,
    schedule: { type: 'mensual', day: dayOf(tx.date) },
    active: true,
    startMonth: monthOf(tx.date),
  };
  if (tx.toAccountId) recurring.toAccountId = tx.toAccountId;
  if (tx.categoryId) recurring.categoryId = tx.categoryId;
  if (tx.goalId) recurring.goalId = tx.goalId;
  if (tx.debtId) recurring.debtId = tx.debtId;
  if (tx.note) recurring.note = tx.note;
  return {
    transaction: { ...tx, fromRecurringId: recurringId, scheduledDate: tx.date },
    recurring,
  };
}

const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function dayText(day: number): string {
  return day >= 31 ? 'el último día' : `el día ${day}`;
}

/** Descripción del horario: "Cada mes, el día 5", "Cada quincena: el día 15 y el último día". */
export function describeSchedule(recurring: Recurring): string {
  const s = recurring.schedule;
  if (s.type === 'mensual') return `Cada mes, ${dayText(s.day)}`;
  if (s.type === 'quincenal') return `Cada quincena: ${dayText(s.days[0])} y ${dayText(s.days[1])}`;
  return `Cada año, el ${s.day} de ${MONTH_NAMES[s.month - 1]}`;
}

/** "Omitir este mes". */
export function skipFor(pending: Pending): { recurringId: string; month: string; day: number } {
  return {
    recurringId: pending.recurringId,
    month: monthOf(pending.scheduledDate),
    day: dayOf(pending.scheduledDate),
  };
}
