/**
 * Escrituras puntuales en la base. Cada función toca solo lo necesario y las
 * que cambian varias tablas lo hacen en una transacción (todo o nada).
 */
import type {
  Account,
  Category,
  Debt,
  Goal,
  Profile,
  Recurring,
  RecurringSkip,
  Settings,
  Transaction,
} from '../engine';
import type { FinanzasDB } from './database';

/** Guarda un movimiento y, si viene, su plantilla "Repetir cada mes" (todo o nada). */
export async function putTransaction(
  db: FinanzasDB,
  tx: Transaction,
  recurring?: Recurring,
): Promise<void> {
  await db.transaction('rw', db.transactions, db.recurrings, async () => {
    if (recurring) await db.recurrings.put(recurring);
    await db.transactions.put(tx);
  });
}

export async function putRecurring(db: FinanzasDB, recurring: Recurring): Promise<void> {
  await db.recurrings.put(recurring);
}

/** Borra la plantilla y sus omisiones. Los movimientos ya registrados se conservan. */
export async function deleteRecurring(db: FinanzasDB, id: string): Promise<void> {
  await db.transaction('rw', db.recurrings, db.recurringSkips, async () => {
    await db.recurringSkips.where('recurringId').equals(id).delete();
    await db.recurrings.delete(id);
  });
}

export async function putSkip(db: FinanzasDB, skip: RecurringSkip): Promise<void> {
  await db.recurringSkips.put(skip);
}

/** Crea una tarjeta: cuenta y deuda enlazadas en una sola transacción. */
export async function createCard(db: FinanzasDB, account: Account, debt: Debt): Promise<void> {
  await db.transaction('rw', db.accounts, db.debts, async () => {
    await db.debts.add(debt);
    await db.accounts.add(account);
  });
}

/** Archiva una cuenta; si es tarjeta, también su deuda. */
export async function archiveAccount(db: FinanzasDB, id: string): Promise<void> {
  await db.transaction('rw', db.accounts, db.debts, async () => {
    const account = await db.accounts.get(id);
    if (!account) return;
    await db.accounts.put({ ...account, archived: true });
    if (account.debtId) {
      const debt = await db.debts.get(account.debtId);
      if (debt) await db.debts.put({ ...debt, archived: true });
    }
  });
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
