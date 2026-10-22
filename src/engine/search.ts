/** Búsqueda y filtros de movimientos (SPEC 6.4). */
import { inRange, type DateRange } from './periods';
import type { AppData, Group, Kind, Transaction } from './types';

export interface TransactionFilter {
  /** Texto libre: nota, categoría, cuenta, meta o deuda. Sin distinguir tildes ni mayúsculas. */
  text?: string;
  kind?: Kind;
  /** Coincide con la cuenta de origen o la de destino. */
  accountId?: string;
  categoryId?: string;
  /** Monto mínimo y máximo, inclusive. */
  min?: number;
  max?: number;
  range?: DateRange;
}

/** "Café" → "cafe": minúsculas y sin tildes, para buscar como se escribe en el celular. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function searchableText(data: AppData, t: Transaction): string {
  const names = [
    t.note,
    data.categories.find((c) => c.id === t.categoryId)?.name,
    data.accounts.find((a) => a.id === t.accountId)?.name,
    data.accounts.find((a) => a.id === t.toAccountId)?.name,
    data.goals.find((g) => g.id === t.goalId)?.name,
    data.debts.find((d) => d.id === t.debtId)?.name,
  ];
  return normalizeText(names.filter(Boolean).join(' '));
}

/** Movimientos que cumplen todos los criterios, del más reciente al más antiguo. */
export function filterTransactions(data: AppData, filter: TransactionFilter): Transaction[] {
  const words = normalizeText(filter.text ?? '')
    .split(/\s+/)
    .filter(Boolean);
  return data.transactions
    .filter((t) => {
      if (filter.range && !inRange(t.date, filter.range)) return false;
      if (filter.kind && t.kind !== filter.kind) return false;
      if (
        filter.accountId &&
        t.accountId !== filter.accountId &&
        t.toAccountId !== filter.accountId
      ) {
        return false;
      }
      if (filter.categoryId && t.categoryId !== filter.categoryId) return false;
      if (filter.min !== undefined && t.amount < filter.min) return false;
      if (filter.max !== undefined && t.amount > filter.max) return false;
      if (words.length) {
        const haystack = searchableText(data, t);
        if (!words.every((w) => haystack.includes(w))) return false;
      }
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

const KIND_GROUP: Partial<Record<Kind, Group>> = {
  ingreso: 'ingresos',
  factura: 'facturas',
  gasto: 'gastos',
  inversion: 'inversiones',
};

/**
 * Categoría que se propone al registrar (SPEC 2.3: 3 toques o menos): la del
 * movimiento más reciente de ese tipo, si sigue activa.
 */
export function suggestedCategoryId(data: AppData, kind: Kind): string | undefined {
  const group = KIND_GROUP[kind];
  if (!group) return undefined;
  const active = new Set(
    data.categories.filter((c) => c.group === group && !c.archived && !c.isSystem).map((c) => c.id),
  );
  let best: Transaction | undefined;
  for (const t of data.transactions) {
    if (
      t.kind === kind &&
      t.categoryId &&
      active.has(t.categoryId) &&
      (!best || t.date >= best.date)
    ) {
      best = t;
    }
  }
  return best?.categoryId;
}
