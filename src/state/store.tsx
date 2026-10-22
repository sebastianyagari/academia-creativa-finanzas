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
import { rulesFor } from '../rules';
import {
  applyOnboarding,
  createDefaultData,
  monthOf,
  type OnboardingAnswers,
  todayInColombia,
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
import { newId } from '../engine/id';
import { createDemoData } from './demo';

export interface Actions {
  /** Guarda un movimiento y, si viene, la plantilla "Repetir cada mes". */
  saveTransaction(tx: Transaction, recurring?: Recurring): Promise<void>;
  saveRecurring(recurring: Recurring): Promise<void>;
  deleteRecurring(id: string): Promise<void>;
  skipPending(skip: RecurringSkip): Promise<void>;
  createCard(account: Account, debt: Debt): Promise<void>;
  /** Archiva una cuenta (y su deuda, si es tarjeta). */
  archiveAccount(id: string): Promise<void>;
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
  /** Aplica las respuestas del onboarding (primera vez o repetido desde Ajustes). */
  completeOnboarding(answers: OnboardingAnswers): Promise<void>;
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

/**
 * Pide al navegador que no borre los datos por falta de espacio (SPEC 9.4).
 * Se llama al terminar el onboarding; si el navegador no lo permite, no pasa nada.
 */
async function requestPersistentStorage(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Sin soporte: el recordatorio de respaldo (Fase 5) cubre este caso.
  }
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
      // Primera vez: cuentas y categorías por defecto, sin onboarding hecho. La app
      // muestra la bienvenida, donde se elige configurar o ver el ejemplo.
      if (!(await isInitialized(db))) await replaceAll(db, createDefaultData());
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
      saveTransaction: (tx, recurring) => run((db) => repo.putTransaction(db, tx, recurring)),
      saveRecurring: (recurring) => run((db) => repo.putRecurring(db, recurring)),
      deleteRecurring: (id) => run((db) => repo.deleteRecurring(db, id)),
      skipPending: (skip) => run((db) => repo.putSkip(db, skip)),
      createCard: (account, debt) => run((db) => repo.createCard(db, account, debt)),
      archiveAccount: (id) => run((db) => repo.archiveAccount(db, id)),
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
      completeOnboarding: async (answers) => {
        await run(async (db) => {
          const now = todayInColombia();
          const current = await loadAll(db);
          const rules = rulesFor(Number(now.slice(0, 4))).rules;
          await replaceAll(db, applyOnboarding(current, answers, now, rules, newId));
        });
        await requestPersistentStorage();
      },
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
