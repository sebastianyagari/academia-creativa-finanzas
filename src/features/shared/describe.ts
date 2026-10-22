/** Cómo se nombra cada movimiento y qué cuentas puede usar. */
import type { Account, AppData, Kind, Transaction } from '../../engine';
import { KIND } from '../../components/format';

export function accountName(data: AppData, id: string | undefined): string {
  return data.accounts.find((a) => a.id === id)?.name ?? 'Cuenta eliminada';
}

export function isCard(data: AppData, id: string | undefined): boolean {
  return data.accounts.some((a) => a.id === id && a.type === 'tarjeta_credito');
}

/** Título de un movimiento en la lista. */
export function transactionTitle(data: AppData, t: Transaction): string {
  switch (t.kind) {
    case 'ahorro':
      return data.goals.find((g) => g.id === t.goalId)?.name ?? 'Meta eliminada';
    case 'pago_deuda':
      return data.debts.find((d) => d.id === t.debtId)?.name ?? 'Deuda eliminada';
    case 'transferencia':
      return isCard(data, t.toAccountId) ? 'Pago de tarjeta' : 'Transferencia';
    default:
      return data.categories.find((c) => c.id === t.categoryId)?.name ?? KIND[t.kind].label;
  }
}

/** Línea secundaria: tipo · cuenta(s) · nota. */
export function transactionSubtitle(data: AppData, t: Transaction): string {
  const accounts =
    t.kind === 'transferencia'
      ? `${accountName(data, t.accountId)} → ${accountName(data, t.toAccountId)}`
      : accountName(data, t.accountId);
  return [KIND[t.kind].label, accounts, t.note].filter(Boolean).join(' · ');
}

/**
 * Cuentas que se pueden usar como origen de un movimiento (Anexo D.3):
 * con tarjeta solo se registran compras.
 */
export function accountsFor(data: AppData, kind: Kind, keepId?: string): Account[] {
  const cardAllowed = kind === 'gasto' || kind === 'factura' || kind === 'inversion';
  return data.accounts.filter(
    (a) => a.id === keepId || (!a.archived && (cardAllowed || a.type !== 'tarjeta_credito')),
  );
}
