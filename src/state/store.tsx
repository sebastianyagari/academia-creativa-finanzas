/**
 * Estado de la app: los datos viven en IndexedDB y aquí se mantiene una copia
 * en memoria. Cada acción escribe en la base y luego vuelve a leer todo, así la
 * pantalla nunca muestra algo distinto de lo que quedó guardado.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { FinanzasDB, isInitialized, loadAll, replaceAll, repo } from '../db';
import {
  createDefaultData,
  monthOf,
  todayInColombia,
  type Account,
  type AppData,
  type Category,
  type Debt,
  type Goal,
  type Profile,
  type Settings,
  type Transaction,
} from '../engine';
import { createDemoData } from './demo';

export interface Actions {
  saveTransaction(tx: Transaction): Promise<void>;
  deleteTransaction(id: string): Promise<void>;
  saveCategories(categories: Category[]): Promise<void>;
  /** false si la categoría tiene movimientos o no se puede borrar. */
  deleteCategory(id: string): Promise<boolean>;
  saveAccounts(accounts: Account[]): Promise<void>;
  saveGoal(goal: Goal): Promise<void>;
  deleteGoalWithContributions(id: string): Promise<void>;
  saveDebt(debt: Debt): Promise<void>;
  deleteDebtWithPayments(id: string): Promise<void>;
  updateProfile(changes: Partial<Profile>): Promise<void>;
  updateSettings(changes: Partial<Settings>): Promise<void>;
  /** Reemplaza todo por los datos de ejemplo. */
  loadDemo(): Promise<void>;
  /** Borra todo y deja cuentas y categorías por defecto; conserva el nombre. */
  startFresh(): Promise<void>;
}

interface StoreValue {
  data: AppData;
  /** Hoy en Colombia, 'YYYY-MM-DD'. */
  today: string;
  /** Mes actual, 'YYYY-MM'. */
  currentMonth: string;
  actions: Actions;
}

const StoreContext = createContext<StoreValue | null>(null);

let sharedDb: FinanzasDB | null = null;
function getDb(): FinanzasDB {
  sharedDb ??= new FinanzasDB();
  return sharedDb;
}

function applyTheme(theme: Settings['theme']) {
  const root = document.documentElement;
  if (theme === 'claro') root.dataset.theme = 'light';
  else if (theme === 'oscuro') root.dataset.theme = 'dark';
  else delete root.dataset.theme;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState(() => todayInColombia());

  // "Hoy" se recalcula al volver a la app (puede quedar abierta de un día para otro).
  useEffect(() => {
    const refresh = () => setToday(todayInColombia());
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = getDb();
      // Primera vez: datos de ejemplo, como el prototipo. El onboarding llega en la Fase 4.
      if (!(await isInitialized(db))) await replaceAll(db, createDemoData(todayInColombia()));
      const loaded = await loadAll(db);
      if (!cancelled) setData(loaded);
    })().catch((e: unknown) => {
      console.error(e);
      if (!cancelled) setError('No pudimos abrir tus datos en este navegador.');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (data) applyTheme(data.settings.theme);
  }, [data]);

  const run = useCallback(async <T,>(write: (db: FinanzasDB) => Promise<T>): Promise<T> => {
    const db = getDb();
    const result = await write(db);
    setData(await loadAll(db));
    return result;
  }, []);

  const actions = useMemo<Actions | null>(() => {
    if (!data) return null;
    return {
      saveTransaction: (tx) => run((db) => repo.putTransaction(db, tx)),
      deleteTransaction: (id) => run((db) => repo.deleteTransaction(db, id)),
      saveCategories: (categories) => run((db) => repo.putCategories(db, categories)),
      deleteCategory: (id) => run((db) => repo.deleteCategory(db, id)),
      saveAccounts: (accounts) => run((db) => repo.putAccounts(db, accounts)),
      saveGoal: (goal) => run((db) => repo.putGoal(db, goal)),
      deleteGoalWithContributions: (id) => run((db) => repo.deleteGoalWithContributions(db, id)),
      saveDebt: (debt) => run((db) => repo.putDebt(db, debt)),
      deleteDebtWithPayments: (id) => run((db) => repo.deleteDebtWithPayments(db, id)),
      updateProfile: (changes) => run((db) => repo.putProfile(db, { ...data.profile, ...changes })),
      updateSettings: (changes) =>
        run((db) => repo.putSettings(db, { ...data.settings, ...changes })),
      loadDemo: () =>
        run((db) => {
          const demo = createDemoData(todayInColombia());
          return replaceAll(db, { ...demo, profile: { ...demo.profile, name: data.profile.name } });
        }),
      startFresh: () =>
        run((db) => {
          const fresh = createDefaultData();
          return replaceAll(db, {
            ...fresh,
            profile: { ...fresh.profile, name: data.profile.name },
            settings: { ...fresh.settings, theme: data.settings.theme },
          });
        }),
    };
  }, [data, run]);

  if (error) return <p role="alert">{error}</p>;
  if (!data || !actions) return null;

  return (
    <StoreContext.Provider value={{ data, today, currentMonth: monthOf(today), actions }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore debe usarse dentro de StoreProvider');
  return value;
}
