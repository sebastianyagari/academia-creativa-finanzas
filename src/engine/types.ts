/**
 * Modelo de datos (SPEC sección 4 y Anexo D).
 * Dinero: enteros en pesos. Fechas: 'YYYY-MM-DD'. Meses: 'YYYY-MM'.
 */

export type Group = 'ingresos' | 'facturas' | 'gastos' | 'inversiones';

export type Kind =
  'ingreso' | 'factura' | 'gasto' | 'inversion' | 'ahorro' | 'pago_deuda' | 'transferencia';

export type AccountType = 'efectivo' | 'billetera' | 'banco' | 'tarjeta_credito';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  /** Saldo inicial; para tarjeta_credito es la deuda inicial (>= 0). */
  openingBalance: number;
  archived: boolean;
  /** Solo tarjeta_credito: Debt asociada (tasa EA, cuota mínima). */
  debtId?: string;
}

export interface Category {
  id: string;
  group: Group;
  name: string;
  /** Presupuesto mensual; 0 si no tiene. */
  budget: number;
  /** 1..31, solo facturas. */
  dueDay?: number;
  /** "Otros" del grupo: no se borra ni se renombra. */
  isOther: boolean;
  /** Categoría de sistema, p. ej. "Intereses y cuotas de manejo". */
  isSystem: boolean;
  archived: boolean;
}

export interface Transaction {
  id: string;
  kind: Kind;
  date: string;
  /** Siempre > 0. */
  amount: number;
  /** Cuenta afectada; en transferencias, la de origen. */
  accountId: string;
  /** Solo transferencia. */
  toAccountId?: string;
  /** ingreso, factura, gasto, inversion. */
  categoryId?: string;
  /** ahorro. */
  goalId?: string;
  /** pago_deuda (nunca de tarjetas: Anexo D.1). */
  debtId?: string;
  /** pago_deuda: parte del pago que fue interés. */
  interestPart?: number;
  note?: string;
  /** Si se creó desde un pendiente. */
  fromRecurringId?: string;
  /** Fecha programada del pendiente, aunque `date` sea otra (Anexo D.9). */
  scheduledDate?: string;
}

export type Schedule =
  | { type: 'mensual'; day: number }
  | { type: 'quincenal'; days: [number, number] }
  | { type: 'anual'; month: number; day: number };

export interface Recurring {
  id: string;
  kind: Kind;
  amount: number;
  accountId: string;
  toAccountId?: string;
  categoryId?: string;
  goalId?: string;
  debtId?: string;
  note?: string;
  schedule: Schedule;
  active: boolean;
  startMonth: string;
}

/** Pendiente descartado ("Omitir este mes"). `day` es el día programado ya ajustado al mes. */
export interface RecurringSkip {
  recurringId: string;
  month: string;
  day: number;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  /** Lo ya ahorrado al crear la meta. */
  openingSaved: number;
  deadline: string;
  archived: boolean;
}

export type DebtType = 'credito' | 'tarjeta_credito' | 'otro';

export interface Debt {
  id: string;
  name: string;
  type: DebtType;
  /** Saldo inicial. Para tarjeta_credito siempre 0: el saldo vive en la Account (Anexo D.5). */
  openingBalance: number;
  /** % efectiva anual, 0..200. */
  rateEA: number;
  minPayment: number;
  archived: boolean;
}

export type TabId = 'inicio' | 'movimientos' | 'presupuesto' | 'metas' | 'deudas';

export interface Profile {
  name: string;
  incomeType: 'empleado' | 'independiente' | 'ambos';
  payFrequency: 'mensual' | 'quincenal';
  mainGoal: 'ordenar' | 'ahorrar' | 'deudas' | 'emergencia';
  onboardingDone: boolean;
  firstStepsDone: string[];
  firstStepsDismissed?: boolean;
  startTab?: TabId;
}

export type Strategy = 'bola' | 'avalancha';

export interface Settings {
  strategy: Strategy;
  extraPayment: number;
  lastBackupAt?: string;
  schemaVersion: number;
  theme: 'sistema' | 'claro' | 'oscuro';
  isDemo?: boolean;
}

/** Todos los datos de la persona: lo que se guarda y lo que viaja en un respaldo. */
export interface AppData {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  recurrings: Recurring[];
  recurringSkips: RecurringSkip[];
  goals: Goal[];
  debts: Debt[];
  profile: Profile;
  settings: Settings;
}
