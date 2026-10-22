import type { AppData, Recurring } from '../../engine';
import { transactionTitle } from './describe';

/** Nombre de una plantilla: el mismo que tendrá el movimiento cuando se registre. */
export function recurringTitle(data: AppData, r: Recurring): string {
  return transactionTitle(data, {
    id: r.id,
    kind: r.kind,
    date: r.startMonth + '-01',
    amount: r.amount,
    accountId: r.accountId,
    toAccountId: r.toAccountId,
    categoryId: r.categoryId,
    goalId: r.goalId,
    debtId: r.debtId,
  });
}
