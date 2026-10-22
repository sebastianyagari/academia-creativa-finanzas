/**
 * Base local en IndexedDB con Dexie (SPEC 3). Una tabla por entidad; perfil y
 * ajustes viven en la tabla `meta` como documentos únicos.
 */
import Dexie, { type EntityTable } from 'dexie';
import {
  CURRENT_SCHEMA_VERSION,
  sortByOrder,
  type Account,
  type AppData,
  type Category,
  type Debt,
  type Goal,
  type Profile,
  type Recurring,
  type RecurringSkip,
  type Settings,
  type Transaction,
} from '../engine';

export const DB_NAME = 'academia-creativa-finanzas';

type MetaRow = { key: 'profile'; value: Profile } | { key: 'settings'; value: Settings };

export class FinanzasDB extends Dexie {
  accounts!: EntityTable<Account, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;
  recurrings!: EntityTable<Recurring, 'id'>;
  recurringSkips!: Dexie.Table<RecurringSkip, [string, string, number]>;
  goals!: EntityTable<Goal, 'id'>;
  debts!: EntityTable<Debt, 'id'>;
  meta!: Dexie.Table<MetaRow, string>;

  constructor(name = DB_NAME) {
    super(name);
    // La versión de Dexie sigue a schemaVersion. Al subirla, agregar aquí la nueva
    // versión con su .upgrade() y la migración equivalente en /db/migrations (SPEC 9.5).
    this.version(CURRENT_SCHEMA_VERSION).stores({
      accounts: 'id, type, archived',
      categories: 'id, group, archived',
      transactions:
        'id, date, kind, accountId, toAccountId, categoryId, goalId, debtId, fromRecurringId',
      recurrings: 'id, active',
      recurringSkips: '[recurringId+month+day], recurringId, month',
      goals: 'id, archived',
      debts: 'id, type, archived',
      meta: 'key',
    });
  }
}

const TABLES = [
  'accounts',
  'categories',
  'transactions',
  'recurrings',
  'recurringSkips',
  'goals',
  'debts',
  'meta',
] as const;

/** ¿La base ya tiene datos de la persona (perfil guardado)? */
export async function isInitialized(db: FinanzasDB): Promise<boolean> {
  return (await db.meta.get('profile')) !== undefined;
}

/** Lee todos los datos. Falla si la base no está inicializada. */
export async function loadAll(db: FinanzasDB): Promise<AppData> {
  return db.transaction(
    'r',
    TABLES.map((t) => db[t]),
    async () => {
      const [profile, settings] = await Promise.all([
        db.meta.get('profile'),
        db.meta.get('settings'),
      ]);
      if (profile?.key !== 'profile' || settings?.key !== 'settings') {
        throw new Error('La base no está inicializada');
      }
      return {
        accounts: sortByOrder(await db.accounts.toArray()),
        categories: sortByOrder(await db.categories.toArray()),
        transactions: await db.transactions.orderBy('date').toArray(),
        recurrings: await db.recurrings.toArray(),
        recurringSkips: await db.recurringSkips.toArray(),
        goals: await db.goals.toArray(),
        debts: await db.debts.toArray(),
        profile: profile.value,
        settings: settings.value,
      };
    },
  );
}

/** Reemplaza todos los datos en una sola transacción: o se guarda todo o nada. */
export async function replaceAll(db: FinanzasDB, data: AppData): Promise<void> {
  await db.transaction(
    'rw',
    TABLES.map((t) => db[t]),
    async () => {
      await Promise.all(TABLES.map((t) => db[t].clear()));
      await db.accounts.bulkAdd(data.accounts);
      await db.categories.bulkAdd(data.categories);
      await db.transactions.bulkAdd(data.transactions);
      await db.recurrings.bulkAdd(data.recurrings);
      await db.recurringSkips.bulkAdd(data.recurringSkips);
      await db.goals.bulkAdd(data.goals);
      await db.debts.bulkAdd(data.debts);
      await db.meta.bulkAdd([
        { key: 'profile', value: data.profile },
        { key: 'settings', value: data.settings },
      ]);
    },
  );
}
