/**
 * Escrituras puntuales en la base. Cada función toca solo lo necesario y las
 * que cambian varias tablas lo hacen en una transacción (todo o nada).
 */
import type { Account, Category, Debt, Goal, Profile, Settings, Transaction } from '../engine';
import type { FinanzasDB } from './database';

export async function putTransaction(db: FinanzasDB, tx: Transaction): Promise<void> {
  await db.transactions.put(tx);
}

export async function deleteTransaction(db: FinanzasDB, id: string): Promise<void> {
  await db.transactions.delete(id);
}

export async function putCategories(db: FinanzasDB, categories: Category[]): Promise<void> {
  await db.categories.bulkPut(categories);
}

/** Elimina una categoría solo si no tiene movimientos ni es "Otros" o de sistema. */
export async function deleteCategory(db: FinanzasDB, id: string): Promise<boolean> {
  return db.transaction('rw', db.categories, db.transactions, db.recurrings, async () => {
    const category = await db.categories.get(id);
    if (!category || category.isOther || category.isSystem) return false;
    const used =
      (await db.transactions.where('categoryId').equals(id).count()) > 0 ||
      (await db.recurrings.filter((r) => r.categoryId === id).count()) > 0;
    if (used) return false;
    await db.categories.delete(id);
    return true;
  });
}

export async function putAccounts(db: FinanzasDB, accounts: Account[]): Promise<void> {
  await db.accounts.bulkPut(accounts);
}

export async function putGoal(db: FinanzasDB, goal: Goal): Promise<void> {
  await db.goals.put(goal);
}

/** Elimina una meta junto con sus aportes (segunda opción de "Quitar", Anexo D.6). */
export async function deleteGoalWithContributions(db: FinanzasDB, id: string): Promise<void> {
  await db.transaction('rw', db.goals, db.transactions, async () => {
    await db.transactions.where('goalId').equals(id).delete();
    await db.goals.delete(id);
  });
}

export async function putDebt(db: FinanzasDB, debt: Debt): Promise<void> {
  await db.debts.put(debt);
}

/** Elimina una deuda junto con sus pagos (segunda opción de "Quitar", Anexo D.6). */
export async function deleteDebtWithPayments(db: FinanzasDB, id: string): Promise<void> {
  await db.transaction('rw', db.debts, db.transactions, async () => {
    await db.transactions.where('debtId').equals(id).delete();
    await db.debts.delete(id);
  });
}

export async function putProfile(db: FinanzasDB, profile: Profile): Promise<void> {
  await db.meta.put({ key: 'profile', value: profile });
}

export async function putSettings(db: FinanzasDB, settings: Settings): Promise<void> {
  await db.meta.put({ key: 'settings', value: settings });
}
